// grade-local's JSON summary omits the internal executions array. Its official
// `finished` status means both executions succeeded with byte-identical logs.
export function profitableOfficialGrade(exit, result) {
  try {
    const score=result?.result;
    const m=score?.performance?.kind==='bars-replay/v1'?score.performance.metrics:null;
    const digest=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
    return Boolean(exit===0&&result.status==='finished'&&result.error===null
      &&result.competition==='btc-race-24h-20261117-0603'&&result.phase==='dev'
      &&m&&BigInt(m.net_pnl_quote_units)>0n&&Number(m.max_drawdown)>=0
      &&Number(m.max_drawdown)<=0.25&&m.trades>=1
      &&m.constraints?.compliant===true&&m.contamination?.no_future_bars===true
      &&result.l1?.reproduced===true&&digest(result.result_sha256)
      &&digest(result.action_log_sha256)&&result.action_log_sha256===score.action_log_sha256
      &&Array.isArray(score.flags)&&!score.flags.includes('nondeterministic'));
  } catch { return false; }
}
