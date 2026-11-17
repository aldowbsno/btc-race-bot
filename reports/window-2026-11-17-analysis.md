# Development-window analysis: 2026-11-17

This report was written in the recorded editing session for this worktree.
It explains the existing paper strategy and the evidence regenerated here.
The report is research material; main.ts never imports it.
Measured values below refer to the published development window only.
A profitable replay is an observation, not an estimate of future expected profit.

## 1. Scope and evidence hierarchy

The target competition is btc-race-24h-20261117-0603.
The target phase is dev.
The asset selected by the policy is CBBTC.
The account denomination is USDC.
The runtime consumes the bars-replay/v1 protocol through standard input.
The runtime emits one reply per batch through standard output.
The official process driver is the primary scoring authority.
The independent simulator is a research and diagnosis tool.
Direct entrypoint replay checks the actual serialization path.
Unit tests check specific state transitions and arithmetic properties.
These evidence sources answer different questions and should not be conflated.

## 2. Information boundary

Only hello, current batches, prior batches and final done enter the bot.
The strategy does not open the development dataset.
The strategy does not inspect the report directory.
The strategy does not read a timestamp from the operating system.
The strategy does not consult a network endpoint.
The strategy does not use random numbers.
The hello seed is not a trading schedule.
Timestamps are used to recognize missing observations.
A timestamp shift test checks that absolute dates do not select entries.
Future-price mutation tests check that prefix decisions remain unchanged.
These checks support causality but do not prove economic generalization.

## 3. Dataset identity and dimensions
Dataset SHA-256: `fe7f72ebd9c856238d49d62cec0c613856ded95cf98467fc0bd4d9daa76832d1`.
Bar-stream SHA-256: `3ae913aab8099937a1cc1ce6d986c17eac7f20f9fd9130c39e4aaa8e02f25631`.
The published stream contains 1,440 one-minute observations.
There are 1,439 adjacent close-to-close returns.
The first reported close is 64,461.03527 USDC.
The last reported close is 64,775.95230 USDC.
The close-to-close day move is approximately +0.4885%.
The minimum reported close is 63,874.35765 USDC.
The maximum reported close is 65,466.84351 USDC.
Minute-return root mean square is approximately 0.06435%.
There are 1,323 moving close transitions.
There are 141 bars whose high equals their low.
These descriptive values were recorded in reports/dev-window.md.
They describe the path, not the order execution price.
A high or low inside a minute is not an executable stop guarantee.

## 4. Liquidity observations

The frozen pools.json depth is 1,382,154.789043 USDC.
Observed close depths differ from that frozen reference.
The reported minimum close depth is 708,848.708439 USDC.
The reported maximum close depth is 1,063,756.675506 USDC.
The reported median close depth is 880,466.405015 USDC.
The policy sizes with the close depth actually visible in its state.
The harness executes against the following open's depth.
That difference is an unavoidable execution uncertainty in this model.
A smaller next-open pool increases realized impact.
A larger next-open pool can reduce realized impact.
The policy does not assume it can lock in the observed close depth.

## 5. Units and arithmetic

Quote balances are integer micro-USDC for quote_scale equal to six.
One USDC corresponds to 1,000,000 quote units.
CBBTC price integers have the scale supplied in hello.
CBBTC quantity integers have the scale supplied in hello.
Valuation multiplies quantity, price and the quote-scale factor.
Valuation divides by the combined quantity and price scale factors.
Integer division truncates the result.
The account and order amounts use BigInt arithmetic.
Indicator ratios use JavaScript floating-point numbers.
The same input and Node arithmetic produce repeatable indicator updates.
Cross-language numerical equivalence is not established by this replay.

## 6. Entrypoint responsibilities

The new entrypoint keeps the original runBars SDK wire boundary.
It constructs exactly one RegimeBot per process.
It validates lifecycle state before invoking that bot.
It checks nonnegative cash, equity, quantity and position cost.
It checks the callback sequence against its own monotonic counter.
It checks that the SDK has applied the batch time and sequence.
It checks the current strategy's at-most-one-order invariant.
It checks that strategy orders target the expected asset.
The SDK remains responsible for decimal amounts and wire field validation.
The adapter never invokes order normalization a second time.
Double normalization could allocate client IDs twice.
The adapter returns the original strategy order array without sorting.

## 7. Deterministic execution order

First, the SDK parses a harness line.
Second, the SDK applies the bars and authoritative account snapshot.
Third, the adapter validates callback state.
Fourth, the strategy resolves any matching pending fill.
Fifth, the strategy updates its indicator state from the current close.
Sixth, the strategy applies exit or entry gates.
Seventh, the adapter checks the returned intent shape.
Eighth, the SDK validates and serializes the reply.
Fill arrays retain their delivered order.
Bar arrays retain their delivered order.
Order arrays retain strategy order.
The entrypoint adds no timers, retries or background work.

