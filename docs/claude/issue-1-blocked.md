# Issue #1: Per-Library Note-Map Reverse-Engineering — BLOCKED

**Status:** BLOCKED on missing local ground-truth data  
**Date:** 2026-07-26  
**Branch:** `claude/issue-1-per-library-note-maps`

## Summary

Task: Improve the feel/kick classifier accuracy from the current measured 71.5% (feel) by reverse-engineering per-library MIDI note-to-drum-piece mappings.

**Blocker:** The `dev-data/catalog.json.gz` file (396,510 ground-truth records with known-correct classifications) is not present in this worktree. This file is essential for the reverse-engineering methodology and cannot be substituted with speculative changes.

## Data Availability Check

| Component | Status | Required? | Notes |
|-----------|--------|-----------|-------|
| `dev-data/catalog.json.gz` | ❌ NOT FOUND | YES | Contains 396,510 records with known-correct feel/kick/toms/time/cat values extracted from prototype. Gitignored (copyrighted, local-only). Not present in worktree. |
| `/Volumes/My Work/SSL/SSD5Library/` | ✅ MOUNTED | YES | Reference library volume accessible. Can be used for extraction IF catalog data restored. |

## Why This Is Blocking

Per STATUS.md and the original classifier methodology documented in the milestone section:

> "reverse-engineered against the 396k ground-truth catalog the same way header facts were: dumped raw MIDI note ticks for records across every cat/feel/kick/time value, found the underlying rule per field, measured accuracy at scale (~400-record stride-1000 sample), iterated thresholds, re-measured."

The reverse-engineering process requires:
1. **Access to ground-truth classifications** (the catalog's known-correct feel/kick/toms/time values)
2. **Access to the actual MIDI note data** for files where the classifier currently disagrees with ground truth
3. **Stratification by library variant** (SSD5 vs EZX vs Groove Monkee) to detect per-library note-map patterns
4. **Measured accuracy validation** against the same 397-file (or larger) sample to prove improvement

Without the catalog, there is no way to identify which records the classifier gets wrong, what notes they contain, or which library they come from. Attempting changes without this ground truth would be speculation, not reverse-engineering.

## What Is Needed to Unblock

**One of these:**

1. **Restore dev-data/catalog.json.gz locally** — the 396,510-record gzipped JSON extracted from the prototype (referenced in STATUS.md as existing but gitignored). If this exists in John's local repo, a simple copy-and-uncompress would restore it.

2. **OR: Re-extract the catalog from the prototype** — if the original prototype data is still accessible, re-run the extraction process to recreate `dev-data/catalog.json.gz` locally.

3. **OR: Provide a smaller ground-truth sample** — if neither option is practical, a representative subset (e.g., 1,000–5,000 records stratified by library and feel value) with confirmed classifications would be enough to validate the note-map patterns, though full accuracy measurement would be limited to that sample.

## Files Involved

- **Primary reference:** `.claude/STATUS.md` section "Milestone: feel classifier" (documents original methodology)
- **Code to modify:** `src/scanner.js` (classify() function — currently single note-map for all libraries)
- **Tests:** `test/scan-check.js` (tier 2 ground-truth comparison + accuracy floors)
- **Missing data:** `dev-data/catalog.json.gz` (required for ground-truth comparison)

## Recommendation

This task is a medium-effort, methodical reverse-engineering effort (documented at ~equal effort to the original classifier work in the same milestone). It deserves the full ground-truth data to be credible. 

**Next step:** John should confirm whether `dev-data/catalog.json.gz` exists in the main repo and can be provided locally, or whether a new extraction/sample is feasible. Once ground truth is available, proceed with the reverse-engineering workflow as documented.
