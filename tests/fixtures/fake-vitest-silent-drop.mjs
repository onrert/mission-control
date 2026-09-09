// Fixture reproducing the exact shape reported in docs/blockers.md
// (2026-09-10): vitest's own summary counts do not sum to its own total
// (9 tests silently missing here), yet the process exits 0 as if nothing
// was wrong. This is the bug the gate in scripts/verify-test-run.mjs exists
// to catch.
console.log(' Test Files  83 passed | 1 skipped (85)')
console.log('      Tests  1296 passed | 4 skipped (1309)')
process.exit(0)
