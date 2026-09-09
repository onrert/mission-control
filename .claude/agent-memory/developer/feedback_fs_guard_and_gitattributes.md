---
name: feedback-fs-guard-and-gitattributes
description: Two repo-specific gotchas hit while building F-009 (transcript reader) that will recur in any feature touching fs or committing byte-exact fixtures.
metadata:
  type: feedback
---

**1. `tests/no-write-gate-bypass.test.ts` bans ALL low-level fd-based fs calls across every file
under `src/**` — including read-only ones, and including plain-text mentions inside comments.**

The guard does a naive substring/call-shape scan (not comment-aware) for names like `openSync(`,
`readSync(`, `writeSync(`, etc. It doesn't distinguish "opened for read" from "opened for write" —
`fs.openSync(path, 'r')` is flagged exactly like a write call, because in this repo *all* low-level
fd access is reserved for `src/server/write-gate.ts` and a short allowlist of store files
(`STORE_FILES` map in that test, keyed by exact file + exact call text). Writing a comment like
`` `fs.openSync`/`fs.readSync` DEĞİL `` will *still* trip the guard if the literal substring
`openSync(` appears anywhere in the file, comment or not.

**Why:** discovered while implementing a "read only the last 32MB of a large file" optimization in
`transcript-reader.ts` — the fd-based tail-read implementation failed `npm run verify` even though
it never wrote anything, and even the *explanatory comment* about avoiding `openSync` tripped it a
second time after the code fix.

**How to apply:** for any new feature that needs partial/random-access file reads (not full-file
`fs.readFileSync`), don't reach for `fs.openSync`/`fs.readSync`/`fs.closeSync`. Either (a) do the
read with `fs.readFileSync` (unconditionally allowed, not gated) and slice in memory, or (b) if
true partial reads are unavoidable, that's a sign the file may need to go through `write-gate.ts`'s
allowlist — raise it as a scope question rather than silently bypassing. Before assuming a fix
works, run `npm run verify` (or at minimum `npx vitest run tests/no-write-gate-bypass.test.ts`) —
typecheck/lint won't catch this, only that specific repo-wide test will.

**2. The repo's root `.gitattributes` (`* text=auto eol=lf`) silently normalizes CRLF → LF on
`git add`, which will destroy any fixture whose entire purpose is testing CRLF line endings.**

**Why:** a `bom-crlf.jsonl` test fixture (byte-exact BOM + CRLF, intentionally) got a
"CRLF will be replaced by LF" warning on `git add` — the normalization happens at add/commit time,
not just checkout, so the staged blob would have silently lost the CRLF bytes the test exists to
exercise.

**How to apply:** any fixture (in any feature) that needs exact, non-normalized bytes (CRLF, BOM,
binary, deliberately malformed encoding) needs a scoped `.gitattributes` override — e.g. a
`.gitattributes` file inside the fixture directory itself containing `* -text` — created *before*
`git add`. If you've already staged the file and get the CRLF warning, `git rm --cached` it, add
the `.gitattributes`, then re-add and diff the staged blob's bytes (`git show :path | xxd`) against
the working-tree file to confirm they're identical before committing.
