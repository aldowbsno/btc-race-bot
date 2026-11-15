import test from 'node:test';
import assert from 'node:assert/strict';
import {profitableOfficialGrade} from '../scripts/grade-gate.ts';

// Minimal example of the kit's public JSON summary shape, not a claimed grade.
const summary=()=>({competition:'btc-race-24h-20261115-0828',phase:'dev',status:'finished',error:null,
  result_sha256:'1'.repeat(64),action_log_sha256:'2'.repeat(64),l1:{reproduced:true},
  result:{action_log_sha256:'2'.repeat(64),flags:[],performance:{kind:'bars-replay/v1',metrics:{
    net_pnl_quote_units:'1',max_drawdown:'0.250000000',trades:1,
    constraints:{compliant:true},contamination:{no_future_bars:true}}}}});

test('host gate accepts the real public summary shape without an internal executions array',()=>{
  assert.equal(profitableOfficialGrade(0,summary()),true);
});
test('missing, failed or nondeterministic grades never pass',()=>{
  assert.equal(profitableOfficialGrade(1,null),false);
  assert.equal(profitableOfficialGrade(1,summary()),false);
  for(const status of ['failed','timeout','nondeterministic']){
    const s=summary();s.status=status;assert.equal(profitableOfficialGrade(0,s),false);
  }
});
test('profit, drawdown, trades, causality and reproduced score are all required',()=>{
  for(const [key,value] of [['net_pnl_quote_units','0'],['net_pnl_quote_units','-1'],
    ['max_drawdown','0.250000001'],['max_drawdown','NaN'],['trades',0]]){
    const s=summary();s.result.performance.metrics[key]=value;
    assert.equal(profitableOfficialGrade(0,s),false,key);
  }
  const s=summary();s.result.performance.metrics.contamination.no_future_bars=false;
  assert.equal(profitableOfficialGrade(0,s),false);
  const t=summary();t.l1.reproduced=false;assert.equal(profitableOfficialGrade(0,t),false);
});
test('wrong competition or inconsistent action-log digest fails closed',()=>{
  const s=summary();s.competition='another-race';assert.equal(profitableOfficialGrade(0,s),false);
  const t=summary();t.result.action_log_sha256='3'.repeat(64);assert.equal(profitableOfficialGrade(0,t),false);
});