## 8. Signal construction

The fast exponential moving average has span 10.
The slow exponential moving average has span 36.
The regime exponential moving average has span 120.
Each EMA seeds from the first available close.
An EMA update uses alpha equal to two divided by span plus one.
The policy keeps enough rolling closes for its regime calculations.
The selected mode is trend.
The reversal implementation remains available for research comparisons.
The selected mode disables reversal entries.
This avoids the weaker dip-buying behavior observed on this day.
It does not assert that reversal signals are universally inferior.

## 9. Trend gate rationale

The selected lookback is 30 closes.
The return comparison spans 29 close-to-close intervals.
The required lookback return is greater than 1%.
The slow EMA must exceed the regime EMA.
The current price must exceed the regime EMA.
The fast EMA must exceed the slow EMA for at least three observations.
The current close must exceed the fast EMA.
Recent momentum must be positive.
These gates jointly demand strength rather than merely a small rebound.
Correlated gates reduce activity but are not independent confirmations.
The neighborhood sweep below measures local parameter sensitivity only.

## 10. Warmup and discontinuities

The policy requires sufficient rolling history before a fresh entry.
The regime length is 120 observations.
Harness-designated warmup bars update indicators without trading.
A missing CBBTC bar does not create a synthetic fresh close.
A sufficiently large time gap resets history and indicators.
The gap rule compares elapsed time with twice the nominal interval.
A gap observation cannot immediately trigger a new entry.
An existing position still belongs to the authoritative account.
Resetting indicators does not make an owned position disappear.
Cold-start subperiod tests therefore differ from slices of a continuous run.

## 11. Intent and ownership

An emitted buy is a pending intent, not an owned position.
An emitted sell does not immediately remove ownership.
The following batch reports acceptance or rejection.
Only a filled buy initializes entry-price and trailing state.
Only a filled sell clears that entry and starts normal cooldown.
A rejection clears the pending marker and applies a shorter cooldown.
Pending state prevents duplicate orders before resolution.
Client IDs are allocated by the state supplied through the SDK.
The account is authoritative if its position differs from local expectations.
Fallback entry reconstruction supports a position observed without local entry data.

## 12. Exposure sizing

The configured maximum exposure is 2,000 basis points of equity.
This corresponds to a nominal 20% position allocation.
The risk budget is 35 basis points of equity.
Stop distance converts that risk budget into an exposure ceiling.
The smaller exposure ceiling wins.
Cash availability is another independent ceiling.
The harness maximum-weight room is another ceiling.
The cash reserve uses 80% of observed peak equity.
An account below its peak can have less deployment room than 20% of current equity.
No borrowing is used to restore the desired allocation.
This sizing reduces exposure but cannot eliminate gap risk.

## 13. Liquidity and minimum size gates

Every observed depth hop must be positive.
Inverse depths are summed to estimate combined impact.
The depth budget targets at most five basis points of one-way impact.
That budget is expressed back in quote units before sizing the order.
The entry amount is the minimum of all allocation ceilings.
Orders below the harness minimum notional are omitted.
A small eligible signal can therefore remain cash-only.
The reserve calculation is not a promise of a particular realized fill quantity.
Quantity rounding happens at execution.
The buy notional includes the fee under the harness model.

## 14. Cost-aware entry filter

The fee rate comes from hello in basis points.
The baseline slippage rate also comes from hello.
Estimated impact uses the observed close depth and proposed size.
The round-trip cost proxy doubles fee, slippage and impact.
A further one-basis-point allowance covers small gaps and rounding.
The opportunity proxy is the larger of the observed range and four ATRs.
The opportunity must exceed three times the estimated cost.
Recent momentum must also exceed half the estimated cost.
This is a rejection filter, not a forecast of realized profit.
An observed range can be exhausted before the order fills.

## 15. Stop and trailing design

The stop begins at three times normalized ATR.
The stop distance is clamped between 0.6% and 1.8%.
The trailing distance begins at 2.5 times normalized ATR.
The selected trailing floor is 0.3%.
The trailing distance has a maximum of 1.2%.
The strategy updates its peak from observed closes.
It does not treat intrabar highs as achieved executable marks.
An exit decision at a close fills at the following open.
A gap can therefore make the realized loss exceed the nominal stop.
Exit slippage tolerance is deliberately broad to prioritize liquidation.

## 16. Other exit priorities

A sticky drawdown halt has the first exit priority.
The fixed entry stop is checked next.
The trailing stop follows.
A confirmed adverse EMA regime can exit an older position.
A maximum holding age of 240 observations bounds stale exposure.
A thesis that has not covered its cost proxy can exit after the lookback age.
A large appreciation can trigger the 23% exposure-reduction threshold.
The helper emits a full-position sell for these exits.
The first satisfied condition determines the recorded reason.
This ordering is part of the deterministic policy definition.

