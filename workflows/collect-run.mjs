// Files what's new into a dated run folder: my-data/runs/<YYYY-MM-DD_HHMM>/.
//   - new job URLs from the engine's inbox  -> a new run folder (jobs-found.md)
//   - new evaluation reports                 -> copied into the run that first listed that job
// Then refreshes every run's checkboxes and scores.md from the tracker.
// What it has already filed is kept in my-data/.state/collect-run.json, so each
// job lands in exactly one run, even with several runs a day.
//
//   node workflows/collect-run.mjs           collect
//   node workflows/collect-run.mjs --seed    mark everything current as already filed
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { P } from './lib/paths.mjs';
import { formatJobLine, listRuns, parseJobLine, refreshRuns, urlOf } from './lib/runs.mjs';

const STATE = join(P.state, 'collect-run.json');
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { urls: [], reports: [] };
const seenUrls = new Set(state.urls);
const seenReports = new Set(state.reports);

const inbox = existsSync(P.inbox) ? readFileSync(P.inbox, 'utf8').split('\n') : [];
const newJobs = inbox.filter((l) => /^- \[[ x!]\] /.test(l) && urlOf(l) && !seenUrls.has(urlOf(l)));
const newReports = existsSync(P.reports)
  ? readdirSync(P.reports).filter((f) => f.endsWith('.md') && !seenReports.has(f)) : [];

const save = () => {
  for (const l of newJobs) state.urls.push(urlOf(l));
  state.reports.push(...newReports);
  mkdirSync(P.state, { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 1));
};

if (process.argv.includes('--seed')) {
  save();
  console.log(`Seeded: ${newJobs.length} jobs and ${newReports.length} reports marked as filed.`);
  process.exit(0);
}

// Which run first listed each URL.
const urlToRun = new Map();
for (const run of listRuns()) {
  const f = join(P.runs, run, 'jobs-found.md');
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    const u = urlOf(l);
    if (u && !urlToRun.has(u)) urlToRun.set(u, run);
  }
}

// New jobs -> new run folder.
let newRun = null;
if (newJobs.length) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const base = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  newRun = base;
  for (let i = 2; existsSync(join(P.runs, newRun)); i++) newRun = `${base}-${i}`;
  const dir = join(P.runs, newRun);
  mkdirSync(join(dir, 'reports'), { recursive: true });
  const lines = newJobs.map((l) => { const f = parseJobLine(l); f.box = ' '; f.suffix = ''; return formatJobLine(f); });
  writeFileSync(join(dir, 'jobs-found.md'), `# Jobs found in run ${newRun}\n\n${lines.join('\n')}\n`);
  for (const l of newJobs) urlToRun.set(urlOf(l), newRun);
  console.log(`New run ${newRun}: ${newJobs.length} jobs`);
}

// New reports -> the run that listed the job.
let filed = 0;
const orphans = [];
for (const f of newReports) {
  const url = (readFileSync(join(P.reports, f), 'utf8').match(/\*\*URL:\*\*\s*(\S+)/) || [])[1];
  const run = url && urlToRun.get(url);
  if (!run) { orphans.push(f); continue; }
  mkdirSync(join(P.runs, run, 'reports'), { recursive: true });
  copyFileSync(join(P.reports, f), join(P.runs, run, 'reports', f));
  filed++;
}
if (filed) console.log(`Filed ${filed} new reports into their runs`);
if (orphans.length) console.log(`Reports for jobs no run listed (kept in the engine's reports/ only): ${orphans.join(', ')}`);

save();
const changed = refreshRuns();
if (!newJobs.length && !filed) console.log('Nothing new since the last collection.');
if (changed) console.log(`Updated ${changed} job lines from the tracker`);
