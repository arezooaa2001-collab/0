// Checks every translation pack against the English master: missing keys, unknown keys, placeholder mismatches.
import { readFileSync, readdirSync } from 'node:fs';
const en = (await import('../src/strings/en.js')).default;
const only = process.argv[2];
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
let bad = 0;
for (const f of readdirSync(new URL('../src/strings/', import.meta.url))) {
  if (!f.endsWith('.json')) continue; const code = f.slice(0, -5); if (only && code !== only) continue;
  let pack; try { pack = JSON.parse(readFileSync(new URL('../src/strings/' + f, import.meta.url), 'utf8')); } catch (e) { console.log(code, 'INVALID JSON', e.message); bad++; continue; }
  const missing = code === 'en-GB' ? [] : Object.keys(en).filter((k) => pack[k] === undefined || pack[k] === '');
  const extra = Object.keys(pack).filter((k) => en[k] === undefined);
  const phx = Object.keys(pack).filter((k) => en[k] !== undefined && ph(en[k]) !== ph(pack[k]));
  const same = code === 'en-GB' ? 0 : Object.keys(pack).filter((k) => pack[k] === en[k] && /[a-z]{4,}/i.test(en[k])).length;
  console.log(`${code.padEnd(6)} ${Object.keys(pack).length}/${Object.keys(en).length} keys` + (missing.length ? ` · missing ${missing.length}${missing.length < 12 ? ' [' + missing.join(' ') + ']' : ''}` : '') + (extra.length ? ` · unknown ${extra.join(' ')}` : '') + (phx.length ? ` · placeholder mismatch: ${phx.join(' ')}` : '') + (same ? ` · ${same} identical to English` : ''));
  if (phx.length || extra.length) bad++;
}
process.exit(bad ? 1 : 0);