## 17. Drawdown control

Peak equity is updated from authoritative account equity.
The kill threshold is 600 basis points below that peak.
Once halted, the bot does not resume new entries in the same replay.
A later recovery does not clear the halt.
A held position receives a liquidation intent when the halt is observed.
The configured halt is distinct from the competition's 25% drawdown ceiling.
The halt is evaluated discretely at batch time.
It cannot guarantee a maximum loss when the market gaps between batches.
The severe-gap unit test checks one concrete stress path.
It is not a bound over all possible paths.

## 18. Baseline development outcome
- Simulator net_pnl_quote_units: `821534`.
- Simulator net_pnl_usdc: `0.821534`.
- Simulator max_drawdown: `0.0009424050867516161`.
- Simulator trades: `2`.
- Simulator rejections: `0`.
- Simulator fees_quote_units: `160361`.
The net result is +0.821534 USDC after modeled trading costs.
The two reported trades count filled orders, not completed round trips.
There is one completed buy/sell round trip.
The starting account is 1,000 USDC.
The net account return is about 0.0821534%.
The maximum marked drawdown is about 0.0942405%.
The result is economically small relative to the account balance.
The strategy spends most of this development day in cash.
A cash-only comparator earns zero in the paper model.
A full-position buy-and-hold comparator has different exposure and execution costs.

## 19. Concentration of the result

The recorded round-trip PnL list contains a single value.
That value is +0.821534 USDC.
Removing the best round trip leaves zero USDC PnL.
There is no independent set of profitable trades in this window.
The reported 100% win rate is one success out of one round trip.
It does not estimate a stable long-run success probability.
The official symbol bootstrap has only one traded symbol to resample.
A narrow bootstrap interval is therefore not broad evidence of reliability.
Do not interpret per-minute Sharpe as an annualized forecast here.
Trade clustering and many zero-exposure minutes complicate that interpretation.

## 20. Development comparisons

Previous defaults used both trend and reversal branches.
They used a longer lookback and a weaker trend threshold.
They also used a 45-basis-point trailing floor.
Those previous settings lost 1.342924 USDC over ten fills on this window.
The selected settings reduce the number of opportunities substantially.
The comparisons were made on the same published day.
The selection process introduces development-window bias.
No held-out final window was used to write this report.
The present edit preserves the selected default strategy parameters.
It changes the entrypoint adapter and expands research diagnostics.

## 21. Parameter-neighborhood experiment

The grid varies lookback over 24, 30 and 36 observations.
It varies trend threshold over 0.8%, 1.0% and 1.2%.
It varies trailing floor over 0.25%, 0.30% and 0.35%.
The full Cartesian product contains 27 configurations.
Every configuration reruns the causal policy from the same initial account.
Every configuration uses the same fee and slippage assumptions.
All 27 configurations are profitable on this particular day.
Repeated identical results can mean the same gates dominate the decision.
They do not mean there were 27 independent successful experiments.
Each configuration is recorded below for precise inspection.
### Neighborhood case 01

Lookback: 24 closes.
Required trend return: 0.80%.
Trailing floor: 0.25%.
Net PnL: +0.333653 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1429426%.
Fees: 0.319726 USDC.
### Neighborhood case 02

Lookback: 24 closes.
Required trend return: 0.80%.
Trailing floor: 0.30%.
Net PnL: +0.333653 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1429426%.
Fees: 0.319726 USDC.
### Neighborhood case 03

Lookback: 24 closes.
Required trend return: 0.80%.
Trailing floor: 0.35%.
Net PnL: +0.333653 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1429426%.
Fees: 0.319726 USDC.
### Neighborhood case 04

Lookback: 24 closes.
Required trend return: 1.00%.
Trailing floor: 0.25%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 05

Lookback: 24 closes.
Required trend return: 1.00%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 06

Lookback: 24 closes.
Required trend return: 1.00%.
Trailing floor: 0.35%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 07

Lookback: 24 closes.
Required trend return: 1.20%.
Trailing floor: 0.25%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 08

Lookback: 24 closes.
Required trend return: 1.20%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 09

Lookback: 24 closes.
Required trend return: 1.20%.
Trailing floor: 0.35%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 10

Lookback: 30 closes.
Required trend return: 0.80%.
Trailing floor: 0.25%.
Net PnL: +0.504055 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1272415%.
Fees: 0.319794 USDC.
### Neighborhood case 11

Lookback: 30 closes.
Required trend return: 0.80%.
Trailing floor: 0.30%.
Net PnL: +0.504055 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1272415%.
Fees: 0.319794 USDC.
### Neighborhood case 12

Lookback: 30 closes.
Required trend return: 0.80%.
Trailing floor: 0.35%.
Net PnL: +0.504055 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1272415%.
Fees: 0.319794 USDC.
### Neighborhood case 13

Lookback: 30 closes.
Required trend return: 1.00%.
Trailing floor: 0.25%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 14

