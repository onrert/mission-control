// Fixture: no recognizable summary line at all, exit 0. The gate must fail
// closed here rather than assume success in the face of unrecognized
// output (e.g. a vitest output-format change, or a total collection
// failure that still exits 0).
console.log('something unexpected happened, there is no summary at all')
process.exit(0)
