// Fixture: counts are internally consistent (nothing looks missing) but the
// output contains a known crash signature anyway. The gate must fail on the
// text signature independently of the arithmetic check, since we could not
// prove the two failure modes are always the same race (see
// docs/qa/test-skip-gate-contract.md, section 1).
console.log(' Test Files  84 passed | 1 skipped (85)')
console.log('      Tests  1305 passed | 4 skipped (1309)')
console.log('Error: [vitest-pool]: Worker forks emitted error.')
process.exit(0)
