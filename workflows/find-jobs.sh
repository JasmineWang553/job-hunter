#!/bin/zsh
# Scan the job boards, drop jobs over your experience limit, file new ones into
# a dated run folder (my-data/runs/<date_time>/jobs-found.md).
# Extra arguments go to the scanner, e.g. --posted-after 2026-10-01
set -e
cd "${0:A:h}/.."
( cd engine && node scan.mjs --quiet "$@" )
node workflows/filter-by-experience.mjs
node workflows/collect-run.mjs
