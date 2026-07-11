# GrooveViewer — Session protocol

Read this and `.claude/STATUS.md` before touching any code. Three phases: **ORIENT → WORK → LOG.**

## ORIENT — before touching code

1. **Read `.claude/STATUS.md`.** It's the current handoff: what's in flight, the working branch, the next move. Check the timestamp. If it's missing or stale, say so and ask before proceeding.
2. **Check git.** Current branch, uncommitted diff, ahead/behind upstream. Never assume `main` is the workspace.
3. **State it back.** What's in flight, what the task is, your planned first move. Ambiguity → surface it and wait.

## WORK — the standing gates (hard rules)

- **Branches only.** Never commit to `main`. Branch names: `claude/<short-topic>`.
- **Three-gate merge:** (1) diff read, (2) QA on the real target, (3) John merges. You do 1 and 2. John does 3.
- **Nothing irreversible without John's explicit sign-off** — merge, push to a shared branch, publish, delete.
- **Verify, don't assume.** A clean build is not a working app — run it.

## Project hard rules (non-negotiable)

- **Scan, don't ship.** The product scans the user's *own* installed groove libraries (SSD5, EZdrummer/Superior, Groove Monkee, raw MIDI folders). It must NEVER bundle, embed, or ship groove MIDI data or the catalog derived from it. This is a legal requirement (Slate/Groove Monkee copyright), not a preference.
- **`beat-catalog.html` never gets committed.** It embeds 396k copyrighted groove records. It is gitignored; keep it that way. Same rule for any decoded catalog data, extracted MIDI, or test fixtures derived from commercial libraries — dev-only, local-only, gitignored.
- The prototype's reference libraries live at `/Volumes/My Work/SSL/SSD5Library/` (external volume — may not be mounted).

## LOG — before sign-off

1. **Write the handoff to the vault (canonical):** session-log line in `Brain/session-log.md`, summary in `/Daily`, detail in `Projects/Groove Library/`. Append, never overwrite.
2. **Refresh `.claude/STATUS.md`** — branch, what landed, what's next, timestamp. Commit it on the working branch.
3. **Leave the next agent a clean orient.**
