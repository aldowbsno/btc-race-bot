# Build and verification audit

This repository was implemented and revised in the recorded coding session for
`btc-race-24h-20261115-0828`. No commit, push, submission, wallet operation, or
credential read was performed. The entry deadline is **2026-11-15 14:28 UTC**;
that timestamp is documentation only and is absent from the runtime strategy.

## Verification status

**The full official local grade is blocked in this environment.** The exact CLI
failure is `makefun grade-local: git init: spawnSync git EPERM`, during scratch
repository intake. It is an environment failure before the bot runs, not a
strategy grade. No successful `grade-local` result or server receipt exists.
Docker was not used; the official `--driver process` command was attempted.
`reports/grade-local-attempt.json` preserves its failure and runtime source hashes.
The host must complete `bash scripts/grade-local.sh <kit>` successfully before
submitting. That script never submits and fails closed on a missing score,
nonpositive PnL, excessive drawdown, failed causality audit or differing logs.

Separately, the kit's **actual bundled dataset verifier, engine and scorer** run
in process without spawning anything. `research/official-engine.ts` verifies the
CLI's published hash, copies it into disposable `/tmp`, and appends exports for
its existing functions. No engine, fill, scoring or verification implementation
is edited. This provides a reference calculation; it does not replace official
repository intake, process/container execution, transcript checks, or a server
grade. The module copy is deleted afterwards and is not shipped in this repo.

The reference verifier re-derived **1,440 bars from 38,815 pool-state samples**.
The reference engine and scorer, with the official phase seed, returned:

| Measurement | Result |
| --- | ---: |
| Net PnL | **+1.625393 USDC** (1,625,393 micro-USDC) |
| Final cash | 1,001.625393 USDC |
| Return | +0.1625393% |
| Maximum drawdown | **0.5088027%** |
| Authored filled orders | 17 |
| Rejected orders | 0 |
| Fees, including final liquidation | 1.425575 USDC |
| Official fixed-log replay at 2x fees | +0.199167 USDC |
| Causality audit / guardrails | true / compliant |

The independent simulator matches every delivered batch, fill, account and final
account, plus the resolution prices, quantities, fees and cash flows. Eight
additional deterministic order scenarios match the official engine, exercising
split fills, partial sells, duplicate IDs, exhausted cash, missing bars, limits,
min notional, same-reply buy/sell funding and rejection timing.

Two actual `node main.ts` executions each emit 1,440 replies, byte-identically,
and both match the simulator's causal decisions. The reply-stream SHA-256 is
`174282b7e638512558dd8aff210e6cff7f57758007ccf2c26d48410c182b4191`.
This hashes newline-terminated replies, not the official canonical action-log
envelope; their digest formats must not be confused. Results are recorded in
`reports/determinism.json` and `reports/engine-verification.json`.

The local host has Node **v26.12.1**. Runtime code uses only Node 22 compatible
standard APIs, BigInt and erasable TypeScript. The kit's pinned Node 22 container
has not run here. The 25 regression tests run in process because Node's default
test subprocess isolation also fails under this environment's restrictions.

## Strategy and information boundary

The entire runtime dependency graph is `main.ts` -> `strategy.ts` and
`vendor/makefun-bars.ts`. The shim is byte-identical to the official SDK, SHA-256
`9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8`.
All other implementation files were authored here. There is no install step.
Development scripts read the published kit; the runtime does not import them.

The runtime observes only hello, delivered bars, fills and the current account.
It reads no network, clock, environment, development dataset or external file.
It has no randomness, absolute price threshold, epoch rule, trace table or
window-end assumption. Relative timestamps detect gaps; seq counts cooldown and
position age. Shifted-timestamp/seed and changed-future-prefix tests verify those
boundaries. It sends no reply to hello or done, and one reply to every batch.

It waits for 120 fresh observations. A reversal requires a trailing depression
of at least 1.2%, a rebound of at least 0.4% or two ATRs, positive recent momentum,
and three observations with the 10-observation EMA above the 36-observation EMA.
A separate trend branch requires the 36 EMA above the 120 EMA and at least 0.8%
appreciation over the trailing 60-observation window. Both require the current
close above the fast EMA, momentum above estimated costs, and sufficient range
to cover three round trips. Prices are always compared as relative changes.
Flat or falling markets can produce zero trades; synthetic rising prices verify
that participation does not depend on a prior fall or positive dev drift.

One order at a time is outstanding. Sending a buy does not invent a holding;
entry state is created only after its matching filled order. Sells use the
account's exact quantity; rejection clears the intent, never changes ownership,
and imposes a short retry delay. No pyramiding or same-reply funding is used.

Sizing caps buys at 20% of equity, the weight/cash limits, a 35-bp account risk
budget divided by stop distance, and estimated 5-bp one-way price impact.
At entry, at least 80% of the observed equity peak is reserved in cash.
Estimated round-trip cost includes both fees, slippage and impacts, plus 1 bp
for rounding/small gaps, using only the latest close's depth.

