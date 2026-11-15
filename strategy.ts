// Original causal cbBTC strategy. All thresholds are dimensionless returns, volatility
// multiples, costs from hello, or lengths of rolling observations. No calendar rule.
export const DEFAULTS = Object.freeze({
  mode: 'both', fast: 10, slow: 36, regime: 120, lookback: 60,
  confirm: 3, cooldown: 20, maxHold: 240,
  rebound: 0.004, depression: 0.012, trendReturn: 0.008,
  stopATR: 3, trailATR: 2.5, trailFloor: 0.0045,
  maxExposureBps: 2000, riskBps: 35, killDrawdownBps: 600,
});

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const minBig = (...xs) => xs.reduce((a, b) => a < b ? a : b);

export class RegimeBot {
  constructor(config = {}) {
    this.cfg = { ...DEFAULTS, ...config };
    this.history = [];
    this.fast = this.slow = this.regime = this.atr = null;
    this.pending = null;
    this.coolUntil = -1;
    this.entry = null;
    this.peakEquity = 0n;
    this.halted = false;
    this.above = this.below = 0;
    this.lastTime = null;
    this.lastReason = 'warmup';
  }

  onHello(state) {
    this.symbol = state.symbols.has('CBBTC') ? 'CBBTC' : null;
    this.peakEquity = state.equity;
    this.step = { '1m': 60000, '1h': 3600000, '1d': 86400000 }[state.hello.bar_interval];
  }

