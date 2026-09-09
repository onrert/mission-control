---
name: nested-real-suite-fork-bomb
description: A vitest test that spawns the real `vitest` suite as a subprocess must exclude its own test file, or it recursively re-triggers itself and forks exponentially
metadata:
  type: feedback
---

When a permanent regression test needs to spawn the REAL `vitest`/test-runner command (not a
fixture) against the real repo suite — e.g. to prove a CLI-level bug like an undeclared
`--exclude` flag silently dropping a file — that spawned real suite will, by default, also
collect and run the very test file that contains this test. If that test doesn't guard against
it, running it re-triggers the same spawn, which re-triggers it again, forking exponentially.

**Why:** Hit this in `mission-control` writing the "B1 kalıcı regresyon" test for
`scripts/verify-test-run.mjs` (docs/qa/test-skip-gate-2026-09-10.md B1 closure). The first version
spawned `vitest run --exclude <one other file>` with no guard against the outer test file — within
about a minute this produced 185+ `node.exe` processes (each spawned suite re-ran the test file,
which spawned another full suite, recursively). Caught via `Get-CimInstance Win32_Process | Where
CommandLine -match 'mission-control'` showing a runaway count, cleaned up with a filtered
`Stop-Process` (matched on repo path in the command line, not a blanket `taskkill`, so unrelated
processes were untouched).

**How to apply:** Before adding any test that does `spawnSync(process.execPath, [gateScript, ...])`
(or equivalent) against a **real** command with no mock/fixture swap, check whether the scope
being run would include the current test file itself. If yes, explicitly exclude that file from
the spawned invocation (e.g. an extra `--exclude path/to/this.test.ts`) and leave a loud comment
explaining why — it is not optional cleanup, it prevents exponential process growth. After adding
such a test, run it once in isolation (`vitest run <file> -t "<test name>"`) while watching the
OS process count for this repo, before running the full file or full suite.

Related: [[feedback_orphan_process_before_verify]] (general orphan-process hygiene in this repo).