Lookback: 30 closes.
Required trend return: 1.00%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 15

Lookback: 30 closes.
Required trend return: 1.00%.
Trailing floor: 0.35%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 16

Lookback: 30 closes.
Required trend return: 1.20%.
Trailing floor: 0.25%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 17

Lookback: 30 closes.
Required trend return: 1.20%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 18

Lookback: 30 closes.
Required trend return: 1.20%.
Trailing floor: 0.35%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 19

Lookback: 36 closes.
Required trend return: 0.80%.
Trailing floor: 0.25%.
Net PnL: +0.209878 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1552983%.
Fees: 0.319676 USDC.
### Neighborhood case 20

Lookback: 36 closes.
Required trend return: 0.80%.
Trailing floor: 0.30%.
Net PnL: +0.209878 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1552983%.
Fees: 0.319676 USDC.
### Neighborhood case 21

Lookback: 36 closes.
Required trend return: 0.80%.
Trailing floor: 0.35%.
Net PnL: +0.209878 USDC.
Filled orders: 4; rejected orders: 0.
Maximum drawdown: 0.1552983%.
Fees: 0.319676 USDC.
### Neighborhood case 22

Lookback: 36 closes.
Required trend return: 1.00%.
Trailing floor: 0.25%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 23

Lookback: 36 closes.
Required trend return: 1.00%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 24

Lookback: 36 closes.
Required trend return: 1.00%.
Trailing floor: 0.35%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 25

Lookback: 36 closes.
Required trend return: 1.20%.
Trailing floor: 0.25%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 26

Lookback: 36 closes.
Required trend return: 1.20%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
### Neighborhood case 27

Lookback: 36 closes.
Required trend return: 1.20%.
Trailing floor: 0.35%.
Net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum drawdown: 0.0942405%.
Fees: 0.160361 USDC.
## 22. Fee and slippage experiment

The following grid is newly generated by research/evaluate.ts.
Each case starts with fresh account state and a new RegimeBot.
Both the execution model and the policy's cost gate see the changed costs.
Consequently these are policy-redecision scenarios.
They are not a fixed-action-log accounting adjustment.
The grid varies fee from zero to twenty basis points per side.
The grid varies baseline slippage from zero to twenty basis points per side.
Pool impact and integer rounding remain active in every scenario.
The underlying price path and observed pool depths remain fixed.
The exercise does not model liquidity disappearing in response to stress.
### Execution-cost case 01

Fee assumption: 0 basis points per side.
Baseline slippage assumption: 0 basis points per side.
Policy-redecision net PnL: +1.062657 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.0822487%.
Charged fees: 0.000000 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 02

Fee assumption: 0 basis points per side.
Baseline slippage assumption: 2 basis points per side.
Policy-redecision net PnL: +0.982044 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.0862477%.
Charged fees: 0.000000 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 03

Fee assumption: 0 basis points per side.
Baseline slippage assumption: 5 basis points per side.
Policy-redecision net PnL: +0.861155 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.0922438%.
Charged fees: 0.000000 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 04

Fee assumption: 0 basis points per side.
Baseline slippage assumption: 10 basis points per side.
Policy-redecision net PnL: +0.660404 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1022312%.
Charged fees: 0.000000 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 05

Fee assumption: 0 basis points per side.
Baseline slippage assumption: 20 basis points per side.
Policy-redecision net PnL: +0.259855 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1221821%.
Charged fees: 0.000000 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 06

Fee assumption: 4 basis points per side.
Baseline slippage assumption: 0 basis points per side.
Policy-redecision net PnL: +0.901447 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.0902455%.
Charged fees: 0.160393 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 07

Fee assumption: 4 basis points per side.
Baseline slippage assumption: 2 basis points per side.
Policy-redecision net PnL: +0.821534 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.0942405%.
Charged fees: 0.160361 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 08

Fee assumption: 4 basis points per side.
Baseline slippage assumption: 5 basis points per side.
Policy-redecision net PnL: +0.700716 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1002304%.
Charged fees: 0.160313 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 09

Fee assumption: 4 basis points per side.
Baseline slippage assumption: 10 basis points per side.
Policy-redecision net PnL: +0.500086 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1102073%.
Charged fees: 0.160233 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 10

Fee assumption: 4 basis points per side.
Baseline slippage assumption: 20 basis points per side.
Policy-redecision net PnL: -0.948451 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1537564%.
Charged fees: 0.159653 USDC.
Outcome under this scenario: negative net result.
### Execution-cost case 11

Fee assumption: 8 basis points per side.
Baseline slippage assumption: 0 basis points per side.
Policy-redecision net PnL: +0.740952 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.0982373%.
Charged fees: 0.320722 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 12

Fee assumption: 8 basis points per side.
Baseline slippage assumption: 2 basis points per side.
Policy-redecision net PnL: +0.660436 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1022280%.
Charged fees: 0.320657 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 13

