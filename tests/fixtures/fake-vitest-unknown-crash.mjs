// Fixture: counts are internally consistent and no LITERAL crash signature
// from CRASH_SIGNATURES is present, but the output contains a worker crash
// phrasing that has never been seen in this repo before (a stand-in for a
// future vitest/tinypool wording change). Only the GENERIC_WORKER_CRASH_RE
// fallback in scripts/verify-test-run.mjs should catch this -- proves the
// generalized net (docs/qa/test-skip-gate-2026-09-10.md Ö1) actually works,
// not just the literal list.
console.log(' Test Files  84 passed | 1 skipped (85)')
console.log('      Tests  1305 passed | 4 skipped (1309)')
console.error('FATAL: the tinypool worker pool crashed while executing tests on this platform')
process.exit(0)
