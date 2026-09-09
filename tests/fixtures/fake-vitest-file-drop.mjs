// Fixture reproducing docs/qa/test-skip-gate-2026-09-10.md section 3 (B1a)
// EXACTLY: a whole test file (16 tests) silently dropped from a real run via
// a CLI --exclude flag. Vitest's own summary arithmetic is internally
// consistent on BOTH lines (sum == total) and vitest exits 0 -- this shape
// is invisible to the crash-signature check and the sum-vs-total check. It
// is only caught by the disk-file-count comparison (evaluateOutput's
// expectedFileCount option / scripts/verify-test-run.mjs section 2b).
console.log(' Test Files  84 passed | 1 skipped (85)')
console.log('      Tests  1307 passed | 4 skipped (1311)')
process.exit(0)
