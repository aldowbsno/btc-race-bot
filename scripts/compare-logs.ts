import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir=process.argv[2]??'reports/repro';
const expected=readFileSync(`${dir}/expected.ndjson`);
const one=readFileSync(`${dir}/run1.ndjson`),two=readFileSync(`${dir}/run2.ndjson`);
assert.deepEqual(one,two,'two actual entrypoint runs differ');
assert.deepEqual(one,expected,'actual runtime differs from causal simulated decisions');
const replies=one.toString().trim().split('\n').map(JSON.parse);
assert.equal(replies.length,1440);
for(const [seq,r] of replies.entries()){
  assert.equal(r.type,'reply');assert.equal(r.seq,seq);assert(r.orders.length<=1);
}
const summary={actual_entrypoint_runs:2,replies:replies.length,byte_identical:true,
  matches_causal_simulator:true,sha256:createHash('sha256').update(one).digest('hex'),node_version:process.version};
writeFileSync('reports/determinism.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
