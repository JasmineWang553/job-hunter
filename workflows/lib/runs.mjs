// Run folders: my-data/runs/<YYYY-MM-DD_HHMM>/
//   jobs-found.md   one line per job:  - [ ] Company — Role | Location | posted … | yrs … | score … | <url>
//                   [ ] open   [x] applied   [!] skipped   (with "— applied <date>" / "— skipped: <why>")
//   scores.md       tracker rows for those jobs, highest score first
//   reports/        evaluation report per job
//
// refreshRuns() re-derives checkbox, score and suffix of every line from the
// tracker, so after an application is recorded (set-status.mjs) every run
// folder shows it without anyone editing it by hand.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { P } from './paths.mjs';

export const RUN_RE = /^\d{4}-\d{2}-\d{2}_\d{4}(-\d+)?$/;
export const listRuns = () =>
  existsSync(P.runs) ? readdirSync(P.runs).filter((d) => RUN_RE.test(d)).sort() : [];

// ---------- tracker ----------
export function readTracker() {
  if (!existsSync(P.tracker)) return { header: [], rows: [] };
  const lines = readFileSync(P.tracker, 'utf8').split('\n');
  const header = lines.filter((l) => /^\|\s*#\s*\|/.test(l) || /^\|[-\s|:]+\|$/.test(l));
  const cols = (header[0] || '').split('|').map((c) => c.trim().toLowerCase());
  const at = (name) => cols.indexOf(name);
  const rows = lines.filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((line) => {
    const c = line.split('|').map((x) => x.trim());
    const reportCell = c[at('report')] || '';
    const rep = reportCell.match(/\[(\d+)\]/);
    return {
      line,
      num: c[at('#')],
      date: c[at('date')],
      company: c[at('company')],
      role: c[at('role')],
      score: c[at('score')],
      status: c[at('status')],
      report: rep ? String(parseInt(rep[1], 10)) : null,
      notes: c[at('notes')] || '',
    };
  });
  return { header, rows };
}

// Date a row first became Applied, from the engine's status ledger.
export function appliedDates() {
  const out = new Map();
  if (!existsSync(P.statusLog)) return out;
  for (const l of readFileSync(P.statusLog, 'utf8').split('\n')) {
    const [num, date, , to] = l.split('\t');
    if (to === 'Applied' && num && !out.has(num)) out.set(num, date);
  }
  return out;
}

const APPLIED = new Set(['Applied', 'Responded', 'Assessment', 'Interview', 'Offer', 'Hired', 'Rejected']);
const SKIPPED = new Set(['SKIP', 'Discarded']);
export const isApplied = (status) => APPLIED.has(status);

// ---------- job lines ----------
export const urlOf = (l) => (l.match(/https?:\/\/[^\s|)]+/) || [])[0];

