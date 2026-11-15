// Development only. Independent integer simulator for the one-symbol paper market.
// Runtime main.ts never imports this file or reads the dataset.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { BarsState } from '../vendor/makefun-bars.ts';

const BPS = 10000n;
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
class Rational {
  constructor(n, d = 1n) { const g = gcd(n, d); this.n = n / g; this.d = d / g; }
  add(b) { return new Rational(this.n * b.d + b.n * this.d, this.d * b.d); }
  mul(b) { return new Rational(this.n * b.n, this.d * b.d); }
  div(b) { return new Rational(this.n * b.d, this.d * b.n); }
  floor() { return this.n / this.d; }
}

export class Pool {
  constructor(depth, quoteScale = 6) {
    const inverse = depth.map(d => new Rational(1000000n, BigInt(d) * 10n ** BigInt(quoteScale)))
      .reduce((a, b) => a.add(b), new Rational(0n));
    this.reserve = new Rational(1n).div(inverse);
    this.invariant = this.reserve.mul(this.reserve);
  }
  buy(spend) {
    const next = this.reserve.add(new Rational(spend));
    const factor = this.reserve.mul(next).div(this.invariant);
    return { factor, next };
  }
  sell(value) {
    const next = this.invariant.mul(this.reserve)
      .div(this.invariant.add(new Rational(value).mul(this.reserve)));
    const factor = this.invariant.add(new Rational(value).mul(this.reserve))
      .div(this.reserve.mul(this.reserve));
    return { factor, next };
  }
}

export function value(qty, price, hello) {
  const spec = hello.symbols[0];
  return qty * price * 10n ** BigInt(hello.capital.quote_scale)
    / 10n ** BigInt(spec.qty_scale + spec.price_scale);
}

export function buyFill(notional, open, pool, hello) {
  const feeBps = BigInt(hello.fees.fee_bps), slip = BigInt(hello.fees.slippage_bps);
  const spend = notional * (BPS - feeBps) / BPS;
  const { factor, next } = pool.buy(spend);
  const price = open * (BPS + slip) * factor.n / (BPS * factor.d);
  const spec = hello.symbols[0];
  const qty = spend * 10n ** BigInt(spec.qty_scale + spec.price_scale)
    / (price * 10n ** BigInt(hello.capital.quote_scale));
  return { price, qty, fee: notional - spend, notional, next };
}

export function sellFill(qty, open, pool, hello) {
  const { factor, next } = pool.sell(value(qty, open, hello));
  const p = open * (BPS - BigInt(hello.fees.slippage_bps)) * factor.d / (BPS * factor.n);
  const price = p > 0n ? p : 1n;
  const gross = value(qty, price, hello);
  const proceeds = gross * (BPS - BigInt(hello.fees.fee_bps)) / BPS;
  return { price, qty, fee: gross - proceeds, notional: proceeds, next };
}

export function loadDev(kit) {
  const kitManifest = JSON.parse(readFileSync(`${kit}/kit.json`, 'utf8'));
  const manifest = JSON.parse(readFileSync(`${kit}/dataset/manifest.json`, 'utf8'));
  const spec = manifest.symbols[0];
  const bars = gunzipSync(readFileSync(`${kit}/dataset/${spec.file}`)).toString('utf8')
    .trim().split('\n').map(JSON.parse).map(b => ({ symbol: spec.symbol,
      ...Object.fromEntries(['t', 'o', 'h', 'l', 'c', 'v', 'o_depth', 'c_depth'].map(k => [k, b[k]])) }));
  const hello = {
    type: 'hello', protocol: 'agent-fun/bars-replay/v1',
    seed: BigInt('0x' + createHash('sha256').update(`agent-fun/seed/v1\0${kitManifest.seed_key ?? kitManifest.bundle_sha256}\0${kitManifest.phase}\0${kitManifest.dataset_sha256}`).digest('hex').slice(0,16)).toString(),
    symbols: [{ symbol: spec.symbol, mint: spec.mint, price_scale: spec.price_scale, qty_scale: spec.qty_scale }],
    capital: { quote: 'USDC', quote_scale: 6, quote_units: '1000000000' },
    bar_interval: '1m', first_close_ms: bars[0].t,
    caps: { max_open_positions: 1, max_orders_per_bar: 16, max_weight_bps: 10000, shorts: false, leverage: false },
    fees: { fee_bps: 4, slippage_bps: 2, min_notional_quote_units: '1000000' }, latency_bars: 1,
  };
  return { hello, bars, manifest, kitManifest };
}