  onBatch(state, batch) {
    const c = this.cfg;
    if (state.equity > this.peakEquity) this.peakEquity = state.equity;
    if (state.equity * 10000n <= this.peakEquity * BigInt(10000 - c.killDrawdownBps)) this.halted = true;
    // An intent is never a position. Only the harness's account/fills change ownership.
    for (const f of batch.fills) {
      if (this.pending && f.client_id === this.pending.id) {
        if (f.status === 'filled' && f.side === 'buy') {
          this.entry = { price: Number(f.price), peak: Number(f.price), seq: state.seq,
            stop: this.pending.stop, trail: this.pending.trail, cost: this.pending.cost };
        }
        if (f.side === 'sell' && f.status === 'filled') {
          this.entry = null;
          this.coolUntil = state.seq + c.cooldown;
        }
        if (f.status === 'rejected') this.coolUntil = state.seq + Math.min(5, c.cooldown);
        this.pending = null;
      }
    }
    if (!this.symbol) return [];
    const bar = batch.bars.find(b => b.symbol === this.symbol);
    if (!bar) return []; // Never count a stale close as a fresh observation.
    const price = Number(bar.c);
    const previous = this.history.at(-1) ?? price;
    const gap = this.lastTime !== null && bar.t - this.lastTime > 2 * this.step;
    this.lastTime = bar.t;
    if (gap) {
      this.history = [];
      this.fast = this.slow = this.regime = this.atr = null;
      this.above = this.below = 0;
    }
    const ema = (old, value, n) => old === null ? value : old + 2 / (n + 1) * (value - old);
    const tr = Math.max(Number(bar.h) - Number(bar.l),
      Math.abs(Number(bar.h) - previous), Math.abs(Number(bar.l) - previous));
    this.fast = ema(this.fast, price, c.fast);
    this.slow = ema(this.slow, price, c.slow);
    this.regime = ema(this.regime, price, c.regime);
    this.atr = ema(this.atr, tr / price, 24);
    this.history.push(price);
    if (this.history.length > 2 * c.regime + 1) this.history.shift();
    this.above = this.fast > this.slow ? this.above + 1 : 0;
    this.below = this.fast < this.slow ? this.below + 1 : 0;
    const held = state.positions.get(this.symbol);
    if (state.warmingUp || this.pending) return [];
    const sell = reason => {
      this.lastReason = reason;
      const id = state.clientId();
      this.pending = { id, side: 'sell' };
      return [{ side: 'sell', symbol: this.symbol, client_id: id, qty: held.qty,
        max_slippage_bps: 10000 }]; // Exit remains executable after an adverse gap.
    };
    if (held) {
      if (!this.entry) {
        // Account is authoritative even if a position was not opened by our last intent.
        const spec = state.symbols.get(this.symbol);
        this.entry = { price: Number(held.cost * 10n ** BigInt(spec.qty_scale + spec.price_scale)
          / (held.qty * 10n ** BigInt(state.hello.capital.quote_scale))), peak: price,
          seq: state.seq, stop: 0.006, trail: 0.0045, cost: 0.002 };
      }
      const e = this.entry;
      e.peak = Math.max(e.peak, price);
      const age = state.seq - e.seq;
      if (this.halted) return sell('drawdown halt');
      if (price <= e.price * (1 - e.stop)) return sell('stop');
      if (price <= e.peak * (1 - e.trail)) return sell('trail');
      if (this.below >= c.confirm && price < this.slow && age >= c.fast) return sell('regime exit');
      if (age >= c.maxHold || (age >= c.lookback && price / e.price - 1 < e.cost)) return sell('stale thesis');
      // Rebalance only to reduce excessive concentration after a large appreciation.
      if (state.value(this.symbol, held.qty) * 10000n > state.equity * 2300n) return sell('exposure cap');
      return [];
    }
    this.entry = null;
    if (this.halted || gap || state.seq < this.coolUntil || this.history.length < c.regime) return [];
    const h = this.history;
    const window = h.slice(-c.lookback);
    const low = Math.min(...window), high = Math.max(...h.slice(-c.regime));
    const ret = n => price / h[h.length - 1 - n] - 1;
    const momentum = ret(c.fast);
    const rebound = price / low - 1;
    const depression = 1 - low / high;
    const trend = this.slow > this.regime && price > this.regime && ret(c.lookback - 1) > c.trendReturn;
    const reversal = depression > c.depression && rebound > Math.max(c.rebound, 2 * this.atr)
      && momentum > Math.max(c.rebound / 2, this.atr);
    const signal = this.above >= c.confirm && price > this.fast && momentum > 0
      && ((c.mode !== 'reversal' && trend) || (c.mode !== 'trend' && reversal));
    if (!signal) return [];
    const stop = clamp(c.stopATR * this.atr, 0.006, 0.018);
    const trail = clamp(c.trailATR * this.atr, c.trailFloor, 0.012);
    const exposure = Math.min(c.maxExposureBps, Math.floor(c.riskBps / stop));
    // Cash reserve is measured from the observed equity peak. At entry at least
    // 80% of that peak remains cash; impact is estimated only at the known close.
    const reserveRoom = state.cash - this.peakEquity * 8000n / 10000n;
    if (reserveRoom <= 0n) return [];
    let amount = minBig(state.cash, state.weightRoom(this.symbol), reserveRoom,
      state.equity * BigInt(exposure) / 10000n);
    const depths = state.depthAt(this.symbol);
    if (!depths || depths.some(d => d <= 0n)) return [];
    // Keep one-way impact below 5 bps; scale cash units to depth's micro-USDC.
    const inverseDepth = depths.reduce((s, d) => s + 1 / Number(d), 0);
    const depthBudget = BigInt(Math.floor(0.0005 / inverseDepth
      * 10 ** state.hello.capital.quote_scale / 1e6));
    amount = minBig(amount, depthBudget);
    if (amount < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const fee = state.hello.fees.fee_bps / 10000;
    const slip = state.hello.fees.slippage_bps / 10000;
    const impact = Number(amount) * 1e6 / 10 ** state.hello.capital.quote_scale * inverseDepth;
    const cost = 2 * (fee + slip + impact) + 0.0001; // Rounding/small-gap allowance.
    const opportunity = Math.max(high / low - 1, 4 * this.atr);
    if (opportunity < 3 * cost || momentum < cost / 2) return [];
    const id = state.clientId();
    this.pending = { id, side: 'buy', stop, trail, cost };
    this.lastReason = reversal ? 'confirmed reversal' : 'confirmed trend';
    return [{ side: 'buy', symbol: this.symbol, client_id: id, notional_quote_units: amount,
      max_slippage_bps: Math.ceil(clamp((slip + impact + 3 * this.atr) * 10000, 30, 150)) }];
  }
}
