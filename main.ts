/**
 * Paper replay entrypoint.
 *
 * The SDK owns parsing, account application, order normalization and NDJSON.
 * This adapter owns lifecycle checks and delegates market decisions to RegimeBot.
 * No research module, dataset, wall clock or environment setting enters decisions.
 */
import { runBars, ProtocolError } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, Done, OrderInput } from './vendor/makefun-bars.ts';
import { RegimeBot } from './strategy.ts';

// ---------------------------------------------------------------------------
// Validation helpers: reject inconsistent callback state before trading.
// These checks observe SDK state; they never modify prices, balances or orders.
// ---------------------------------------------------------------------------

function requireInvariant(condition: boolean, message: string): void {
  if (!condition) throw new ProtocolError(`entrypoint: ${message}`);
}

function validateAccount(state: BarsState): void {
  requireInvariant(state.cash >= 0n, 'cash cannot be negative');
  requireInvariant(state.equity >= 0n, 'equity cannot be negative');
  for (const position of state.positions.values()) {
    requireInvariant(position.qty >= 0n, 'position quantity cannot be negative');
    requireInvariant(position.cost >= 0n, 'position cost cannot be negative');
  }
}

function validateBatch(state: BarsState, batch: Batch, expected: number): void {
  requireInvariant(batch.seq === expected, 'batch sequence must advance by one');
  requireInvariant(state.seq === batch.seq, 'SDK must apply batch before callback');
  requireInvariant(state.t === batch.t, 'SDK time must match current batch');
  requireInvariant(Number.isSafeInteger(batch.t), 'batch time must be a safe integer');
  validateAccount(state);
}

function validateDecisions(orders: OrderInput[]): void {
  // The current strategy has one pending intent and never emits a basket.
  // Keep this narrower invariant separate from the SDK's general order cap.
  requireInvariant(Array.isArray(orders), 'strategy must return an order array');
  requireInvariant(orders.length <= 1, 'strategy must emit at most one intent');
  for (const order of orders) {
    requireInvariant(order.symbol === 'CBBTC', 'strategy intent must target CBBTC');
    requireInvariant(order.side === 'buy' || order.side === 'sell', 'invalid intent side');
  }
  // Decimal amounts, IDs, allowed keys and slippage are checked by the SDK.
  // Calling state.toOrders here would allocate IDs twice, so do not do that.
}

// ---------------------------------------------------------------------------
// Lifecycle adapter: one strategy instance and one monotonic sequence counter.
// ---------------------------------------------------------------------------

class PaperReplayEntrypoint {
  private readonly strategy = new RegimeBot();
  private initialized = false;
  private completed = false;
  private nextSequence = 0;

  onHello(state: BarsState): void {
    requireInvariant(!this.initialized, 'hello must occur exactly once');
    requireInvariant(!this.completed, 'hello cannot follow completion');
    requireInvariant(state.seq === -1, 'hello must precede the first batch');
    validateAccount(state);

    // Initialization uses the harness universe and interval, not a local config.
    // Unsupported universes retain the strategy's existing cash-only behavior.
    this.strategy.onHello(state);
    this.initialized = true;
  }

  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    requireInvariant(this.initialized, 'batch requires hello');
    requireInvariant(!this.completed, 'batch cannot follow completion');
    validateBatch(state, batch, this.nextSequence);

    /*
     * Deterministic ordering is explicit:
     * 1. runBars has already applied bars and the authoritative account.
     * 2. Validate that snapshot and the next expected sequence number.
     * 3. Call the strategy once, in original harness delivery order.
     * 4. The strategy resolves fills before updating indicators and deciding.
     * 5. Validate the returned intent without sorting or rewriting it.
     * 6. Return to the SDK for its canonical JSON field and client-ID ordering.
     *
     * Never sort fills: matching pending IDs is causal and must retain delivery
     * order. Never pre-sort bars: the strategy selects CBBTC itself. Never retry
     * a callback: its pending state and ID allocation are intentionally mutable.
     */
    const orders = this.strategy.onBatch(state, batch);
    validateDecisions(orders);
    this.nextSequence += 1;
    return orders;
  }

  onDone(state: BarsState, done: Done): void {
    requireInvariant(this.initialized, 'done requires hello');
    requireInvariant(!this.completed, 'done must occur at most once');
    requireInvariant(done.seq === this.nextSequence, 'done must follow the last batch');
    requireInvariant(state.seq === done.seq, 'SDK must apply final account first');
    validateAccount(state);
    this.completed = true;

    // Final flattening belongs to the harness. There is no last-minute order,
    // extra stdout summary, asynchronous task or attempt to revise earlier replies.
  }
}

// ---------------------------------------------------------------------------
// Wire boundary: exactly the same SDK and stdin/stdout ABI as the original bot.
// ---------------------------------------------------------------------------

// Errors propagate to Node's normal stderr/exit handling. stdout stays NDJSON.
// Construction is deterministic and all state remains local to this replay.
await runBars(new PaperReplayEntrypoint());
