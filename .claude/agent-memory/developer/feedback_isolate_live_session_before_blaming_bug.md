---
name: isolate-live-session-before-blaming-bug
description: When a cross-check against an external tool (ccusage, etc.) shows a large aggregate deviation, break it down per-session/per-unit before assuming a real bug — the currently-active session is usually the entire cause.
metadata:
  type: feedback
---

When comparing an aggregate total this app computes (e.g. token usage) against an independent
tool's total (e.g. `ccusage session`), a large percentage gap (I saw 10.65%) can look exactly
like a real dedup/counting bug. Before concluding that, split the comparison by the smallest
unit that both sides key on (here: session id) and diff each one individually.

In F-011's Z7 verification, doing this showed **66 of 67 sessions matched byte-for-byte (0
deviation)** — the entire 10.65% gap came from the ONE session that was still actively growing
while I took the two measurements at slightly different instants (a classic "sandwich" timing
artifact, same class CLAUDE.md already documents for QA's %0.19 finding, just worse here because
the live session had much heavier recent activity).

**Why:** Jumping straight to "the aggregate is off by 10%, something is broken" would have sent
me hunting for a phantom regression in already-verified dedup logic (Z1), wasting a full
investigation cycle. The per-unit breakdown took ~2 minutes and gave a definitive answer.

**How to apply:** Any time this repo cross-checks a computed total against ccusage, another
tool, or a re-implementation, and the deviation is bigger than expected — group both sides by
the same key (session id, file, day) and diff per-group before writing a bug report or a
"known deviation" number into docs. Report the per-group finding honestly (e.g. "0% for closed
sessions, all gap from the one live session") rather than a single misleading aggregate percentage.
