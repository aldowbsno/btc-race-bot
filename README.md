# btc-race-bot

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/aldowbsno/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/aldowbsno/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

Original deterministic, long-only cbBTC **PAPER** trading bot. It combines confirmed reversals and sustained trends with cost-aware sizing, 20% maximum entry exposure, volatility stops, trailing exits, cooldown and a drawdown halt. Standard library only; no install or runtime network, clock, environment or dataset access.

The official bundled data verifier, engine and scorer, run in process, calculate **+1.625393 USDC** on dev, **0.5088027% maximum drawdown**, 17 filled orders, and **+0.199167 USDC at doubled fees**. Two actual entrypoint executions produce byte-identical logs. **Full `grade-local` is blocked here by `git init: spawnSync git EPERM`; the host must complete it before submitting.** These reference calculations are not a successful full grade.

Profit relies on one rebound: excluding the best trade loses 5.038481 USDC. Only 23/36 nearby settings are profitable, and the first half-day loses money. See [AUDIT.md](AUDIT.md) for strategy details, unit arithmetic, all limitations and subperiod results, and [reports/research.json](reports/research.json) for the complete experiments.

Runtime files are `main.ts`, `strategy.ts` and the unchanged official SDK in `vendor/`. The default command consumes the competition NDJSON protocol on stdin and emits one reply per batch on stdout. The grader runs Node 22; local verification used Node 26.12.1.

## Verify locally

```sh
# Tests, all experiments, official in-process data/engine/scorer checks,
# and two byte-identical actual runtime executions:
bash scripts/repro.sh /absolute/path/to/btc-race-kit --engine-only

# Require a real full official process-driver grade as well:
bash scripts/repro.sh /absolute/path/to/btc-race-kit

# Run just the official gate and retain its JSON/stderr:
bash scripts/grade-local.sh /absolute/path/to/btc-race-kit
```

The official gate requires PnL > 0, drawdown <= 25%, at least one filled order and two identical successful executions. The scripts never commit, push, log in or submit. The repository includes 25 regression tests, an independent integer simulator, source-verified official reference comparison and machine-readable audit reports. No previous HOST toy backtest was used.

## Run it

```sh
node main.ts < protocol.ndjson > replies.ndjson
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=gnx4ex8z&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>
