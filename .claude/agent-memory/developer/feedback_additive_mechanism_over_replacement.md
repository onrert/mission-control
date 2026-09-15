---
name: additive-mechanism-over-replacement
description: When a brief demands both a design-philosophy flip (e.g. blacklist -> capability-based allowlist) AND zero regression against several prior versions, implement the new logic as an ADDITIONAL OR-condition beside the frozen old mechanism, not a replacement.
metadata:
  type: feedback
---

In the v5 "polarity flip" turn for `block-dangerous.cjs` (docs/qa/hook-polarite-contract.md), the
brief asked to replace the `writeVerb` blacklist decision with a "is the head command a known
reader" capability test. A pure replacement design was drafted first and would have **regressed**
two existing, must-stay-blocked self-test cases (F-BOUNDARY: `grep rm docs/approvals/README.md`;
RETREAT-HEREDOC-M2v2: `cat >> ... <<'EOF' ... cp ... docs/approvals ... EOF`) — both have a reader
head (`grep`/`cat`) but a write verb + protected path elsewhere in the same blob/segment text,
which a "reader head -> always exempt" rule would silently let through.

**Why:** the brief's own absolute constraint ("must not pass anything v0/v1/v3/v4 currently
blocks") is stronger than the "replace the mechanism" framing suggests. A capability-based
redesign and a zero-regression guarantee are in tension whenever the old mechanism's decision
doesn't reduce to a strict subset of the new one's.

**How to apply:** keep the old mechanism's code and decision **completely unmodified** (byte-for-
byte, not just "logically equivalent") as "Mechanism 1", and add the new capability-based logic as
"Mechanism 2" with its own independent decision computed from the same segments, then take
`isBlocked = Mechanism1(seg) || Mechanism2(seg)`. This makes the zero-regression property
**structural** (Mechanism 1 literally cannot lose any blocking power since nothing in it changed)
while Mechanism 2 closes new gaps. Document explicitly *why* additive-not-replace was chosen (name
the two conflicting test cases) so a future reviewer doesn't "simplify" it back into a replacement
and reopen the regression. See also [[feedback_mutation_reveals_phantom_fix]].
