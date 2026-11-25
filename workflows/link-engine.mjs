// Builds (or repairs) my-data/.engine: the folder the career-ops engine treats
// as its data root. Your files keep readable names in my-data; this folder
// holds links to them under the names the engine expects.
//
//   node workflows/link-engine.mjs          create missing links, repair broken ones
//   node workflows/link-engine.mjs --check  report only, change nothing
//
// Repair: some engine scripts save a file by writing a new copy and renaming
// it over the old one. When that hits a link, the link turns into a plain file.
// This script moves that file back to its readable location and relinks it.
import { existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, symlinkSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { DATA, ENGINE, ENGINE_VIEW } from './lib/paths.mjs';

const check = process.argv.includes('--check');

// engine name (inside .engine)  ->  readable location (inside my-data)
const LINKS = {
  'cv.md': 'profile/cv.md',
  'config/profile.yml': 'profile/profile.yml',
  'voice-dna.md': 'profile/writing-voice.md',
  'writing-samples': 'profile/writing-samples',
  'documents': 'profile/documents',
  'portals.yml': 'preferences/target-companies.yml',
  'modes/_custom.md': 'preferences/house-rules.md',
  'modes/_profile.md': 'preferences/targeting.md',
  'modes/_brief.md': 'preferences/brief.md',
  'interview-prep': 'interview-prep',
};
// readable shortcut (inside my-data)  ->  engine file (inside .engine)
const SHORTCUTS = {
  'tracker.md': '.engine/data/applications.md',
  'shortlist.md': '.engine/data/shortlist.md',
};
// folders the engine writes to directly
const ENGINE_DIRS = ['data', 'reports', 'jds', 'output', 'batch/tracker-additions', 'config', 'modes'];

const problems = [];
const done = [];

function link(at, target) {
  const rel = relative(dirname(at), target);
  let st = null;
  try { st = lstatSync(at); } catch { /* missing */ }
  if (st?.isSymbolicLink()) {
    if (readlinkSync(at) === rel) return;
    if (check) return problems.push(`${at} points elsewhere`);
    renameSync(at, `${at}.old-link`);
  } else if (st) {
    // a real file sits where a link belongs: the engine replaced the link
    if (st.isDirectory()) {
      if (check) return problems.push(`${relative(DATA, at)} is a folder, expected a link`);
      return problems.push(`${relative(DATA, at)} is a folder; move its contents to ${relative(DATA, target)} by hand`);
    }
    if (!existsSync(target) || st.mtimeMs >= lstatSync(target).mtimeMs) {
      if (check) return problems.push(`${relative(DATA, at)} is a plain file (newer than ${relative(DATA, target)})`);
      mkdirSync(dirname(target), { recursive: true });
      if (existsSync(target)) copyFileSync(target, `${target}.before-repair`);
      renameSync(at, target);
      done.push(`moved engine copy back to ${relative(DATA, target)}`);
    } else {
      if (check) return problems.push(`${relative(DATA, at)} is a stale plain file`);
      renameSync(at, `${at}.stale`);
    }
  } else if (check) {
    return problems.push(`missing link ${relative(DATA, at)}`);
  }
  mkdirSync(dirname(at), { recursive: true });
  symlinkSync(rel, at);
  done.push(`linked ${relative(DATA, at)} -> ${relative(DATA, target)}`);
}

if (!check) for (const d of ENGINE_DIRS) mkdirSync(join(ENGINE_VIEW, d), { recursive: true });
// A link may point at a file that doesn't exist yet (before onboarding): the
// engine then sees it as missing, and creating it writes through the link.
for (const [engineName, readable] of Object.entries(LINKS)) {
  const target = join(DATA, readable);
  if (!check) mkdirSync(dirname(target), { recursive: true });
  if (!check && /\/$|^[^.]*$/.test(readable) && !existsSync(target)) mkdirSync(target, { recursive: true });
  link(join(ENGINE_VIEW, engineName), target);
}
for (const [shortcut, engineFile] of Object.entries(SHORTCUTS)) {
  if (!existsSync(join(DATA, engineFile))) continue; // created by the engine later
  link(join(DATA, shortcut), join(DATA, engineFile));
}

// the marker that tells the engine where its data root is
const marker = join(ENGINE, '.career-ops-data');
const want = relative(ENGINE, ENGINE_VIEW) + '\n';
let have = null;
try { have = (await import('node:fs')).readFileSync(marker, 'utf8'); } catch { /* none */ }
if (have !== want) {
  if (check) problems.push('.career-ops-data marker missing or wrong');
  else { writeFileSync(marker, want); done.push(`wrote engine/.career-ops-data -> ${want.trim()}`); }
}

for (const d of done) console.log(`  ${d}`);
if (problems.length) {
  console.log(problems.map((p) => `  ! ${p}`).join('\n'));
  process.exit(check ? 1 : 0);
}
console.log(check ? 'links ok' : done.length ? 'links ready' : 'links ok (nothing to change)');
