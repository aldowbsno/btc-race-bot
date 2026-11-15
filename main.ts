import { runBars } from './vendor/makefun-bars.ts';
import { RegimeBot } from './strategy.ts';

// PAPER only: stdin is the complete information boundary; stdout is the SDK wire.
await runBars(new RegimeBot());