Fee assumption: 8 basis points per side.
Baseline slippage assumption: 5 basis points per side.
Policy-redecision net PnL: +0.540343 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1082118%.
Charged fees: 0.320561 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 14

Fee assumption: 8 basis points per side.
Baseline slippage assumption: 10 basis points per side.
Policy-redecision net PnL: +0.339832 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1181785%.
Charged fees: 0.320401 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 15

Fee assumption: 8 basis points per side.
Baseline slippage assumption: 20 basis points per side.
Policy-redecision net PnL: -1.575981 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1613495%.
Charged fees: 0.318867 USDC.
Outcome under this scenario: negative net result.
### Execution-cost case 16

Fee assumption: 12 basis points per side.
Baseline slippage assumption: 0 basis points per side.
Policy-redecision net PnL: +0.579871 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1062238%.
Charged fees: 0.480986 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 17

Fee assumption: 12 basis points per side.
Baseline slippage assumption: 2 basis points per side.
Policy-redecision net PnL: +0.500054 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1102105%.
Charged fees: 0.480890 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 18

Fee assumption: 12 basis points per side.
Baseline slippage assumption: 5 basis points per side.
Policy-redecision net PnL: +0.380033 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1161881%.
Charged fees: 0.480745 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 19

Fee assumption: 12 basis points per side.
Baseline slippage assumption: 10 basis points per side.
Policy-redecision net PnL: -0.869493 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1497843%.
Charged fees: 0.479244 USDC.
Outcome under this scenario: negative net result.
### Execution-cost case 20

Fee assumption: 12 basis points per side.
Baseline slippage assumption: 20 basis points per side.
Policy-redecision net PnL: -2.074594 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.2074594%.
Charged fees: 0.477796 USDC.
Outcome under this scenario: negative net result.
### Execution-cost case 21

Fee assumption: 20 basis points per side.
Baseline slippage assumption: 0 basis points per side.
Policy-redecision net PnL: +0.259203 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1221820%.
Charged fees: 0.801322 USDC.
Outcome under this scenario: positive net result.
### Execution-cost case 22

Fee assumption: 20 basis points per side.
Baseline slippage assumption: 2 basis points per side.
Policy-redecision net PnL: -0.869652 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1498002%.
Charged fees: 0.799059 USDC.
Outcome under this scenario: negative net result.
### Execution-cost case 23

Fee assumption: 20 basis points per side.
Baseline slippage assumption: 5 basis points per side.
Policy-redecision net PnL: -0.989143 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1557331%.
Charged fees: 0.798820 USDC.
Outcome under this scenario: negative net result.
### Execution-cost case 24

Fee assumption: 20 basis points per side.
Baseline slippage assumption: 10 basis points per side.
Policy-redecision net PnL: -1.655937 USDC.
Filled orders: 2; rejected orders: 0.
Maximum marked drawdown: 0.1655937%.
Charged fees: 0.797484 USDC.
Outcome under this scenario: negative net result.
### Execution-cost case 25

Fee assumption: 20 basis points per side.
Baseline slippage assumption: 20 basis points per side.
Policy-redecision net PnL: +0.000000 USDC.
Filled orders: 0; rejected orders: 0.
Maximum marked drawdown: 0.0000000%.
Charged fees: 0.000000 USDC.
Outcome under this scenario: zero net result.
## 23. Reading sensitivity correctly

The official doubled-fee metric is stored in the official grade summary.
Its previously measured net PnL is +0.660436 USDC.
The research doubled-fee field reruns the policy explicitly.
The two calculations should be identified by their implementation source.
A profitable doubled-fee result gives limited local cost headroom.
It does not establish profitability at arbitrary order size.
Higher fees can prevent entries rather than simply reduce their profit.
Higher slippage can also change the policy's submitted slippage tolerance.
A scenario with no fills is a zero-activity result, not a profitable trade.
The grid is a finite stress exercise, not a fitted cost-response curve.

## 24. Subperiod methodology

Six-hour subperiods contain 360 observations.
Half-day subperiods contain 720 observations.
Each isolated subperiod starts from cash and cold indicators.
The first part of each subperiod is consumed by indicator initialization.
A continuous strategy may already have history at that boundary.
It may also carry an open position across the same boundary.
Therefore isolated subperiod returns need not sum to full-day PnL.
Marked six-hour blocks use a continuous full-day replay instead.
They attribute changes in marked account value across block boundaries.
Rolling half-day windows overlap and are strongly dependent.
- Cold-start slice: start bar 0, length 360.
  Net PnL +0.000000 USDC across 0 filled orders.
  Maximum drawdown 0.0000000%.
- Cold-start slice: start bar 360, length 360.
  Net PnL +0.821534 USDC across 2 filled orders.
  Maximum drawdown 0.0942405%.
