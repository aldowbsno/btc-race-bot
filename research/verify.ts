import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadDev, simulate, Replay } from './simulator.ts';
import { officialEngine, engineDataset } from './official-engine.ts';
import { RegimeBot } from '../strategy.ts';

const kit = process.argv[2], out = process.argv[3] ?? 'reports/repro';
if (!kit) throw Error('usage: node research/verify.ts <official-kit> [output-directory]');
mkdirSync(out, {recursive:true});
const d = loadDev(kit);
// Check every kit file before treating its bundled engine as an independent reference.
const km = JSON.parse(readFileSync(`${kit}/kit.json`,'utf8'));
for(const f of km.files) {
  const bytes=readFileSync(`${kit}/${f.path}`);
  assert.equal(bytes.length,f.size,`kit size ${f.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,`kit hash ${f.path}`);
}
assert.deepEqual(readFileSync('vendor/makefun-bars.ts'),readFileSync(`${kit}/sdk/makefun-bars.ts`));
const a=simulate(d.hello,d.bars,new RegimeBot()), b=simulate(d.hello,d.bars,new RegimeBot());
const lines = xs => xs.map(x=>JSON.stringify(x)+'\n').join('');
assert.equal(lines(a.replies),lines(b.replies));
writeFileSync(`${out}/input.ndjson`,lines(a.messages));
writeFileSync(`${out}/expected.ndjson`,lines(a.replies));

const report = await officialEngine(kit,async (Engine,scoreLog,official)=>{
  const verification=official.verifyBarsDataset(`${kit}/dataset`);
  assert(verification.ok,JSON.stringify(verification.problems));
  const frozen=await official.readFrozenBarsDataset(`${kit}/dataset`,{expectSha256:km.dataset_sha256});
  const compare = (hello,bars,local,frozenDataset=null) => {
    const dataset=frozenDataset??engineDataset(hello,bars,km.dataset_sha256);
    const engine=new Engine(dataset,hello);
    for(let batch;(batch=engine.nextBatch());){
      assert.deepEqual(batch,local.messages[batch.seq+1],`official batch ${batch.seq}`);
      engine.submit(local.replies[batch.seq]);
    }
    const result=engine.finish();
    assert.deepEqual(result.done,local.messages.at(-1),'official final account');
    for(let i=0;i<result.run.resolutions.length;i++) {
      const actual=local.resolutions[i];
      const expected=result.run.resolutions[i];
      for(const key of ['client_id','side','status','reason','price','qty','notional_quote_units','fee_quote_units']) {
        assert.equal(actual[key],expected[key],`resolution ${i} ${key}`);
      }
    }
    return {dataset,run:result.run};
  };
  const {dataset,run}=compare(d.hello,d.bars,a,frozen.dataset);
  const params={guardrails:{min_trades:1,min_distinct_symbols:0,max_drawdown:'0.250000000'},
    interval:{level:'0.900000000',resamples:1000,block_hours:1},final_window:null};
  const scored=scoreLog(dataset,run.action_log,params);
  assert.equal(scored.metrics.net_pnl_quote_units,a.metrics().net_pnl_quote_units);
  assert(scored.metrics.constraints.compliant);
  assert(BigInt(scored.metrics.net_pnl_quote_units)>0n);
  // Exercise split orders, same-bar mixed sides, depleted cash, duplicate IDs,
  // partial exits, decision caps and fill slippage, with deterministic test inputs.
  let cases=0;
  for(let seed=1;seed<=8;seed++) {
    const bars=d.bars.slice(0,180).map((bar,i)=>i===40?null:bar);
    const local=new Replay(d.hello,bars);
    let n=0;
    for(let batch;(batch=local.nextBatch());){
      const orders=[];
      const mode=(batch.seq*17+seed*13)%11;
      const buy=(amount,id=`case${seed}-${n++}`,slip=10000)=>({side:'buy',symbol:'CBBTC',client_id:id,
        notional_quote_units:String(amount),max_slippage_bps:slip});
      const sell=qty=>({side:'sell',symbol:'CBBTC',client_id:`case${seed}-${n++}`,qty:String(qty),max_slippage_bps:10000});
      if(mode<3) {orders.push(buy(local.cash/3n));orders.push(buy(local.cash/3n));}
      else if(mode===3&&local.qty) orders.push(sell(local.qty/2n));
      else if(mode===4&&local.qty) {orders.push(sell(local.qty));orders.push(buy(local.cash+1000000n));}
      else if(mode===5) {orders.push(buy(2000000n,'duplicate'));orders.push(buy(2000000n,'duplicate'));}
      else if(mode===6) orders.push(buy(1n));
      else if(mode===7) orders.push(buy(10000000n,undefined,0));
      else if(mode===8&&local.qty) {orders.push(sell(local.qty));orders.push(sell(local.qty));}
      else if(mode===9) for(let i=0;i<17;i++) orders.push(buy(1000000n));
      local.submit({type:'reply',seq:batch.seq,orders});
    }
    local.finish(); compare(d.hello,bars,local); cases++;
  }
  return {kind:'official bundled data verifier, engine and scorer in process; NOT grade-local, repository intake or container validation',
    kit_cli_sha256:km.files.find(f=>f.path==='cli/makefun.mjs').sha256,
    dataset_sha256:km.dataset_sha256,bar_stream_sha256:d.manifest.dataset_sha256,hello_seed:d.hello.seed,
    official_dataset_verification:verification,
    every_dev_batch_fill_and_account_matches:true,differential_synthetic_order_cases:cases,
    metrics:scored.metrics,independent_simulator:a.metrics(),
    action_log_sha256:createHash('sha256').update(lines(a.replies)).digest('hex')};
});
writeFileSync(`${out}/engine-verification.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync('reports/engine-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
