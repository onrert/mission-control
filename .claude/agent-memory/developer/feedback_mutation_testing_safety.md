---
name: feedback-mutation-testing-safety
description: Never use `git checkout -- <file>` to revert a manual mutation on a file with uncommitted WIP changes — it wipes the whole file back to HEAD, not just the mutation.
metadata:
  type: feedback
---

When manually verifying a fix with mutation testing (apply mutation → confirm RED → revert),
never revert the mutation with `git checkout -- <file>` if that file still has *uncommitted*
real fix changes in it. `git checkout --` restores the file to the last commit (HEAD), which
silently discards ALL uncommitted edits in that file, not just the mutation snippet you just
added. This happened on F-010's fix round: a mutation was applied to `thread-detail.ts` to
verify the M11 gate, and `git checkout --` was used to "revert" it — but it actually erased the
entire B1/X1/X5/X6 fix that had not yet been committed, requiring a full manual reconstruction
from a prior tool-output snapshot to recover.

**Why:** `git checkout -- <path>` has no concept of "just the last edit" — it is a hard reset of
that single file to whatever is in the index/HEAD. It looks safe because it's scoped to one file,
but that scoping is exactly what makes it easy to reach for during rapid mutate→test→revert loops
without registering that the file itself is still dirty with real work.

**How to apply:** Before doing any manual mutation-testing loop (mutate → run test → confirm red
→ revert), either (a) commit the real fix first so `git checkout --`/`git stash` is safe to use
as a revert mechanism, or (b) revert the mutation by hand (undo just the specific edit, e.g. via
a second Edit call or by re-applying the known-good snippet) rather than any git command that
operates on the whole file. Prefer (a) — commit real fixes before mutation-testing them — since
it also satisfies the repo's "commit every 2-3 steps" cadence and makes recovery trivial if a
mutation-revert mistake happens anyway.
