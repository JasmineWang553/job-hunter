// One-screen summary: tracker counts, the latest runs, what's ready to apply to.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { P, settings } from './lib/paths.mjs';
import { listRuns, parseJobLine, readTracker, refreshRuns } from './lib/runs.mjs';

refreshRuns();
const min = (await settings()).apply?.min_score ?? 4.0;
const { rows } = readTracker();
const count = {};
for (const r of rows) count[r.status] = (count[r.status] || 0) + 1;
console.log(`Tracker: ${rows.length} jobs  ·  ${Object.entries(count).map(([k, v]) => `${k} ${v}`).join('  ·  ')}`);

console.log('\nRuns (newest first):');
let ready = 0;
for (const run of listRuns().reverse().slice(0, 8)) {
  const f = join(P.runs, run, 'jobs-found.md');
  if (!existsSync(f)) continue;
  const jobs = readFileSync(f, 'utf8').split('\n').map(parseJobLine).filter(Boolean);
  const applied = jobs.filter((j) => j.box === 'x').length;
  const skipped = jobs.filter((j) => j.box === '!').length;
  const lines = readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('- [ ]'));
  const todo = lines.filter((l) => parseFloat((l.match(/score (\d\.\d)/) || [])[1]) >= min).length;
  const unscored = lines.filter((l) => !/ score \d/.test(l)).length;
  ready += todo;
  console.log(`  ${run}  ${jobs.length} found · ${applied} applied · ${skipped} skipped · ${todo} ready (score ≥ ${min}) · ${unscored} not yet scored`);
}
console.log(`\n${ready ? `${ready} jobs ready to apply: ./jobs apply` : 'Nothing scored high enough is waiting.'}`);