Stops use three ATRs, clipped to 0.6–1.8%; a close-based trailing stop uses
2.5 ATRs, clipped to 0.45–1.2%. There are regime/stagnation/age exits, a
23% observed-weight exit, 20-observation exit cooldown, and a permanent halt
after 6% observed account drawdown. Emergency sells allow the full protocol
slippage range so a tight limit cannot trap a position after a gap. These are
risk controls, not a mathematical guarantee against arbitrary jumps, absent
bars or unavailable liquidity: a stop fills at the following open. Measured
dev drawdown and the severe-gap regression remain below the required 25%.

## Independent accounting model

The simulator was written from scratch here; no previous HOST toy backtest was
read or reused. It implements a one-symbol, one-minute replay with exact BigInt
arithmetic and reduced rational constant-product reserves, including multiple
orders walking the same pool. It is a development tool, not a replacement
general-purpose harness or input-schema validator.

For quote scale 6, price scale 5 and quantity scale 8:

`value_microUSDC = qty8 * price5 / 10^7`, truncated toward zero.

A 200 USDC buy is `200000000` cash units; a 1,000,000 USDC pool is
`1000000000000` depth units. A buy fee is deducted from its total notional,
quantity uses the impacted/slipped next open, and cash loses that total exactly
once. A sell decreases quantity once, credits net proceeds once, and scales
cost basis by the fraction left. Every decision remains pending until the next
batch, including rejected decisions; final positions are liquidated at the
last known close and its depth. Final liquidation costs count but its trade
does not count toward the minimum-trades guardrail.

A fixed regression at price 100,000 USDC and depth 1,000,000 USDC spends
200 USDC, charges an 0.08-USDC buy fee, receives qty8 `199840`, and ends a
flat-price round trip at **199.680206 USDC**, a 0.319794-USDC loss. This is
about 15.99 bps for a 200-USDC position; the rules' roughly 26-bp illustration
uses a larger position and a different depth. Fee doubling means 4 -> 8 bps
per fill; it does not double slippage or price impact.

The policy rerun with doubled fees returns +0.182258 USDC. The official cost
sensitivity is +0.199167 USDC because it replays the original action log and
clamps quantities/cash, instead of letting the policy make new decisions.

## Research and overfit risk

Published prices fell about 3.92% from first open to final close. No bullish
drift is assumed. Twelve explicit structural variants were evaluated, including
the losing first combined policy (-0.508529 USDC), trend-only (-3.757533),
reversal-only (+2.277858), stronger trend gates, a larger rebound threshold,
deeper depression, and faster/slower EMA confirmation. All variants are
recomputed under the final accounting/ATR implementation in
`reports/research.json`; losing results are preserved.

The selected 10/36 EMA setting makes less dev PnL than the tested 12/36 variant.
It lies in a more consistent nearby region: all 12 settings with fast EMA 10,
slow EMA 30/36/42 and rebound 0.3/0.4/0.5/0.6% are positive. Across the entire
36-setting neighborhood, however, only **23/36** are positive, and the slower
fast-EMA-14 neighborhood often loses. These are sensitivity checks, not proof
of generalization; all selection used this one published day.

Fresh-start subperiods restart with cash and cold indicators, and pay final
liquidation costs. They are not the same as mark-to-market block attribution:

| Dev observation range | Net USDC, cold restart |
| --- | ---: |
| 0–359 | 0.000000 (no trades) |
| 360–719 | -0.619140 |
| 720–1079 | +3.552102 |
| 1080–1439 | -0.579231 |
| First half, 0–719 | -2.015220 |
| Second half, 720–1439 | +4.986140 |

Seven rolling 12-hour restarts include three losing windows (worst
-4.462109 USDC) and four positive ones. The strongest round trip contributes
+6.663874 USDC; removing it leaves **-5.038481 USDC**. The profit therefore
depends on the day's major rebound. There is no independent holdout, and none
of these results establishes expected profit in the unseen race. The official
symbol-bootstrap interval degenerates to the point estimate with one symbol;
it is not persuasive evidence of predictive confidence.

## Reproduce and host handoff

Run `bash scripts/repro.sh /absolute/path/to/btc-race-kit --engine-only` for
the regression suite, all documented experiments, official in-process reference
checks, and two actual runtime executions. Omit `--engine-only` to require the
full official process-driver grade as the final step. It preserves diagnostics
and exits nonzero until that gate passes. Nothing in either script commits,
pushes, logs into any service, reads credentials or submits an entry.

The README was generated from the requirements JSON's exact badge/referral
template, filled with owner `aldowbsno`, repository `btc-race-bot` and referral
`gnx4ex8z`. MIT licensing is present. The host must retain the genuine session
record, run the competition's transcript/pre-submit checks, and arrange the
public repository and final commit itself. No transcript was synthesized or
exported from memory. No submission is authorized by this audit.
