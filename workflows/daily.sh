#!/bin/zsh -l
# Scheduled run (weekday mornings): find jobs, then a zero-cost first-pass
# triage of titles and locations into my-data/shortlist.md.
# Install the schedule with:  ./jobs schedule install
cd "${0:A:h}/.." || exit 1
REPO="$PWD"
DATA="${JOB_HUNTER_DATA:-my-data}"
mkdir -p "$DATA/logs"
{
  echo "=== $(date) find"
  node workflows/link-engine.mjs
  zsh workflows/find-jobs.sh
} >> "$DATA/logs/find.log" 2>&1

# Triage runs inside the engine's data view so its relative paths resolve.
echo "=== $(date) triage" >> "$DATA/logs/triage.log"
CLAUDE_BIN="$(command -v claude || echo "$HOME/.local/bin/claude")"
( cd "$DATA/.engine" && "$CLAUDE_BIN" -p "$(cat "$REPO/workflows/triage-prompt.txt")" \
    --permission-mode dontAsk \
    --allowedTools "Read" "Write(data/shortlist.md)" ) >> "$DATA/logs/triage.log" 2>&1
node workflows/link-engine.mjs >> "$DATA/logs/find.log" 2>&1
