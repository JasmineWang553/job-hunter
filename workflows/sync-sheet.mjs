// Lists every application in the tracker as a row for your Google Sheet, and
// (with write_method: apps-script) sends them to the sheet.
//
//   node workflows/sync-sheet.mjs            print the rows (JSON) the sheet should have
//   node workflows/sync-sheet.mjs --push     send them to the sheet's Apps Script
//
// Only applications at Applied or later are included. Status maps onto the
// sheet's Result dropdown: Responded/Assessment/Interview -> Interview,
// Offer/Hired -> Accepted, Rejected -> Rejected, else Applied.
// Rows are matched on Link (or Company + Role), so existing rows only get their Result updated;
// anything you typed yourself (e.g. Referral?) is left alone.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { P, settings } from './lib/paths.mjs';
import { appliedDates, isApplied, listRuns, parseJobLine, readTracker, reportUrlsIn, rowForUrl } from './lib/runs.mjs';

const cfg = (await settings()).tracking_sheet || {};
const values = cfg.result_values || ['Applied', 'Interview', 'Rejected', 'Accepted'];
const result = (status) => {
  if (['Responded', 'Assessment', 'Interview'].includes(status)) return values[1] ?? 'Interview';
  if (status === 'Rejected') return values[2] ?? 'Rejected';
  if (['Offer', 'Hired'].includes(status)) return values[3] ?? 'Accepted';
  return values[0] ?? 'Applied';
};

const { rows } = readTracker();
const dates = appliedDates();
const out = [];
const seen = new Set();
for (const run of listRuns()) {
  const file = join(P.runs, run, 'jobs-found.md');
  if (!existsSync(file)) continue;
  const reportUrls = new Map([...reportUrlsIn(join(P.runs, run, 'reports')), ...reportUrlsIn(P.reports)]);
  for (const l of readFileSync(file, 'utf8').split('\n')) {
    const f = parseJobLine(l);
    if (!f) continue;
    const r = rowForUrl(f.url, rows, reportUrls);
    if (!r || !isApplied(r.status) || seen.has(r.num)) continue;
    seen.add(r.num);
    out.push({
      Company: r.company, Date: dates.get(r.num) || r.date, Role: r.role,
      Location: f.location, Link: f.url, Result: result(r.status),
    });
  }
}
// applications with no run folder (added by hand) still belong in the sheet
for (const r of rows) {
  if (!isApplied(r.status) || seen.has(r.num)) continue;
  out.push({ Company: r.company, Date: dates.get(r.num) || r.date, Role: r.role, Location: '', Link: '', Result: result(r.status) });
}
out.sort((a, b) => a.Date.localeCompare(b.Date));

if (!process.argv.includes('--push')) {
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}
if (!cfg.apps_script_url) {
  console.error('No tracking_sheet.apps_script_url in preferences/settings.yml. See workflows/sheet/README.md.');
  process.exit(2);
}
const res = await fetch(cfg.apps_script_url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' }, // Apps Script reads the raw body
  body: JSON.stringify({ secret: cfg.apps_script_secret || '', rows: out }),
  redirect: 'follow',
});
const text = await res.text();
if (!res.ok) { console.error(`Sheet sync failed: HTTP ${res.status} ${text.slice(0, 200)}`); process.exit(1); }
console.log(`Sheet sync: ${text}`);
