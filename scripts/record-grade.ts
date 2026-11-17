import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {profitableOfficialGrade} from './grade-gate.ts';

const exit=Number(process.argv[2]);
const raw=readFileSync('reports/official/summary.json','utf8');
const stderr=readFileSync('reports/official/stderr.txt','utf8');
let result=null,parseError=null;
try {result=JSON.parse(raw);} catch(e) {parseError=e.message;}
const metrics=result?.result?.performance?.kind==='bars-replay/v1'?result.result.performance.metrics:null;
const passed=profitableOfficialGrade(exit,result);
const runtimeFiles=['main.ts','strategy.ts','vendor/makefun-bars.ts','package.json'];
const report={command:'node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot <repo> --worktree --driver process --save <artifacts> --json',
  local_runtime:{node:process.version,node_options:process.env.NODE_OPTIONS??null},
  exit_code:exit,status:passed?'passed':(result?.status??'blocked before score'),
  official_grade_gate_passed:Boolean(passed),metrics,stderr,parse_error:parseError,
  runtime_sha256:Object.fromEntries(runtimeFiles.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))};
writeFileSync('reports/grade-local-attempt.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!passed) {
  console.error('Official profitable-dev gate NOT established. Do not submit until grade-local completes and this gate passes.');
  process.exitCode=2;
}