- Cold-start slice: start bar 720, length 360.
  Net PnL +0.000000 USDC across 0 filled orders.
  Maximum drawdown 0.0000000%.
- Cold-start slice: start bar 1080, length 360.
  Net PnL +0.000000 USDC across 0 filled orders.
  Maximum drawdown 0.0000000%.
- Cold-start slice: start bar 0, length 720.
  Net PnL +0.821534 USDC across 2 filled orders.
  Maximum drawdown 0.0942405%.
- Cold-start slice: start bar 720, length 720.
  Net PnL +0.000000 USDC across 0 filled orders.
  Maximum drawdown 0.0000000%.
## 25. Economic limitations

One day cannot identify expected profitability across market regimes.
One round trip cannot identify a stable win rate.
A rebound-rich development path can favor momentum confirmation.
A slower trend can fail the selected return threshold.
A sharp reversal can turn confirmation into a late entry.
Repeated whipsaws can accumulate fees before a large winner arrives.
A cash reserve reduces participation as well as risk.
A strict trend gate can miss profitable smaller moves.
No parameter here is claimed to be universally optimal.
The selected neighborhood is descriptive evidence for this development day.

## 26. Execution limitations

The harness uses a deterministic paper execution model.
It does not reproduce a live transaction submission queue.
It does not simulate private routing or adversarial order flow.
A next-open fill is not a live exchange service guarantee.
The current close is not necessarily available at executable size.
A market halt can delay liquidation beyond one observation.
A missing bar can reject an intent instead of filling it.
A price gap can overwhelm a slippage allowance.
A wide exit allowance permits a worse price in exchange for execution priority.
No wallet connection or live order is part of this program.

## 27. Software limitations

The adapter validates invariants expected from the current paper harness.
It does not replace complete schema validation of every incoming field.
The SDK remains the source of truth for the protocol ABI.
The strategy currently supports only CBBTC decisions.
Adding assets would require revisiting the one-order invariant.
Adding asynchronous policy work would require revisiting callback ordering.
Changing ID generation can alter byte-level logs without changing economics.
Changing property insertion order can also alter wire bytes.
A successful hash comparison applies to the tested runtime and input.
It does not certify all future Node versions or arbitrary malformed inputs.

## 28. Test coverage interpretation

Arithmetic tests check scale conversion and truncation.
Execution tests check one-bar latency and pool walking.
Rejection tests check missing bars and slippage failures.
Account tests check that intents do not fabricate ownership.
Lifecycle tests check lockstep sequence handling in the simulator.
Strategy tests check trend participation and cash-only weak markets.
A sticky-halt test checks that recovery does not resume trading.
A timestamp-shift test checks independence from absolute calendar position.
A future-mutation test checks causal prefix stability.
These tests complement the official replay instead of replacing it.

## 29. Exact reproduction commands

Run from the repository directory shown below.
The kit is already available locally; no download is needed.
The runtime transport preload is an existing ignored local artifact.
It works around this sandbox's Node child-process pipe behavior.
It changes transport rather than strategy decisions or scoring rules.
Preserve it when reproducing on this same machine.
On a host without that pipe issue, the preload may be unnecessary.
The commands intentionally use the official process driver on the worktree.

```bash
cd /root/makefun-additional/btc-r2-work
node --test
npm test
node research/evaluate.ts /root/makefun-additional/btc-r2-kit/btc-race-24h-20261117-0603-kit reports/research.json
node research/verify.ts /root/makefun-additional/btc-r2-kit/btc-race-24h-20261117-0603-kit reports/repro
node main.ts < reports/repro/input.ndjson > reports/repro/run1.ndjson
node main.ts < reports/repro/input.ndjson > reports/repro/run2.ndjson
cmp reports/repro/run1.ndjson reports/repro/run2.ndjson
node scripts/compare-logs.ts reports/repro
NODE_OPTIONS=--require="$PWD/reports/official/process-io-compat.cjs" UV_THREADPOOL_SIZE=16 bash scripts/grade-local.sh /root/makefun-additional/btc-r2-kit/btc-race-24h-20261117-0603-kit
wc -l main.ts research/evaluate.ts reports/window-2026-11-17-analysis.md
```

The wrapper invokes the following official command shape.
The shell expands the kit and repository paths before execution.

```bash
node /root/makefun-additional/btc-r2-kit/btc-race-24h-20261117-0603-kit/cli/makefun.mjs grade-local   --kit /root/makefun-additional/btc-r2-kit/btc-race-24h-20261117-0603-kit   --bot /root/makefun-additional/btc-r2-work --worktree --driver process   --save /root/makefun-additional/btc-r2-work/reports/official/artifacts --json
```

## 30. Artifact map and acceptance criteria

