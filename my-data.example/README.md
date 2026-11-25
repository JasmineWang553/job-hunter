# Your data folder

`./jobs setup` copies this folder to `my-data/`. `my-data/` is gitignored, so
none of it is ever pushed.

```
profile/        about you: cv.md, profile.yml, form-answers.yml, ai-tools.md,
                writing-voice.md, your resume PDF
preferences/    how the search runs: settings.yml, target-companies.yml,
                house-rules.md, targeting.md, brief.md
runs/<date>/    one folder per scan: jobs-found.md, scores.md, reports/
interview-prep/ story bank and prep notes
notes/          anything you want
tracker.md      every job you've evaluated or applied to (shortcut)
shortlist.md    the daily title-only triage (shortcut)
```

`cv.md`, `profile.yml`, `target-companies.yml`, `house-rules.md`,
`targeting.md` and `brief.md` are created during onboarding (`/career-ops` in
Claude Code). Edit any of them by hand whenever you like.

The hidden `.engine/` folder is the view the career-ops engine reads: links to
the files above under the names it expects, plus its working data (tracker,
scan history, reports). Leave it alone. `./jobs doctor` repairs it if needed.
