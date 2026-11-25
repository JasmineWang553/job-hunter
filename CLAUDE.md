@AGENTS.md

<!-- Add Claude Code-specific guidance here only when it has no AGENTS.md counterpart. -->

## job-hunter layout (this fork)

- The user's data lives in `my-data/` (gitignored). The engine's data root is `my-data/.engine` (set by `.career-ops-data`), which holds links into `my-data` under the engine's file names. Edit the readable files, not the links:
  `cv.md` → `my-data/profile/cv.md` · `config/profile.yml` → `my-data/profile/profile.yml` · `portals.yml` → `my-data/preferences/target-companies.yml` · `modes/_custom.md` → `my-data/preferences/house-rules.md` · `modes/_profile.md` → `my-data/preferences/targeting.md` · `modes/_brief.md` → `my-data/preferences/brief.md` · `voice-dna.md` → `my-data/profile/writing-voice.md`.
- Workflow settings: `my-data/preferences/settings.yml`. Standard form answers: `my-data/profile/form-answers.yml`. AI-tools answers: `my-data/profile/ai-tools.md`.
- Run folders: `my-data/runs/<date>/` (`jobs-found.md`, `scores.md`, `reports/`), written by `workflows/collect-run.mjs`. Don't tick boxes by hand: after `set-status.mjs`, run `node workflows/collect-run.mjs`.
- After any engine command that writes user files, run `node workflows/link-engine.mjs` (it restores links an atomic save replaced).
- Applying: the `apply-jobs` skill. Entry point for everything: `./jobs`.
