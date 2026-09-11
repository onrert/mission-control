---
name: feedback-mutation-script-via-file-not-bash-e
description: writing a regex-mutation via `node -e "..."` inside a Bash heredoc/one-liner can silently fail to apply (escaping), giving false "mutation didn't change behavior" confidence — write the mutator as a scratchpad .cjs file instead
metadata:
  type: feedback
---

When doing required mutation-testing proof (see [[feedback_mutation_testing_safety]]) by
programmatically flipping a regex in a hook source file, don't pass the mutation logic as a
`node -e "..."` string embedded in a Bash command. Backslash-heavy regex literals
(`\\b(del|erase|rm|unlink)\\b`) get mangled by Bash's own escaping inside `-e "..."` and the
script can run with exit 0 while silently failing its own `if (s === before) exit 1` guard-check
in a way that's easy to misread, or — worse — silently no-op without an explicit guard.

**Why:** During the hook-borçları RM-gap closure (2026-09-11), a first mutation attempt via
`node -e "s.replace(/\\\\b\\(del\\|erase\\|rm\\|unlink\\)\\\\b/, ...)"` printed
`MUTATION DID NOT APPLY` (caught by an explicit guard) instead of silently corrupting the file —
but only because a guard happened to be present. Without one, a bash-escaping failure looks
identical to "the mutation was a no-op, so the test suite is right to stay green" — the opposite
of what mutation testing is supposed to prove.

**How to apply:** For any mutation-testing step, write a tiny `.cjs` file to the scratchpad with
`Write`, doing a plain `string.split(needle).join(replacement)` (no regex-in-regex escaping) and
an explicit `if (!s.includes(needle)) { console.error('NEEDLE NOT FOUND'); process.exit(1); }`
guard before writing. Run it with `node scratch-mutator.cjs <target>`, not as a Bash `-e` one-liner.
Always diff the mutated file against source-of-truth after reverting, to prove the revert was
byte-exact (not just "tests pass again").
