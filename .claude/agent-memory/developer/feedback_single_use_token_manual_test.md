---
name: feedback-single-use-token-manual-test
description: manually invoking a single-use-token-consuming hook script (node hook.cjs < stdin) for verification can burn the real token exactly like a genuine Edit/Write call
metadata:
  type: feedback
---

Never include the exact-case, currently-guarded real path in an ad-hoc `echo '{...}' | node
.claude/hooks/gate-check.cjs` (or similar) verification command while a single-use approval
token (GUARD.ok / DANGER.ok / PUSH.ok) is present on disk. The hook script cannot tell a
manual diagnostic invocation from a real PreToolUse call — if `isGuarded && exists(token)` is
true it calls `consume()` and deletes the token, with zero code change to show for it.

**Why:** Burned the only granted `GUARD.ok` this way during a G5 hardening task: ran a batch
of `node gate-check.cjs` baseline/"before" checks that included the real
`.claude/hooks/block-dangerous.cjs` path (meant as a regression check) while GUARD.ok existed.
Exit was 0 as "expected" but the side effect (token consumption) was invisible until a
follow-up `test -f` check. Zero Edit/Write tool calls had happened — the whole task stalled at
0 code changes, and per this project's rule ("token boşa giderse dur ve bana raporla, kendin
yeniden yazma") a fresh token had to be requested from the user rather than self-issued. This
is documented in the repo as the third time a single-use approval token was wasted
(see CLAUDE.md's learned-rules list) — the first two were via chained Bash commands, this one
via manual hook testing.

**How to apply:** Before running any manual/diagnostic invocation of a hook script that
consumes a single-use token, first `test -f docs/approvals/<TOKEN>.ok` and if it exists,
either (a) skip the exact-case/real-guarded-path test case from that batch entirely, or
(b) only test the negative (token-absent, expect-block) vectors, or (c) do the real Edit/Write
first (consuming the token for the actual code change) and derive "before" evidence from the
pre-edit file content/behavior captured *before* the token ever existed, not from a live
re-run of the hook. Related: [[feedback_mutation_testing_safety]].
