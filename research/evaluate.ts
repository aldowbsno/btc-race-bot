// Reproducible development experiments, never imported by main.ts.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadDev, simulate } from './simulator.ts';
import { RegimeBot, DEFAULTS } from '../strategy.ts';

const kit = process.argv[2];
if (!kit) throw Error('usage: node research/evaluate.ts <official-kit> [output.json]');
const data = loadDev(kit);
const initial = { mode:'both', lookback:60, fast:10, slow:36, trendReturn:0.008, trailFloor:0.0045 };
const hypotheses = [
  ['previous window defaults', initial], ['previous trend only', {...initial,mode:'trend'}],
  ['previous reversal only', {...initial,mode:'reversal'}],
  ['half-hour trend with previous trail', {trailFloor:0.0045}],
  ['lower trend threshold', {trendReturn:0.008}],
  ['higher trend threshold', {trendReturn:0.012}],
  ['shorter trend window', {lookback:24}],
  ['longer trend window', {lookback:36}],
  ['two-hour trend window', {lookback:120}],
  ['selected stable neighborhood', {}],
];
const evaluate = (cfg, bars = data.bars, fees = 4) => {
  const h = structuredClone(data.hello); h.first_close_ms = bars[0].t; h.fees.fee_bps = fees;
  return simulate(h,bars,new RegimeBot(cfg));
};
const candidates = hypotheses.map(([name,config]) => ({name,config:{...DEFAULTS,...config},...evaluate(config).metrics()}));
const sensitivity = [];
for (const lookback of [24,30,36]) for (const trendReturn of [0.008,0.01,0.012]) for (const trailFloor of [0.0025,0.003,0.0035]) {
  const config = {lookback,trendReturn,trailFloor};
  sensitivity.push({config,...evaluate(config).metrics()});
}
const subperiods = [];
for (const length of [360,720]) for (let start=0;start+length<=data.bars.length;start+=length) {
  subperiods.push({start_bar:start,bars:length,initialization:'fresh cash and cold indicators',
    ...evaluate({},data.bars.slice(start,start+length)).metrics()});
}
const rolling = [];
for (let start=0;start+720<=data.bars.length;start+=120) rolling.push({start_bar:start,bars:720,...evaluate({},data.bars.slice(start,start+720)).metrics()});
// Fee and slippage scenarios rerun the policy: changing costs can change entries,
// not merely subtract a constant from the originally selected trade log.
const executionSensitivity = [];
for (const feeBps of [0, 4, 8, 12, 20]) {
  for (const slippageBps of [0, 2, 5, 10, 20]) {
    const scenarioHello = structuredClone(data.hello);
    scenarioHello.fees.fee_bps = feeBps;
    scenarioHello.fees.slippage_bps = slippageBps;
    executionSensitivity.push({fee_bps: feeBps, slippage_bps: slippageBps,
      ...simulate(scenarioHello, data.bars, new RegimeBot()).metrics()});
  }
}
const selected = evaluate({});
const hash = replies => createHash('sha256').update(replies.map(r=>JSON.stringify(r)+'\n').join('')).digest('hex');
const repeat = evaluate({});
if (hash(selected.replies) !== hash(repeat.replies)) throw Error('nondeterministic simulation');
let flow=0n, trips=[];
for(const f of selected.resolutions) if(f.status==='filled') {
  flow += (f.side==='buy' ? -1n : 1n)*BigInt(f.notional_quote_units);
  if(f.side==='sell'&&(!f.position_after_qty||f.position_after_qty==='0')) {trips.push(Number(flow)/1e6);flow=0n;}
}
const blockPnl = [];
for(let start=0;start<data.bars.length;start+=360) {
  const end=Math.min(start+360,data.bars.length);
  const after=end===data.bars.length?selected.marks.at(-1):selected.marks[end];
  blockPnl.push({start_bar:start,bars:end-start,marked_pnl_usdc:Number(after-selected.marks[start])/1e6});
}
const pnl = selected.metrics().net_pnl_usdc;
const report = {
  kind:'independent simulator research; not a grade-local result',
  dataset_sha256:data.kitManifest.dataset_sha256,
  bar_stream_sha256:data.manifest.dataset_sha256,
  market_return:Number(data.bars.at(-1).c)/Number(data.bars[0].o)-1,
  selected_config:DEFAULTS, selected:selected.metrics(),
  identical_action_logs:hash(selected.replies)===hash(repeat.replies),
  action_log_sha256:hash(selected.replies),
  doubled_fees_with_policy_redecision:evaluate({},data.bars,8).metrics(),
  hypotheses:candidates, sensitivity, execution_sensitivity:executionSensitivity,
  sensitivity_profitable:sensitivity.filter(x=>x.net_pnl_usdc>0).length,
  sensitivity_total:sensitivity.length,
  subperiods, rolling_half_days:rolling, marked_six_hour_blocks:blockPnl,
  round_trip_pnl_usdc:trips,
  pnl_without_best_round_trip_usdc:pnl-Math.max(...trips),
  limitations:['All development uses the same published day; subperiods are not independent held-out data.',
    'Full-day profit may rely on a single rebound. Parameter testing creates selection bias.',
    'Stops execute one open later; gaps, unavailable bars and impact can exceed a risk target.'],
};
const output=process.argv[3]??'reports/research.json';
mkdirSync(output.substring(0,output.lastIndexOf('/'))||'.',{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,selected:report.selected,doubled_fees:report.doubled_fees_with_policy_redecision,
  sensitivity_profitable:report.sensitivity_profitable,sensitivity_total:report.sensitivity_total,
  subperiods,without_best:report.pnl_without_best_round_trip_usdc},null,2));
