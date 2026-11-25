# workflows/: how job-hunter works inside

The short version is in the [main README](../README.md). This page has the full
flow, what each script does, and where every file goes.

## The scripts

| Script | Run by | What it does |
|---|---|---|
| `find-jobs.sh` | `./jobs find` | engine scan → `filter-by-experience.mjs` → `collect-run.mjs` |
| `filter-by-experience.mjs` | find | drops new jobs whose stated minimum years > `find.max_required_years` |
| `collect-run.mjs` | find, evaluate, apply | files new jobs into `runs/DATE/`, copies new reports in, re-syncs every run's checkboxes and `scores.md` from the tracker |
| `link-engine.mjs` | every `./jobs` command | builds and repairs `my-data/.engine` (the engine's view of your files) |
| `status.mjs` | `./jobs status` | one-screen summary |
| `sync-sheet.mjs` | `./jobs sheet [push]` | rows for the Google Sheet; `--push` sends them to the Apps Script |
| `daily.sh` | `./jobs schedule install` | weekday find + title-only triage into `shortlist.md` |
| `sheet/Code.gs` | your Google Sheet | Apps Script that receives rows (see [sheet/README.md](sheet/README.md)) |
| `lib/paths.mjs` | all | every path in one place |
| `lib/runs.mjs` | all | run-folder format: read, write, sync with the tracker |

## The workflow, step by step

```mermaid
flowchart TD
    subgraph FIND["./jobs find · free"]
        A["scan.mjs<br/>public job-board APIs of every company<br/>in target-companies.yml"] --> B["filter-by-experience.mjs<br/>drops jobs needing more years than<br/>find.max_required_years"]
        B --> C["collect-run.mjs<br/>new jobs → runs/DATE/jobs-found.md"]
    end

    subgraph EVAL["./jobs evaluate · tokens"]
        D["Claude scores each job 0-5<br/>against your CV and targeting"] --> E["report per job → runs/DATE/reports/<br/>row per job → tracker.md + scores.md"]
    end

    subgraph APPLY["./jobs apply · tokens"]
        F{"score ≥ min_score?<br/>(default 4.0)"} -- yes --> G["Claude opens the form in your Chrome<br/>fills one page from profile/ + form-answers.yml"]
        G --> H(["You review the page:<br/>ok · edit in Chrome · answer blanks"])
        H -- next page --> G
        H -- final page --> I(["You reply yes"])
        I --> J["Submit → confirmation checked"]
        F -- no --> K["stays in the run, not applied"]
    end

    subgraph RECORD["after each submit · free"]
        L["tracker.md → Applied"]
        M["jobs-found.md → [x] applied DATE"]
        N["Google Sheet row<br/>(optional)"]
    end

    C --> D
    E --> F
    J --> L & M & N
    H -. "your edits and answers" .-> O["learned into form-answers.yml<br/>and house-rules.md"]
    O -. "used on the next form" .-> G
```

## Where the pieces live

```mermaid
flowchart LR
    U(["you"]) -- "./jobs …" --> J["jobs<br/>(one command)"]
    J --> W["workflows/<br/>find, filter, run folders,<br/>sheet sync, status"]
    J --> S[".claude/skills/apply-jobs<br/>page-by-page apply"]
    J --> EN["career-ops engine<br/>scan, scoring, tracker"]

    W <--> MD
    S <--> MD
    EN <-- "reads through links in<br/>my-data/.engine" --> MD

    subgraph MD["my-data/  (yours, never pushed)"]
        P["profile/<br/>cv.md · profile.yml<br/>form-answers.yml · ai-tools.md · resume"]
        PR["preferences/<br/>settings.yml · target-companies.yml<br/>house-rules.md · targeting.md"]
        R["runs/DATE/<br/>jobs-found.md · scores.md · reports/"]
        T["tracker.md"]
    end

    S -. optional .-> GS[("Google Sheet")]
    W -. optional .-> GS
```

The engine expects its own file names (`portals.yml`, `modes/_custom.md`, …).
`my-data/.engine/` holds links from those names to your readable files, so you
only ever edit `my-data/profile/` and `my-data/preferences/`. `./jobs` keeps
the links working.
