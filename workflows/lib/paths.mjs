// Where everything lives. One place, so no other file hard-codes a path.
//
//   <repo>/engine/          the career-ops engine (scan, scoring, tracker)
//   <repo>/workflows/       this layer
//   <repo>/my-data/         your data (gitignored), or $JOB_HUNTER_DATA
//   my-data/.engine/        hidden view the engine reads, made of links into my-data
//
// The engine finds its data root through engine/.career-ops-data, which
// points at my-data/.engine. Engine scripts run with engine/ as the cwd.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ENGINE = join(REPO, 'engine'); // career-ops, used as-is
export const DATA = process.env.JOB_HUNTER_DATA
  ? resolve(REPO, process.env.JOB_HUNTER_DATA)
  : join(REPO, 'my-data');
export const ENGINE_VIEW = join(DATA, '.engine');

export const P = {
  // you edit these
  cv: join(DATA, 'profile/cv.md'),
  profile: join(DATA, 'profile/profile.yml'),
  formAnswers: join(DATA, 'profile/form-answers.yml'),
  aiTools: join(DATA, 'profile/ai-tools.md'),
  targetCompanies: join(DATA, 'preferences/target-companies.yml'),
  houseRules: join(DATA, 'preferences/house-rules.md'),
  settings: join(DATA, 'preferences/settings.yml'),
  // generated
  runs: join(DATA, 'runs'),
  tracker: join(ENGINE_VIEW, 'data/applications.md'),
  inbox: join(ENGINE_VIEW, 'data/pipeline.md'),
  statusLog: join(ENGINE_VIEW, 'data/status-log.tsv'),
  reports: join(ENGINE_VIEW, 'reports'),
  logs: join(DATA, 'logs'),
  state: join(DATA, '.state'),
};

// Reads preferences/settings.yml (uses the engine's js-yaml).
export async function settings() {
  const yaml = createRequire(join(ENGINE, 'package.json'))('js-yaml');
  if (!existsSync(P.settings)) return {};
  return yaml.load(readFileSync(P.settings, 'utf8')) || {};
}
