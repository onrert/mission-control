// Fixture: a genuinely failing run (real failing tests, vitest's own exit
// code is already 1). The gate must not mask this or turn it green.
console.log(' Test Files  1 failed | 84 passed (85)')
console.log('      Tests  3 failed | 1302 passed | 4 skipped (1309)')
process.exit(1)