reports/official/summary.json contains the raw official summary.
reports/official/artifacts/result.json contains the saved official result.
reports/official/artifacts/action-log.json contains the official action log.
reports/grade-local-attempt.json records the profitable-grade gate decision.
That record also contains runtime source hashes.
reports/research.json contains independent simulations and scenario grids.
reports/repro/input.ndjson contains the causal entrypoint input transcript.
reports/repro/run1.ndjson contains the first actual entrypoint output.
reports/repro/run2.ndjson contains the second actual entrypoint output.
reports/determinism.json records direct byte comparison and SHA-256.
A passing local grade must finish successfully with positive net quote PnL.
It must report compliant constraints and no future-bar contamination.
The official action-log digest must agree with the score's digest.
The direct runs must match each other and the causal simulator's expected bytes.
Unit tests must pass after the runtime edit.
The transcript authorship percentage is a separate external gate.
This report does not claim that a local profit grade computes that percentage.
The document and entrypoint are substantive work authored in this session.
Their measured line counts are reported after final verification.

## 31. Complete hypothesis ledger

These are development comparisons, including settings that were not selected.
All share the same underlying development observations.

### Hypothesis 1: previous window defaults

Trend/reversal mode: `both`.
Lookback length: 60 closes.
Trend threshold: 0.80%.
Trailing floor: 0.45%.
Net PnL: -1.342924 USDC.
Filled orders: 10.
Rejected orders: 0.
Maximum drawdown: 0.2515432%.
Total fees: 0.795741 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 2: previous trend only

Trend/reversal mode: `trend`.
Lookback length: 60 closes.
Trend threshold: 0.80%.
Trailing floor: 0.45%.
Net PnL: -0.055670 USDC.
Filled orders: 6.
Rejected orders: 0.
Maximum drawdown: 0.1986817%.
Total fees: 0.478748 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 3: previous reversal only

Trend/reversal mode: `reversal`.
Lookback length: 60 closes.
Trend threshold: 0.80%.
Trailing floor: 0.45%.
Net PnL: -0.704683 USDC.
Filled orders: 8.
Rejected orders: 0.
Maximum drawdown: 0.2515432%.
Total fees: 0.637221 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 4: half-hour trend with previous trail

Trend/reversal mode: `trend`.
Lookback length: 30 closes.
Trend threshold: 1.00%.
Trailing floor: 0.45%.
Net PnL: +0.578992 USDC.
Filled orders: 2.
Rejected orders: 0.
Maximum drawdown: 0.1184520%.
Total fees: 0.160264 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 5: lower trend threshold

Trend/reversal mode: `trend`.
Lookback length: 30 closes.
Trend threshold: 0.80%.
Trailing floor: 0.30%.
Net PnL: +0.504055 USDC.
Filled orders: 4.
Rejected orders: 0.
Maximum drawdown: 0.1272415%.
Total fees: 0.319794 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 6: higher trend threshold

Trend/reversal mode: `trend`.
Lookback length: 30 closes.
Trend threshold: 1.20%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Rejected orders: 0.
Maximum drawdown: 0.0942405%.
Total fees: 0.160361 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 7: shorter trend window

Trend/reversal mode: `trend`.
Lookback length: 24 closes.
Trend threshold: 1.00%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Rejected orders: 0.
Maximum drawdown: 0.0942405%.
Total fees: 0.160361 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 8: longer trend window

Trend/reversal mode: `trend`.
Lookback length: 36 closes.
Trend threshold: 1.00%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Rejected orders: 0.
Maximum drawdown: 0.0942405%.
Total fees: 0.160361 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 9: two-hour trend window

Trend/reversal mode: `trend`.
Lookback length: 120 closes.
Trend threshold: 1.00%.
Trailing floor: 0.30%.
Net PnL: +0.273115 USDC.
Filled orders: 4.
Rejected orders: 0.
Maximum drawdown: 0.1489858%.
Total fees: 0.319702 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

### Hypothesis 10: selected stable neighborhood

Trend/reversal mode: `trend`.
Lookback length: 30 closes.
Trend threshold: 1.00%.
Trailing floor: 0.30%.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Rejected orders: 0.
Maximum drawdown: 0.0942405%.
Total fees: 0.160361 USDC.
Comparison interpretation: all configuration effects are joint policy effects.
A different fill count changes both market participation and costs.
This is not a controlled estimate of one parameter in isolation.

## 32. Rolling half-day ledger

These overlapping windows use a 120-observation stride.
Every window starts with cold indicators and fresh cash.

### Rolling window 1

First bar index: 0.
Exclusive end index: 720.
Observation count: 720.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Maximum drawdown: 0.0942405%.
This window overlaps adjacent windows.
Its outcome is not an independent sample.
A cold start can omit a signal that a continuously running bot would see.

### Rolling window 2

First bar index: 120.
Exclusive end index: 840.
Observation count: 720.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Maximum drawdown: 0.0942405%.
This window overlaps adjacent windows.
Its outcome is not an independent sample.
A cold start can omit a signal that a continuously running bot would see.

