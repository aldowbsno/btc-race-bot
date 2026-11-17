Measured on btc-race-24h-20261117-0603, dev dataset
`fe7f72ebd9c856238d49d62cec0c613856ded95cf98467fc0bd4d9daa76832d1`.

The 1,440 closes rise from 64,461.03527 to 64,775.95230 USDC (+0.4885%).
The close low/high are 63,874.35765 / 65,466.84351. Minute return RMS is
0.06435%; 1,323 of 1,439 close transitions move and 141 bars have no range.
The pools.json freeze depth is 1,382,154.789043 USDC; actual close depths
range from 708,848.708439 to 1,063,756.675506, median 880,466.405015.
Sizing uses observed close depth; fills use the next open and its depth.

Previous defaults lose 1.342924 USDC over 10 fills on this window. The new
defaults require a 1% trend over 30 closes, disable reversal entries, and
lower the trailing floor from 45 to 30 bps. EMA spans, cost filtering,
20% position limit, cash reserve, stop and kill switch are retained.
Entry reasons now correctly identify the active branch. No timestamps,
prices, dataset files or seeds are used as a trading schedule.

The kit's unmodified grade-local, with --worktree --driver process, finishes:

| Metric | Official result |
| --- | ---: |
| Net PnL after fees, slippage and impact | +0.821534 USDC |
| Filled bot orders | 2 (one buy, one sell) |
| Maximum drawdown | 0.0942405% |
| Fees | 0.160361 USDC |
| PnL with doubled fees | +0.660436 USDC |
| Rejections | 0 |
| Reproduced score / compliant / causal | true / true / true |

`official/summary.json`, `official/artifacts/result.json` and
`official/artifacts/action-log.json` preserve the grader's raw evidence.
`grade-local-attempt.json` records the gate and runtime source hashes.
All 25 npm tests pass. Two direct main.ts executions produce 1,440
byte-identical replies and match the independently checked engine replay.
The 27 neighboring configurations in research.json are profitable, but all
use this same day; profit depends on one round trip, not independent data.

Local reproduction from the repository root:

```sh
npm test
NODE_OPTIONS=--require="$PWD/reports/official/process-io-compat.cjs" UV_THREADPOOL_SIZE=16 bash scripts/grade-local.sh /root/makefun-additional/btc-r2-kit/btc-race-24h-20261117-0603-kit
```

This machine's Node v26.12.1 fails synchronous stdin socketpairs with EPERM
and loses data on asynchronous child-process socketpairs. The saved local
preload uses a file for synchronous stdin and POSIX FIFOs for process pipes;
it changes transport only. It is an ignored local artifact, outside the
bot snapshot, and does not edit the kit, bot or score. Its SHA-256 is
`3b2eb90c5643be1536be90bff46b1fc4816cd3a6539f353454b3cc138e2d4b2b`.
The official summary notes Node v26.13.1 on the server versus v26.12.1 here;
the process driver has no Docker image digest.
