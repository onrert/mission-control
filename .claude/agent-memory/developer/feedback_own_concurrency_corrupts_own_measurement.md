---
name: feedback-own-concurrency-corrupts-own-measurement
description: Launching a second scratchpad script that shares a sandbox dir with an in-flight background measurement corrupts that measurement's numbers
metadata:
  type: feedback
---

Don't run a second script (even a quick one-off `run-fresh.mjs`/`run-b4.mjs`-style check) against
the same shared scratchpad sandbox directory (e.g. `lib.mjs`'s default `WORK/modes`) while an
earlier background job (e.g. a 3640-vector `combo.mjs` differential) is still mid-run against that
same directory. Concretely hit this twice in one session: (1) rerunning `run-fresh.mjs` with the
default `modes` subdir while `combo.mjs` was still iterating caused a transient EPERM and — worse —
silently corrupted 2 of 3640 combo results (a lower, wrong v0-v5 baseline and a phantom "2 leaks"
in v6 that a clean, isolated rerun showed was 0); (2) a quick `fp.mjs`/`debug-test.mjs` run against
the shared `block-dangerous-v6.cjs` candidate file while `mutate.mjs` was mid-mutation-cycle
silently measured against whatever mutant happened to be written to disk at that instant (`test -f
...` looked "blocked" only because `MUT-TESTBRACKET-READER-OFF` was live at that moment).

**Why:** background harness scripts here (`setupModes`, `mutate.mjs`) read/write a shared file or
directory path across their whole run, not just at setup. There is no lock — a second script's
`fs.rmSync`/`fs.writeFileSync` on the same path mid-run is a live race, not a one-time setup
collision.

**How to apply:** before launching any new scratchpad script, check what background jobs are still
running (`tasklist | grep node.exe`, or check the background-task notification) and confirm the new
script uses an **isolated subdir/copy** (e.g. `setupModes('modes-fresh')` not `setupModes()`) if
there's any chance of overlap. If a measurement looks surprising (numbers lower than expected, or a
"leak" that doesn't match hand-reasoning about the code), the first hypothesis should be "was
something else touching this same directory/file when this ran?" — rerun in isolation before
reporting the number as real. See also [[additive-mechanism-over-replacement]] and the project's
own "kendi eşzamanlılığın testleri kirletiyor" pattern (recorded independently at least four times
in this repo's CLAUDE.md now — this is the fifth, scratchpad-harness-specific instance).
