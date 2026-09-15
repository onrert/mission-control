---
name: msys-cmd-c-arg-mangling
description: On Windows Git Bash, `cmd /c "..."` and `cmd //c "..."` frequently fail to actually invoke cmd's /c switch — MSYS mangles the leading `/c` — so don't trust a live "positive control" run of a `cmd /c` attack vector as proof it works; the hook's text-match block is still valid independent of this.
metadata:
  type: feedback
---

While building a live-proof harness for `block-dangerous.cjs` (hook-borclari M2 v3 turn), I tried
to demonstrate real file impact of `cmd /c "del docs\approvals\G5.ok"` both with and without the
hook in the way. The command never actually deleted the file in EITHER mode — running it directly
in the Bash tool also just printed the `cmd.exe` banner and returned to a prompt, with no
deletion. Root cause: Git-for-Windows' MSYS layer auto-converts POSIX-looking `/x` arguments to
Windows paths, and `/c` (and `//c`) get mangled before `cmd.exe` ever sees a real `/c` switch —
so `cmd /c <anything>` launched from Git Bash is unreliable for actually running the payload,
independent of any hook.

**Why:** I initially logged this as a hook "FAIL" (positive control showed no change) before
realizing the *unprotected* copy of the same command also didn't change anything — the command
itself never executed as intended in this shell, not because a hook caught it.

**How to apply:** When a `cmd /c "..."` (or `pwsh -c "..."`, if not installed) vector's live
positive-control run shows "no change," verify it isn't a shell/environment artifact before
concluding the hook is ineffective — try running the *exact same string* directly, unprotected,
in the Bash tool first. If it does nothing there either, the hook's text-based block is still
correctly proven by the fact that it returns exit 2 for that string (pattern matching doesn't
require the payload to be executable) — just document the positive-control gap honestly instead
of silently dropping the vector or mis-scoring the hook.
