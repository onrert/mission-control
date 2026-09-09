---
name: feedback-orphan-process-before-verify
description: On resuming a cut-off session in mission-control, check for and kill orphaned node.exe servers holding port 7333 before running verify/e2e
metadata:
  type: feedback
---

Before running `npm test`/`npm run verify`/`npm run e2e` after resuming a session that continues
work from a prior turn-limit cutoff, check whether a previous turn left an orphaned `npm start`/
`npm run dev` process holding port 7333 (`netstat -ano | grep ":7333"` then
`powershell -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>' | Select
ProcessId,CommandLine"` to confirm it's a mission-control node process, not something unrelated,
then `Stop-Process -Id <pid> -Force`).

**Why:** a prior turn's cut-off left a `node.exe` (tsx preflight, mission-control's dev/start
script) listening on 7333. This caused two real-looking failures in the SAME `npm test` run:
`check-ports.test.ts`'s "empty MC_PORT falls back to the real default port" test got exit 1
instead of 0, and a second port-binding test got `EADDRINUSE` instead of successfully binding —
both looked like genuine regressions until traced to the leftover listener. `CLAUDE.md` already
warns generically about not leaving orphan processes; this is the concrete symptom to recognize
when *inheriting* someone else's orphan rather than creating your own.

**How to apply:** treat `check-ports.test.ts` / `EADDRINUSE` failures at the start of a resumed
session as an orphan-process smell first, a code regression second. Kill the orphan, re-run once,
and only chase it as a real bug if it persists after the port is confirmed free.
