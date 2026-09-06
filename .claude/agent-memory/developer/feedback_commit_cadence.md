---
name: feedback-commit-cadence
description: Commit WIP work every 2-3 steps in this repo, never wait until a task feels "done"
metadata:
  type: feedback
---

Commit early and often — every 2-3 meaningful edits/steps, not just at the end of a task. If a
turn-limit cutoff happens mid-task, the very first action on resume must be committing whatever
is on disk (even if tests are red / work is incomplete, commit as WIP) before doing anything else.

**Why:** this project's developer-agent turns have hit a 150-turn cutoff multiple times with large
amounts of uncommitted, unrecoverable-feeling work sitting on disk (one instance had ~444k tokens
of work across 11 files sitting uncommitted). The user's instructions on resume have explicitly
and repeatedly (three times by their own count) had to demand "commit first, ask questions later"
because this wasn't happening proactively. This is a recurring failure mode specific to how this
repo's sessions get interrupted, not a one-off.

**How to apply:** in any multi-file / multi-step implementation task in this repo, treat "commit
after every 2-3 steps" as a hard default, not an optional nicety. On resuming a session that
inherited uncommitted changes from a prior cutoff, commit those changes as the literal first tool
action, before reading QA reports, before planning, before anything else — even if the commit
message has to say "WIP, not all criteria closed yet."