export class Replay {
  constructor(hello, bars) {
    this.hello = structuredClone(hello);
    this.bars = bars;
    this.cash = BigInt(hello.capital.quote_units);
    this.qty = this.cost = 0n;
    this.latest = null;
    this.seq = 0;
    this.awaiting = false;
    this.finished = false;
    this.pending = [];
    this.used = new Set();
    this.replies = [];
    this.resolutions = [];
    this.marks = [this.cash];
    this.messages = [this.hello];
  }
  account() {
    return { cash_quote_units: String(this.cash),
      positions: this.qty ? [{ symbol: this.hello.symbols[0].symbol, qty: String(this.qty), cost_quote_units: String(this.cost) }] : [],
      equity_quote_units: String(this.cash + (this.qty ? value(this.qty, BigInt(this.latest.c), this.hello) : 0n)) };
  }
  nextBatch() {
    if (this.finished || this.awaiting) throw Error('batch requested out of lockstep');
    if (this.seq >= this.bars.length) return null;
    const bar = this.bars[this.seq];
    const fills = [];
    const pool = bar ? new Pool(bar.o_depth, this.hello.capital.quote_scale) : null;
    for (const p of this.pending) {
      let reason = p.reason;
      let f = null;
      if (!reason && !bar) reason = 'no_bar';
      if (!reason) {
        f = p.order.side === 'buy'
          ? buyFill(p.amount, BigInt(bar.o), pool, this.hello)
          : sellFill(p.amount, BigInt(bar.o), pool, this.hello);
        const limit = BigInt(p.order.max_slippage_bps);
        if (p.order.side === 'buy' ? f.price * BPS > p.close * (BPS + limit)
          : f.price * BPS < p.close * (BPS - limit)) reason = 'max_slippage';
        else if (!f.qty) reason = 'zero_amount';
      }
      if (!reason) {
        pool.reserve = f.next;
        if (p.order.side === 'buy') {
          this.cash -= p.amount;
          this.qty += f.qty;
          this.cost += p.amount;
        } else {
          this.cash += f.notional;
          this.cost = this.cost * (this.qty - p.amount) / this.qty;
          this.qty -= p.amount; // Exactly once, after the proportional cost update.
        }
      }
      const fill = this.fillRecord(p, reason, f);
      fills.push(fill);
      this.resolutions.push({ ...fill, cash_after_quote_units: String(this.cash), position_after_qty: String(this.qty) });
      if (this.cash < 0n || this.qty < 0n) throw Error('negative account');
    }
    this.pending = [];
    if (bar) this.latest = bar;
    const batch = { type: 'batch', seq: this.seq, t: this.hello.first_close_ms + this.seq * 60000,
      bars: bar ? [bar] : [], fills, account: this.account() };
    this.marks.push(BigInt(batch.account.equity_quote_units));
    this.messages.push(batch);
    this.awaiting = true;
    return batch;
  }
  fillRecord(p, reason, f) {
    return { client_id: p.order.client_id, symbol: p.order.symbol, side: p.order.side,
      status: reason ? 'rejected' : 'filled', reason,
      decided_bar: this.hello.first_close_ms + p.seq * 60000,
      fill_bar: this.hello.first_close_ms + (p.seq + 1) * 60000,
      price: reason ? '0' : String(f.price), qty: reason ? '0' : String(f.qty),
      notional_quote_units: reason ? '0' : String(f.notional), fee_quote_units: reason ? '0' : String(f.fee) };
  }
  submit(reply) {
    if (!this.awaiting || reply.type !== 'reply' || reply.seq !== this.seq) throw Error('reply out of lockstep');
    if (reply.orders.length > 64) throw Error('protocol order cap');
    let spent = 0n, sold = 0n;
    for (const [i, o] of reply.orders.entries()) {
      const amount = BigInt(o.side === 'buy' ? o.notional_quote_units : o.qty);
      const mark = this.latest ? BigInt(this.latest.c) : null;
      let reason = null;
      if (i >= this.hello.caps.max_orders_per_bar) reason = 'max_orders_per_bar';
      else if (this.used.has(o.client_id)) reason = 'duplicate_client_id';
      else if (o.symbol !== this.hello.symbols[0].symbol) reason = 'not_in_universe';
      else if (!amount) reason = 'zero_amount';
      else if (this.seq < (this.hello.warmup_bars ?? 0)) reason = 'warmup';
      else if (this.seq === this.bars.length - 1) reason = 'after_end';
      else if (!this.latest) reason = 'no_bar';
      else if (o.side === 'buy') {
        if (amount < BigInt(this.hello.fees.min_notional_quote_units)) reason = 'below_min_notional';
        else if (amount > this.cash - spent) reason = 'insufficient_cash';
        else if ((value(this.qty, mark, this.hello) + spent + amount) * BPS
          > BigInt(this.hello.caps.max_weight_bps) * BigInt(this.account().equity_quote_units)) reason = 'max_weight';
        if (!reason) spent += amount;
      } else {
        if (amount > this.qty - sold) reason = 'insufficient_position';
        else if (amount !== this.qty - sold && value(amount, mark, this.hello)
          < BigInt(this.hello.fees.min_notional_quote_units)) reason = 'below_min_notional';
        if (!reason) sold += amount;
      }
      this.used.add(o.client_id);
      this.pending.push({ order: o, amount, reason, close: mark, seq: this.seq });
    }
    this.replies.push(structuredClone(reply));
    this.seq++;
    this.awaiting = false;
  }
  finish() {
    if (this.awaiting || this.finished || this.seq !== this.bars.length) throw Error('premature finish');
    this.finished = true;
    for (const p of this.pending) {
      if (!p.reason) throw Error('last order not rejected');
      this.resolutions.push(this.fillRecord(p, p.reason, null));
    }
    this.pending = [];
    if (this.qty) {
      const f = sellFill(this.qty, BigInt(this.latest.c), new Pool(this.latest.c_depth, this.hello.capital.quote_scale), this.hello);
      this.cash += f.notional;
      this.resolutions.push({ client_id: '_flatten_0', side: 'sell', status: 'filled', reason: null,
        price: String(f.price), qty: String(this.qty), notional_quote_units: String(f.notional), fee_quote_units: String(f.fee) });
      this.qty = this.cost = 0n;
    }
    this.marks.push(this.cash);
    const done = { type: 'done', seq: this.seq, reason: 'end_of_data', account: this.account() };
    this.messages.push(done);
    return done;
  }
  metrics() {
    if (!this.finished) throw Error('score before flatten');
    let peak = this.marks[0], dd = 0;
    for (const e of this.marks) { if (e > peak) peak = e; dd = Math.max(dd, Number(peak - e) / Number(peak)); }
    const filled = this.resolutions.filter(f => f.status === 'filled');
    return { net_pnl_quote_units: String(this.cash - BigInt(this.hello.capital.quote_units)),
      net_pnl_usdc: Number(this.cash - BigInt(this.hello.capital.quote_units)) / 1e6,
      max_drawdown: dd, trades: filled.filter(f => !f.client_id.startsWith('_')).length,
      rejections: this.resolutions.filter(f => f.status === 'rejected').length,
      fees_quote_units: String(filled.reduce((s, f) => s + BigInt(f.fee_quote_units), 0n)) };
  }
}

export function simulate(hello, bars, bot) {
  const sim = new Replay(hello, bars), state = new BarsState(hello);
  bot.onHello?.(state);
  for (let batch; (batch = sim.nextBatch());) {
    state.applyBatch(batch);
    const orders = state.toOrders(bot.onBatch(state, batch));
    state.recordOrders(orders);
    sim.submit({ type: 'reply', seq: batch.seq, orders });
  }
  const done = sim.finish();
  state.applyDone(done);
  bot.onDone?.(state, done);
  return sim;
}
