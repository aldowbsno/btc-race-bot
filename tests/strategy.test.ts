import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../research/simulator.ts';
import { RegimeBot } from '../strategy.ts';
import { BarsState } from '../vendor/makefun-bars.ts';

const h = {
  type:'hello',protocol:'agent-fun/bars-replay/v1',seed:'1',
  symbols:[{symbol:'CBBTC',mint:'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',price_scale:5,qty_scale:8}],
  capital:{quote:'USDC',quote_scale:6,quote_units:'1000000000'},bar_interval:'1m',first_close_ms:60000,
  caps:{max_open_positions:1,max_orders_per_bar:16,max_weight_bps:10000,shorts:false,leverage:false},
  fees:{fee_bps:4,slippage_bps:2,min_notional_quote_units:'1000000'},latency_bars:1,
};
const series = (prices,shift=0) => prices.map((p,i) => ({symbol:'CBBTC',t:(i+1)*60000+shift,
  o:String(p),h:String(p),l:String(p),c:String(p),v:null,o_depth:['1000000000000'],c_depth:['1000000000000']}));

test('flat and monotonically falling prices do not force a trade',()=>{
  for(const prices of [Array(500).fill(10000000000),Array.from({length:500},(_,i)=>10000000000-i*500000)]){
    const s=simulate(h,series(prices),new RegimeBot());
    assert.equal(s.metrics().trades,0); assert.equal(s.metrics().net_pnl_quote_units,'0');
  }
});

test('trend branch participates in a sustained rise without a prior depression',()=>{
  const prices=Array.from({length:500},(_,i)=>10000000000+i*2000000);
  const s=simulate(h,series(prices),new RegimeBot());
  assert(s.metrics().trades>0); assert(s.metrics().net_pnl_usdc>0);
  for(const r of s.resolutions) if(r.side==='buy'&&r.status==='filled') {
    assert(BigInt(r.notional_quote_units)<=BigInt(r.cash_after_quote_units)/4n+1n);
  }
});

test('observed timestamps and seed cannot act as a hidden dev schedule',()=>{
  const prices=Array.from({length:500},(_,i)=>10000000000+Math.round(Math.sin(i/70)*200000000)+i*200000);
  const a=simulate(h,series(prices),new RegimeBot());
  const changed=structuredClone(h);changed.first_close_ms+=7776000000;changed.seed='987654321';
  const b=simulate(changed,series(prices,7776000000),new RegimeBot());
  assert.deepEqual(a.replies,b.replies);
});

test('pending sell stays a position until filled; trailing stop uses closes',()=>{
  const bot=new RegimeBot(),state=new BarsState(h);bot.onHello(state);
  const account={cash_quote_units:'800000000',positions:[{symbol:'CBBTC',qty:'200000',cost_quote_units:'200000000'}],equity_quote_units:'1000000000'};
  const b={type:'batch',seq:100,t:6060000,bars:series([9700000000],6000000),fills:[],account};
  state.applyBatch(b);
  bot.entry={price:10000000000,peak:10100000000,seq:90,stop:0.006,trail:0.0045,cost:0.002};
  const orders=bot.onBatch(state,b);
  assert.equal(orders.length,1);assert.equal(orders[0].side,'sell');
  assert.equal(state.positions.get('CBBTC').qty,200000n);
  assert.equal(bot.pending.side,'sell');
  state.applyBatch({...b,seq:101,t:6120000,bars:series([9600000000],6060000)});
  assert.deepEqual(bot.onBatch(state,{...b,fills:[]}),[]);
});

test('filled sell starts cooldown; rejected intent never fabricates a position',()=>{
  const bot=new RegimeBot(),state=new BarsState(h);bot.onHello(state);
  bot.pending={id:'exit',side:'sell'};bot.entry={price:1,peak:1,seq:0};
  const b={type:'batch',seq:25,t:1560000,bars:series([10000000000],1500000),
    fills:[{client_id:'exit',side:'sell',status:'filled'}],account:state.account};
  state.applyBatch(b);assert.deepEqual(bot.onBatch(state,b),[]);
  assert.equal(bot.entry,null);assert.equal(bot.coolUntil,45);assert.equal(bot.pending,null);
});

test('drawdown halt is sticky and liquidates using the account quantity',()=>{
  const bot=new RegimeBot(),state=new BarsState(h);bot.onHello(state);
  const account={cash_quote_units:'800000000',positions:[{symbol:'CBBTC',qty:'150000',cost_quote_units:'200000000'}],equity_quote_units:'930000000'};
  const b={type:'batch',seq:5,t:360000,bars:series([8666666666],300000),fills:[],account};
  state.applyBatch(b);const orders=bot.onBatch(state,b);
  assert(bot.halted);assert.equal(orders[0].side,'sell');assert.equal(orders[0].qty,150000n);
  assert.equal(orders[0].max_slippage_bps,10000);
  state.equity=1100000000n;bot.pending=null;bot.onBatch(state,b);assert(bot.halted);
});

test('a severe gap while exposed trips the kill switch and stays below 25% in this stress',()=>{
  const prices=Array.from({length:320},(_,i)=>i<180?10000000000+i*2000000:2000000000);
  const bot=new RegimeBot(),s=simulate(h,series(prices),bot);
  assert(s.metrics().trades>=2);assert(bot.halted);
  assert(s.metrics().max_drawdown<0.25);
  assert.equal(s.qty,0n);
});