### Rolling window 3

First bar index: 240.
Exclusive end index: 960.
Observation count: 720.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Maximum drawdown: 0.0942405%.
This window overlaps adjacent windows.
Its outcome is not an independent sample.
A cold start can omit a signal that a continuously running bot would see.

### Rolling window 4

First bar index: 360.
Exclusive end index: 1080.
Observation count: 720.
Net PnL: +0.821534 USDC.
Filled orders: 2.
Maximum drawdown: 0.0942405%.
This window overlaps adjacent windows.
Its outcome is not an independent sample.
A cold start can omit a signal that a continuously running bot would see.

### Rolling window 5

First bar index: 480.
Exclusive end index: 1200.
Observation count: 720.
Net PnL: +0.000000 USDC.
Filled orders: 0.
Maximum drawdown: 0.0000000%.
This window overlaps adjacent windows.
Its outcome is not an independent sample.
A cold start can omit a signal that a continuously running bot would see.

### Rolling window 6

First bar index: 600.
Exclusive end index: 1320.
Observation count: 720.
Net PnL: +0.000000 USDC.
Filled orders: 0.
Maximum drawdown: 0.0000000%.
This window overlaps adjacent windows.
Its outcome is not an independent sample.
A cold start can omit a signal that a continuously running bot would see.

### Rolling window 7

First bar index: 720.
Exclusive end index: 1440.
Observation count: 720.
Net PnL: +0.000000 USDC.
Filled orders: 0.
Maximum drawdown: 0.0000000%.
This window overlaps adjacent windows.
Its outcome is not an independent sample.
A cold start can omit a signal that a continuously running bot would see.

## 33. Default-configuration audit ledger

This ledger makes the exact selected settings inspectable alongside the prose.
Values below are read from the research report generated in this session.

### Setting: mode

Selected literal: `trend`.
Selects eligible signal branches.
Changing it can create entirely new entries.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: fast

Selected literal: `10`.
Controls short-horizon EMA and momentum.
Changing it alters both entry and age-based exit behavior.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: slow

Selected literal: `36`.
Controls intermediate EMA confirmation.
A slower value can delay regime transitions.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: regime

Selected literal: `120`.
Controls long EMA and rolling-history readiness.
It also bounds the range history used by the policy.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: lookback

Selected literal: `30`.
Controls trend return and stale-thesis timing.
It is a count of closes rather than elapsed wall-clock time.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: confirm

Selected literal: `3`.
Requires repeated EMA ordering.
Consecutive observations are correlated evidence.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: cooldown

Selected literal: `20`.
Delays re-entry after a completed exit.
It reduces immediate churn without forecasting the next trend.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: maxHold

Selected literal: `240`.
Limits holding age in sequence steps.
A time exit still waits for execution on a later open.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: rebound

Selected literal: `0.004`.
Sets a minimum reversal recovery.
The selected trend-only mode does not enable reversal entries.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: depression

Selected literal: `0.012`.
Sets the reversal drawdown prerequisite.
It remains available for the research branch comparisons.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: trendReturn

Selected literal: `0.01`.
Sets the minimum trend-window return.
Strict greater-than comparison is part of the implementation.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: stopATR

Selected literal: `3`.
Scales normalized volatility into a stop.
The resulting distance remains subject to hard clamps.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: trailATR

Selected literal: `2.5`.
Scales normalized volatility into a trailing distance.
The current peak is a close-based peak.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: trailFloor

Selected literal: `0.003`.
Sets the minimum trailing distance.
A tighter floor can increase sensitivity to small pullbacks.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: maxExposureBps

Selected literal: `2000`.
Caps nominal equity allocation.
Other sizing ceilings can reduce allocation further.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: riskBps

Selected literal: `35`.
Converts stop distance into a risk-based allocation.
The implied risk is a model target rather than a guaranteed loss limit.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

### Setting: killDrawdownBps

Selected literal: `600`.
Sets the sticky portfolio halt threshold.
A discrete-time halt cannot prevent an intervening gap.
Source of truth: DEFAULTS in strategy.ts.
The entrypoint adapter does not override this setting.

## 34. Verification record for this editing session

The rewritten entrypoint matched the previously saved action bytes.
The official process-driver grade finished with a passing profitable gate.
The final measured net PnL was +0.821534 USDC.
The final official filled-order count was two.
The final official maximum drawdown was 0.000942405 as a fraction.
The final direct replay contained 1,440 replies in each run.
The two direct output buffers were byte-identical.
Both matched the causal simulator output buffer.
The action-log SHA-256 was 32da9ceb275beb8e0594c4214d4f38348229f0fde40758c6bf2fd3e8e8028b5d.
The explicit npm test run passed all 25 individual tests.
The requested node --test invocation also completed successfully.
No strategy threshold was changed by this editing session.