// Accepts every line format the old snapshots used, returns fields.
export function parseJobLine(l) {
  const m = l.match(/^- \[([ x!])\] (.*)$/);
  if (!m) return null;
  const url = urlOf(l);
  if (!url) return null;
  let body = m[2];
  const suffix = (body.match(/ — (applied .*|skipped.*)$/) || [])[1] || '';
  body = body.replace(/ — (applied .*|skipped.*)$/, '');
  const parts = body.split(' | ').map((s) => s.trim()).filter((s) => !s.startsWith('http'));
  // old snapshots used [x] for "evaluated"; only keep x when the line says applied
  const box = m[1] === 'x' && !suffix.startsWith('applied') ? ' ' : m[1];
  const f = { url, box, suffix, company: '', role: '', location: '', posted: '', yrs: '' };
  for (const p of parts) {
    if (/^posted:?\s/.test(p)) f.posted = p.replace(/^posted:?\s*/, '');
    else if (/^yrs:?\s/.test(p)) f.yrs = p.replace(/^yrs:?\s*/, '');
    else if (/^score\s/.test(p) || /^\d\.\d\/5$/.test(p) || /^PDF /.test(p) || /^#[\d-]+$/.test(p)) continue;
    else if (/^skipped \(/.test(p)) { f.box = '!'; f.suffix ||= p.replace(/^skipped \((.*)\)$/, 'skipped: $1'); }
    else if (p.includes(' — ') && !f.company) [f.company, f.role] = p.split(' — ');
    else if (!f.company) f.company = p;
    else if (!f.role) f.role = p;
    else if (!f.location && !/USD|EUR|\d{5,}/.test(p)) f.location = p;
  }
  return f;
}

export function formatJobLine(f) {
  const bits = [`${f.company || '?'} — ${f.role || '?'}`];
  if (f.location) bits.push(f.location);
  if (f.posted) bits.push(`posted ${f.posted}`);
  if (f.yrs) bits.push(`yrs ${f.yrs}`);
  if (f.score) bits.push(`score ${f.score}`);
  bits.push(f.url);
  return `- [${f.box}] ${bits.join(' | ')}${f.suffix ? ` — ${f.suffix}` : ''}`;
}

// ---------- matching tracker rows to job URLs ----------
// By the report's **URL:** header, else by a long id in the notes (req/gh_jid).
export function rowForUrl(url, rows, reportUrls) {
  // the report number, or the row number (they match unless a row was added by hand)
  for (const r of rows) if (reportUrls.get(r.report || r.num) === url) return r;
  for (const r of rows) {
    const ids = r.notes.match(/\d{6,}/g) || [];
    if (ids.some((id) => url.includes(id))) return r;
  }
  // rows added without a report (apply --unscored) carry the posting URL in the notes
  for (const r of rows) if (r.line.includes(url)) return r;
  return null;
}

export function reportUrlsIn(dir) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const u = (readFileSync(join(dir, f), 'utf8').match(/\*\*URL:\*\*\s*(\S+)/) || [])[1];
    if (u) map.set(String(parseInt(f, 10)), u);
  }
  return map;
}

// ---------- refresh ----------
export function refreshRuns() {
  const { header, rows } = readTracker();
  const applied = appliedDates();
  let changed = 0;
  for (const run of listRuns()) {
    const dir = join(P.runs, run);
    const jobsFile = join(dir, 'jobs-found.md');
    if (!existsSync(jobsFile)) continue;
    const reportUrls = new Map([...reportUrlsIn(join(dir, 'reports')), ...reportUrlsIn(P.reports)]);
    const runRows = new Map();
    const lines = readFileSync(jobsFile, 'utf8').split('\n').map((l) => {
      const f = parseJobLine(l);
      if (!f) return l;
      const r = rowForUrl(f.url, rows, reportUrls);
      if (r) {
        runRows.set(r.num, r);
        if (/^\d/.test(r.score)) f.score = r.score.replace('/5', '');
        if (isApplied(r.status)) { f.box = 'x'; f.suffix = `applied ${applied.get(r.num) || r.date}`; }
        else if (SKIPPED.has(r.status)) {
          f.box = '!';
          if (!f.suffix.startsWith('skipped')) f.suffix = `skipped: ${r.notes.replace(/^Skipped at apply:\s*/i, '') || r.status}`;
        }
      }
      const out = formatJobLine(f);
      if (out !== l) changed++;
      return out;
    });
    writeFileSync(jobsFile, lines.join('\n'));
    // scores.md: this run's tracker rows, highest score first
    const sorted = [...runRows.values()].sort((a, b) => (parseFloat(b.score) || -1) - (parseFloat(a.score) || -1));
    const body = sorted.map((r) => r.line.replace(/\]\((?:\.\.\/)?reports\//g, '](reports/'));
    writeFileSync(join(dir, 'scores.md'),
      `# Scores for run ${run} (highest first)\n\n${[...header, ...body].join('\n')}\n`);
  }
  return changed;
}
