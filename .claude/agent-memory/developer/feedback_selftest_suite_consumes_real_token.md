---
name: feedback-selftest-suite-consumes-real-token
description: running the project's own `_selftest.cjs` before all real guarded edits are done can silently destroy the current single-use GUARD.ok token, even with zero Edit/Write tool calls
metadata:
  type: feedback
---

`.claude/hooks/_selftest.cjs` verifies GUARD.ok scope handling by writing synthetic content
directly into the REAL `docs/approvals/GUARD.ok`/`.guard-state.json` via plain `fs` calls
(not through the harness), then deletes both at the very end ("Test artıklarını bırakma").
If a real, still-needed GUARD.ok exists on disk (mid-task, before all scoped files have been
Edited for real), running the *full* self-test file overwrites/consumes/deletes it as a side
effect of its own test setup and final cleanup — independent of, and in addition to, the
manual-invocation risk already recorded in [[feedback_single_use_token_manual_test]].

**Why:** Caught this before losing a token on a G5 hardening task (four-file GUARD.ok scope:
`gate-check.cjs`, `block-dangerous.cjs`, `_selftest.cjs`, `settings.json`). After really
Editing the first three files (via the actual Edit tool) but before touching `settings.json`
(the last, token-consuming edit), running `node .claude/hooks/_selftest.cjs` for a "does my
new code work" check would have destroyed the still-live GUARD.ok mid-task, before the final
legitimate edit could consume it properly — forcing a stop-and-ask for a fresh token over
what should have been a single continuous turn.

**How to apply:** While a real GUARD.ok is still needed for a remaining guarded edit, verify
new hook logic with a *standalone* scratchpad script that calls the hook script directly via
`execFileSync` with synthetic `file_path`/`command` inputs that never exercise the
GUARD-scope code path (e.g. test a brand-new `docs/approvals/**` check that short-circuits
*before* the `isGuarded`/`parseGuardScope` branch, or test purely negative/K1 cases that don't
require GUARD.ok at all). Only run the *full* `_selftest.cjs` (which legitimately manipulates
GUARD.ok/`.guard-state.json`) after the last real guarded edit has already landed and
consumed the token through the normal Edit-tool flow — at that point the suite's internal
overwrite/cleanup of GUARD.ok is harmless because there is nothing left to lose.

**Repeat trap (second occurrence):** this danger is NOT limited to running the real, in-repo
`_selftest.cjs`. A *draft/scratchpad copy* of a modified `_selftest.cjs` (edited outside the
repo while composing the eventual real edit) is just as dangerous if executed with
`cwd=<repo root>` — the script's `GUARD_OK`/`GUARD_STATE` constants are `path.join('docs',
'approvals', ...)`, i.e. relative to `process.cwd()`, not to the script's own location. Running
`node <scratchpad copy>` from the repo root to dry-run/validate new test cases before writing
them for real will overwrite and then delete whatever real `docs/approvals/GUARD.ok` currently
exists, exactly as if the real file had been run. Lost a token this way even while being
careful to never `Edit`/`Write` the real `_selftest.cjs` before the content was finalized. Fix:
dry-run scratchpad copies of this file only with a `cwd` pointed at an isolated fake project
directory (own fake `docs/approvals/`), never the real repo root — or accept that any dry-run
against the real root consumes the current token and budget a renewal for it up front.
