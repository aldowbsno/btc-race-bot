import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool, Replay, buyFill, sellFill, value, simulate } from '../research/simulator.ts';
import { BarsState } from '../vendor/makefun-bars.ts';
import { RegimeBot } from '../strategy.ts';

export const hello = {
  type: 'hello', protocol: 'agent-fun/bars-replay/v1', seed: '7',
  symbols: [{ symbol: 'CBBTC', mint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij', price_scale: 5, qty_scale: 8 }],
  capital: { quote: 'USDC', quote_scale: 6, quote_units: '1000000000' }, bar_interval: '1m',
  first_close_ms: 60000, caps: { max_open_positions: 1, max_orders_per_bar: 16, max_weight_bps: 10000, shorts: false, leverage: false },
  fees: { fee_bps: 0, slippage_bps: 0, min_notional_quote_units: '1000000' }, latency_bars: 1,
};
export const bar = (t, o = 10000000n, c = o, depth = '1000000000000000000') => ({
  symbol: 'CBBTC', t, o: String(o), h: String(o > c ? o : c), l: String(o < c ? o : c), c: String(c),
  v: null, o_depth: [depth], c_depth: [depth],
});
const buy = (id = 'b', amount = '100000000', bps = 10000) => ({ side: 'buy', symbol: 'CBBTC', client_id: id,
  notional_quote_units: amount, max_slippage_bps: bps });
const sell = (qty, id = 's', bps = 10000) => ({ side: 'sell', symbol: 'CBBTC', client_id: id, qty: String(qty), max_slippage_bps: bps });
const reply = (s, orders = []) => s.submit({ type: 'reply', seq: s.seq, orders });
const fixture = () => new Replay(hello, [bar(60000), bar(120000), bar(180000), bar(240000)]);

test('price5 x qty8 converts exactly to micro-USDC, SDK agrees', () => {
  const q = 12345678n, p = 6715566462n;
  assert.equal(value(q, p, hello), 8290822112n);
  assert.equal(new BarsState(hello).value('CBBTC', q, p), value(q, p, hello));
});

test('decision does not change account; buy fills only at next open', () => {
  const s = new Replay(hello, [bar(60000), bar(120000, 20000000n), bar(180000, 20000000n)]);
  const b0 = s.nextBatch();
  reply(s, [buy()]);
  assert.equal(s.cash, 1000000000n);
  assert.equal(s.qty, 0n);
  const b1 = s.nextBatch();
  assert.equal(b0.fills.length, 0);
  assert.equal(s.cash, 900000000n);
  assert.equal(s.qty, 50000000n); // $100 buys 0.5 units at next open $200.
  assert.equal(b1.fills[0].decided_bar, 60000);
  assert.equal(b1.fills[0].fill_bar, 120000);
  assert.equal(b1.account.equity_quote_units, '1000000000');
});

test('sell removes quantity once; partial cost and cash remain consistent', () => {
  const s = fixture(); s.nextBatch(); reply(s, [buy()]); s.nextBatch();
  reply(s, [sell(40000000n)]); const b = s.nextBatch();
  assert.equal(s.qty, 60000000n);
  assert.equal(s.cost, 60000000n);
  // Integer sell price floors one tick for any nonzero impact: $99.99999.
  assert.equal(s.cash, 939999996n);
  assert.equal(b.account.equity_quote_units, '999999996');
  reply(s, [sell(s.qty, 'rest')]); s.nextBatch();
  assert.equal(s.qty, 0n); assert.equal(s.cost, 0n);
  assert.equal(s.cash, 999999990n);
});

test('fee and slip plus depth impact have their stated units', () => {
  const h = structuredClone(hello); h.fees.fee_bps = 4; h.fees.slippage_bps = 2;
  const pool = new Pool(['1000000000000']); // One million USDC, not one million quote units.
  const b = buyFill(200000000n, 10000000000n, pool, h);
  assert.equal(b.fee, 80000n);
  assert.equal(b.price, 10003999599n);
  assert.equal(b.qty, 199840n);
  const exit = sellFill(b.qty, 10000000000n, new Pool(['1000000000000']), h);
  assert.equal(exit.price, 9996002398n);
  assert.equal(exit.notional, 199680206n);
  assert.equal(200000000n - exit.notional, 319794n); // 15.99 bps round trip at $200.
});

test('slippage rejection leaves cash, position and pool untouched', () => {
  const s = new Replay(hello, [bar(60000), bar(120000, 20000000n), bar(180000)]);
  s.nextBatch(); reply(s, [buy('bad', '100000000', 1), buy('ok')]);
  const b = s.nextBatch();
  assert.equal(b.fills[0].reason, 'max_slippage');
  assert.equal(b.fills[1].status, 'filled');
  assert.equal(s.cash, 900000000n); assert.equal(s.qty, 50000000n);
});

test('missing next bar rejects pending order instead of filling a stale quote', () => {
  const s = new Replay(hello, [bar(60000), null, bar(180000)]);
  s.nextBatch(); reply(s, [buy()]);
  const b = s.nextBatch(); assert.deepEqual(b.bars, []);
  assert.equal(b.fills[0].reason, 'no_bar'); assert.equal(s.cash, 1000000000n);
});

test('sell proceeds cannot fund a buy in the same reply', () => {
  const s = fixture(); s.nextBatch(); reply(s, [buy('all', '1000000000')]); s.nextBatch();
  reply(s, [sell(s.qty), buy('unfunded')]);
  const b = s.nextBatch(); assert.equal(b.fills[0].status, 'filled');
  assert.equal(b.fills[1].reason, 'insufficient_cash'); assert.equal(s.qty, 0n);
});

test('last-bar intent rejected and final holdings flattened with costs', () => {
  const s = fixture(); s.nextBatch(); reply(s, [buy()]); s.nextBatch(); reply(s);
  s.nextBatch(); reply(s); s.nextBatch(); reply(s, [sell(s.qty)]);
  const done = s.finish();
  assert.equal(s.resolutions.at(-2).reason, 'after_end');
  assert.equal(s.resolutions.at(-1).client_id, '_flatten_0');
  assert.equal(done.account.cash_quote_units, '999999990');
  assert.deepEqual(done.account.positions, []);
  assert.equal(s.metrics().trades, 1); // flatten is not an authored trade.
});

test('split buys walk the same pool and never improve the price', () => {
  const p = new Pool(['10000000000']);
  const whole = buyFill(200000000n, 10000000000n, p, hello);
  const first = buyFill(100000000n, 10000000000n, p, hello); p.reserve = first.next;
  const second = buyFill(100000000n, 10000000000n, p, hello);
  assert(second.price > first.price);
  assert(first.qty + second.qty <= whole.qty + 1n); // at most one quantity tick of rounding.
});

test('duplicate IDs, cap, min notional, and warmup rejections', () => {
  const h = structuredClone(hello); h.warmup_bars = 1; h.caps.max_orders_per_bar = 2;
  const s = new Replay(h, [bar(60000), bar(120000), bar(180000)]);
  s.nextBatch(); reply(s, [buy('used')]);
  assert.equal(s.nextBatch().fills[0].reason, 'warmup');
  reply(s, [buy('used'), buy('small', '10'), buy('excess')]);
  const b = s.nextBatch();
  assert.deepEqual(b.fills.map(f => f.reason), ['duplicate_client_id', 'below_min_notional', 'max_orders_per_bar']);
});

test('lockstep prevents a future batch before a reply and early finish', () => {
  const s = fixture(); s.nextBatch();
  assert.throws(() => s.nextBatch(), /lockstep/);
  assert.throws(() => s.finish(), /premature/);
  assert.throws(() => s.submit({type:'reply',seq:10,orders:[]}), /lockstep/);
});

test('cash-only bot earns precisely zero, including flatten', () => {
  const s = simulate(hello, [bar(60000), bar(120000)], {onBatch: () => []});
  assert.equal(s.metrics().net_pnl_quote_units, '0');
  assert.equal(s.metrics().trades, 0);
});

test('future price changes cannot alter prefix decisions', () => {
  const bars = Array.from({length:300}, (_,i) => bar((i+1)*60000, BigInt(10000000 + (i<150 ? -i*1000 : (i-300)*1000))));
  const modified = structuredClone(bars);
  for (let i=230;i<300;i++) modified[i] = bar((i+1)*60000, 7000000n);
  const a=simulate(hello,bars,new RegimeBot()), b=simulate(hello,modified,new RegimeBot());
  assert.deepEqual(a.replies.slice(0,230),b.replies.slice(0,230));
});

test('pending intent blocks duplicate buys until the fill resolves', () => {
  const bot = new RegimeBot(); const state = new BarsState(hello); bot.onHello(state);
  bot.pending = {id:'pending',side:'buy'};
  state.applyBatch({type:'batch',seq:0,t:60000,bars:[bar(60000)],fills:[],account:state.account});
  assert.deepEqual(bot.onBatch(state,{bars:[bar(60000)],fills:[]}),[]);
  assert.equal(bot.pending.id,'pending');
  bot.onBatch(state,{bars:[bar(60000)],fills:[{client_id:'pending',status:'rejected',side:'buy'}]});
  assert.equal(bot.pending,null); assert.equal(bot.entry,null);
});
