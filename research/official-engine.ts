// Differential verification only. Export the kit CLI's bundled engine in a scratch
// copy, without changing any engine code. This does NOT run grade-local or intake.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export async function officialEngine(kit, callback) {
  const cli = readFileSync(join(kit, 'cli/makefun.mjs'), 'utf8');
  const manifest = JSON.parse(readFileSync(join(kit, 'kit.json'), 'utf8'));
  const expected = manifest.files.find(f => f.path === 'cli/makefun.mjs').sha256;
  if (createHash('sha256').update(cli).digest('hex') !== expected) throw Error('kit CLI hash mismatch');
  // Fail closed if the bundle layout changes. All fills still use its original code.
  if (!cli.includes('var init_engine3 = __esm({') || !cli.includes('BarsEngine = class')) throw Error('unrecognized official bundle layout');
  const dir = mkdtempSync(join(tmpdir(), 'btc-engine-'));
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, cli + '\ninit_engine3();\ninit_metrics2();\ninit_dataset();\nexport { BarsEngine as OfficialBarsEngine, scoreBarsActionLog as officialScoreBarsActionLog, verifyBarsDataset, readFrozenBarsDataset };\n');
  try {
    const module = await import(pathToFileURL(file).href);
    return await callback(module.OfficialBarsEngine, module.officialScoreBarsActionLog, module);
  }
  finally { rmSync(dir, {recursive:true,force:true}); }
}

export function engineDataset(hello, bars, sha = '0'.repeat(64)) {
  return { sha256: sha, interval: hello.bar_interval,
    window: { start_ms: hello.first_close_ms - 60000, end_ms: hello.first_close_ms + (bars.length - 1) * 60000, bars: bars.length },
    symbols: [{ ...hello.symbols[0], bars: bars.filter(Boolean) }] };
}
