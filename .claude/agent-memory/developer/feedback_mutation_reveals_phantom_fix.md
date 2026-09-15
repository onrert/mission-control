---
name: mutation-reveals-phantom-fix
description: A mutation that disables a specific fix and produces 0 FAIL means either the fix is genuinely unneeded, OR (more dangerous) the fix never actually fires because something else masks it — investigate before assuming the mechanism is redundant/dead code.
metadata:
  type: feedback
---

While closing the `>|` (clobber redirect) leak in `block-dangerous.cjs` v5, I extended
`hooksRedirectV5`/`approvalsRedirectV5` to match `>|` as well as `>`/`>>`, added a self-test case,
and it passed. A mutation test (`MUT-REDIRECT-V5-OFF`, disabling exactly that regex extension)
then showed **0 FAIL** — the intended fix appeared to add zero protective value.

Root cause on investigation: the shared `splitCommandSegments` treated bare `|` as an
unconditional pipe separator, with no exception for `>|` (unlike the existing `&`/`&>` exception
already in the same function). So `echo x >| .claude/hooks/gate-check.cjs` was being split into
`["echo x >", ".claude/hooks/gate-check.cjs"]`, and the second segment — being *just* the bare
path — was independently caught by an unrelated rule (non-reader head + self-mention). The
regex fix I shipped was **never actually executing** on this test vector; the test was green by
coincidence via a different code path.

**Why:** this is the mutation-testing equivalent of [[feedback_own_diagnostic_commands_trigger_hooks]]'s
sibling lesson in this repo ("a green test doesn't prove the mechanism you think is being tested
is the one doing the work") — already a named repo rule ("her çitin kendi pozitif kontrolü
olmalı" / "ölçülmeyen mekanizma bulgu sayılır" in CLAUDE.md), but this is the first time it
surfaced from a **mutation showing 0/0** rather than a mutation showing unexpected FAILs.

**How to apply:** when a mutation of a specific, deliberate fix shows 0 FAIL, don't record it as
"this fix is safe to remove" or silently drop it — trace *why* the vector still passes without it.
If another mechanism coincidentally covers it, that's a legitimate defense-in-depth finding (write
it up honestly, as done in hook-polarite-contract.md §7.5), but check first whether it's instead a
sign the "fix" never fires at all (as it was here) — in which case there's a second, real bug
(here: the segmentation function itself) that the mutation just exposed as a side door.
