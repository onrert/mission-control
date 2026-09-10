---
name: project-guard-scope-prose-leak
description: gate-check.cjs's parseGuardScope() picks up backtick-quoted .cjs filenames anywhere in GUARD.ok's prose, not just its Kapsam section — writing a renewal note that mentions old filenames in backticks silently widens the approval's real scope
metadata:
  type: project
---

`.claude/hooks/gate-check.cjs`'s `parseGuardScope()` extracts scope by regex-matching every
backtick-quoted token in the whole `docs/approvals/GUARD.ok` file that looks like `` `name.cjs` ``
— it does not restrict itself to the "## Kapsam" section. `GUARD.ok` renewal notes conventionally
explain *why* the token was renewed, and that narrative naturally references other hook
filenames in backticks (e.g. "the previous scope covered `` `gate-check.cjs` ``,
`` `block-dangerous.cjs` ``, `` `_selftest.cjs` ``"). Every one of those prose mentions is parsed
as an *additional* live scope entry, silently widening what the token actually authorizes beyond
the "## Kapsam" list a human would read as authoritative.

**Why:** caught live on 2026-09-10 (G5 tur4 follow-up) — a GUARD.ok renewal note explaining a
prior failure mentioned `` `gate-check.cjs` `` in its explanatory prose, and the resulting
`docs/approvals/.guard-state.json` showed the actual computed scope as
`[".claude/hooks/_selftest.cjs", ".claude/hooks/gate-check.cjs"]`, not the single file the
"## Kapsam" section named. This happened *twice* in the same day across two different renewals
of the same token, both times because the renewal's own "why" narrative named other hook files.

**How to apply:** when writing or renewing `docs/approvals/GUARD.ok`, never wrap a `.cjs`
filename in backticks anywhere outside the "## Kapsam" list — including when explaining history
or a previous failure. Refer to those files without backticks (e.g. "the file that resolves
paths" or plain `gate-check.cjs` without backtick marks) if they must be named in prose. This is
a real, currently-unfixed bug in `parseGuardScope()` (out of scope to fix casually — it's in
`.claude/hooks/**`, see [[feedback_autonomous_hook_edit_blocked]] for why that's hard to
land autonomously); until it's fixed, treat every GUARD.ok write as scope-leak-prone and verify
the resulting `docs/approvals/.guard-state.json` scopeKey after the first touch if you need to
confirm what's actually authorized.
