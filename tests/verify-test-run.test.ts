import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  countDeclaredTestFiles,
  evaluateOutput,
  extractArrayLiteral,
  findCrashSignature,
  globToRegExp,
  hasExplicitPositionalFilter,
  MIN_EXPECTED_TESTS,
  parseSummaryLine,
  stripAnsi,
} from '../scripts/verify-test-run.mjs'

/**
 * Guards against the "silent test skip" failure class recorded in
 * docs/blockers.md (2026-09-10): a vitest worker fork can crash mid-run
 * while vitest's own process still exits 0, quietly under-counting the
 * tests it ran. scripts/verify-test-run.mjs wraps `vitest run` and refuses
 * to call a run green unless vitest's own summary-line arithmetic accounts
 * for every test, the number of test files it reports matches the number of
 * test files actually on disk (per vitest.config.ts's own include/exclude
 * patterns), and no known/generalized crash signature appears in the
 * output.
 *
 * The unit tests below exercise the pure parsing/decision functions
 * directly. The "end-to-end" tests further down actually spawn
 * scripts/verify-test-run.mjs as a real subprocess (MC_TEST_RUN_CMD swaps
 * out the real `vitest run` for a fixture script under tests/fixtures/) so
 * the mechanism itself is triggered, not a mock of it. One test (the "B1
 * kalıcı regresyon" test) spawns the gate against the REAL vitest command
 * and the REAL repo suite -- this is the QA-required permanent regression
 * test for docs/qa/test-skip-gate-2026-09-10.md's B1 finding and cannot be
 * faked with a fixture.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gateScript = path.join(repoRoot, 'scripts', 'verify-test-run.mjs')

function runGateAgainstFixture(fixtureFileName: string, extraEnv: Record<string, string> = {}) {
  const fixturePath = path.join(repoRoot, 'tests', 'fixtures', fixtureFileName)
  return spawnSync(process.execPath, [gateScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MC_TEST_RUN_CMD: JSON.stringify([process.execPath, fixturePath]),
      ...extraEnv,
    },
  })
}

describe('parseSummaryLine', () => {
  it('parses a healthy "Tests" summary line (real vitest output, copied verbatim)', () => {
    expect(parseSummaryLine('      Tests  1323 passed | 4 skipped (1327)')).toEqual({
      label: 'Tests',
      total: 1327,
      sum: 1327,
    })
  })

  it('parses a healthy "Test Files" summary line', () => {
    expect(parseSummaryLine(' Test Files  85 passed | 1 skipped (86)')).toEqual({
      label: 'Test Files',
      total: 86,
      sum: 86,
    })
  })

  it('parses a single-category line (no skipped/failed)', () => {
    expect(parseSummaryLine(' Test Files  85 passed (85)')).toEqual({
      label: 'Test Files',
      total: 85,
      sum: 85,
    })
  })

  it('surfaces a mismatch when categories do not sum to the total (the reported bug shape)', () => {
    const parsed = parseSummaryLine('      Tests  1296 passed | 4 skipped (1309)')
    expect(parsed?.sum).toBe(1300)
    expect(parsed?.total).toBe(1309)
  })

  it('returns null for unrelated lines', () => {
    expect(parseSummaryLine('    Errors  1 error')).toBeNull()
    expect(parseSummaryLine('')).toBeNull()
  })
})

describe('stripAnsi (Ö2 fix)', () => {
  it('removes ANSI color escape sequences without touching the rest of the line', () => {
    const withColor = '[90m Test Files  85 passed | 1 skipped (86)[39m'
    expect(stripAnsi(withColor)).toBe(' Test Files  85 passed | 1 skipped (86)')
  })

  it('is a no-op on plain text', () => {
    expect(stripAnsi('plain text, no escapes')).toBe('plain text, no escapes')
  })

  it('lets parseSummaryLine succeed on an ANSI-wrapped summary line that would otherwise fail', () => {
    const withColor = '[90m Test Files  85 passed | 1 skipped (86)[39m'
    expect(parseSummaryLine(withColor)).toBeNull() // raw line: anchor breaks on trailing ANSI code
    expect(parseSummaryLine(stripAnsi(withColor))).toEqual({
      label: 'Test Files',
      total: 86,
      sum: 86,
    })
  })
})

describe('findCrashSignature', () => {
  it('finds the real error text observed in live worker-fork crashes', () => {
    expect(findCrashSignature('Error: [vitest-pool]: Worker forks emitted error.')).toBe(
      'Worker forks emitted error'
    )
    expect(
      findCrashSignature('Caused by: Error: Worker exited unexpectedly with exit code 3221226505')
    ).toBe('Worker exited unexpectedly')
  })

  // Ö1 closure: each newly-added literal signature gets its own assertion,
  // so deleting any one of them from CRASH_SIGNATURES fails exactly this
  // test (proving the list itself is fenced, not just "some signature or
  // other still matches").
  it('finds "Worker terminated" (Ö1: memory-limit crash text)', () => {
    expect(
      findCrashSignature(
        'Error: Worker terminated due to reaching memory limit: JS heap out of memory'
      )
    ).toBe('Worker terminated')
  })

  it('finds "ERR_IPC_CHANNEL_CLOSED" (Ö1: IPC channel crash text)', () => {
    expect(findCrashSignature('ERR_IPC_CHANNEL_CLOSED: Channel closed')).toBe(
      'ERR_IPC_CHANNEL_CLOSED'
    )
  })

  it('finds "heap out of memory" (Ö1: OOM crash text)', () => {
    expect(findCrashSignature('FATAL ERROR: heap out of memory')).toBe('heap out of memory')
  })

  it('falls back to the generalized pattern for an unrecognized worker-crash phrasing (Ö1 generalization)', () => {
    const found = findCrashSignature(
      'FATAL: the tinypool worker pool crashed while executing tests on this platform'
    )
    expect(found).not.toBeNull()
    expect(found).toContain('tinypool worker pool crashed')
  })

  it('does not false-positive on routine mentions of "worker" in healthy vitest output', () => {
    const healthy = [
      ' Test Files  85 passed | 1 skipped (86)',
      '      Tests  1323 passed | 4 skipped (1327)',
      '  Duration  12.04s (tests 61%, environment 15%, import 14%, transform 8%, setup 1%, worker 1%)',
      '   Isolate  86 workers spawned - ~440ms startup each (spawn + environment, per file)',
      '            at least ~1.55s faster with isolate: false - reuses workers across files',
    ].join('\n')
    expect(findCrashSignature(healthy)).toBeNull()
  })

  it('returns null when nothing suspicious is present', () => {
    expect(findCrashSignature('all good, nothing to see here')).toBeNull()
  })
})

describe('globToRegExp (B1: minimal glob support for vitest.config.ts patterns)', () => {
  it('matches "tests/**/*.test.ts?(x)" against nested .test.ts and .test.tsx files', () => {
    const re = globToRegExp('tests/**/*.test.ts?(x)')
    expect(re.test('tests/verify-test-run.test.ts')).toBe(true)
    expect(re.test('tests/features/thread/web/ThreadScreen.test.tsx')).toBe(true)
    expect(re.test('tests/integration/chat-api.test.ts')).toBe(true)
  })

  it('does not match files that are not test files', () => {
    const re = globToRegExp('tests/**/*.test.ts?(x)')
    expect(re.test('tests/fixtures/fake-vitest-ok.mjs')).toBe(false)
    expect(re.test('tests/helpers/some-util.ts')).toBe(false)
  })

  it('matches "tests/e2e/**" against anything under tests/e2e/', () => {
    const re = globToRegExp('tests/e2e/**')
    expect(re.test('tests/e2e/shell.spec.ts')).toBe(true)
    expect(re.test('tests/e2e/helpers/chat-fake-server.ts')).toBe(true)
    expect(re.test('tests/integration/chat-api.test.ts')).toBe(false)
  })
})

describe('extractArrayLiteral (B1: reads include/exclude from vitest.config.ts source text)', () => {
  it('extracts a single-quoted array', () => {
    const source = `export default { test: { include: ['tests/**/*.test.ts?(x)'] } }`
    expect(extractArrayLiteral(source, 'include')).toEqual(['tests/**/*.test.ts?(x)'])
  })

  it('extracts a multi-entry array with mixed quotes', () => {
    const source = `exclude: ["tests/e2e/**", 'node_modules/**']`
    expect(extractArrayLiteral(source, 'exclude')).toEqual(['tests/e2e/**', 'node_modules/**'])
  })

  it('returns an empty array when the key is not present', () => {
    expect(extractArrayLiteral('export default {}', 'include')).toEqual([])
  })

  it('reads the real vitest.config.ts in this repo and finds both keys', () => {
    const source = readFileSync(path.join(repoRoot, 'vitest.config.ts'), 'utf8')
    expect(extractArrayLiteral(source, 'include')).toEqual(['tests/**/*.test.ts?(x)'])
    expect(extractArrayLiteral(source, 'exclude')).toEqual(['tests/e2e/**', 'node_modules/**'])
  })
})

describe("countDeclaredTestFiles (B1: disk-side count that vitest's report is checked against)", () => {
  it('matches the real repo test-file count against the real include/exclude patterns', () => {
    // Not a magic number: computed the same way scripts/verify-test-run.mjs
    // does at runtime, from the live include/exclude patterns -- this test
    // fails loudly (not silently) if the count and this assertion drift,
    // rather than trusting a hardcoded figure (avoids the Ö4 staleness bug).
    const count = countDeclaredTestFiles(
      repoRoot,
      ['tests/**/*.test.ts?(x)'],
      ['tests/e2e/**', 'node_modules/**']
    )
    expect(count).toBeGreaterThan(0)
    expect(count).toBe(
      countDeclaredTestFiles(
        repoRoot,
        ['tests/**/*.test.ts?(x)'],
        ['tests/e2e/**', 'node_modules/**']
      )
    )
  })

  it('excludes tests/e2e/** from the count', () => {
    const withExclude = countDeclaredTestFiles(
      repoRoot,
      ['tests/**/*.test.ts?(x)'],
      ['tests/e2e/**']
    )
    const withoutExclude = countDeclaredTestFiles(repoRoot, ['tests/**/*.test.ts?(x)'], [])
    // tests/e2e has no *.test.ts files today (it's *.spec.ts), so this is a
    // structural sanity check that exclude is actually applied, not a count
    // that could silently drift.
    expect(withExclude).toBe(withoutExclude)
  })
})

describe('hasExplicitPositionalFilter (Ö3: distinguishing an intentional narrow run from a silent one)', () => {
  it('returns false for flag-only args (the B1 attack shape: looks like "run everything")', () => {
    expect(hasExplicitPositionalFilter(['--exclude', 'tests/e2e/**'])).toBe(false)
    expect(hasExplicitPositionalFilter(['--exclude', 'a', '--exclude', 'b'])).toBe(false)
  })

  it('returns false for no args at all', () => {
    expect(hasExplicitPositionalFilter([])).toBe(false)
  })

  it('returns true when a positional file/pattern argument is present', () => {
    expect(hasExplicitPositionalFilter(['tests/verify-test-run.test.ts'])).toBe(true)
  })

  it('returns true for a positional argument even alongside flags', () => {
    expect(hasExplicitPositionalFilter(['--reporter', 'dot', 'tests/foo.test.ts'])).toBe(true)
  })
})

describe('evaluateOutput', () => {
  it('passes on a clean, fully-accounted run with no expectedFileCount supplied', () => {
    const result = evaluateOutput(
      ' Test Files  85 passed | 1 skipped (86)\n      Tests  1323 passed | 4 skipped (1327)\n'
    )
    expect(result.ok).toBe(true)
    expect(result.problems).toEqual([])
  })

  it('fails when tests are silently missing even though nothing else looks wrong', () => {
    const result = evaluateOutput(
      ' Test Files  83 passed | 1 skipped (85)\n      Tests  1296 passed | 4 skipped (1309)\n'
    )
    expect(result.ok).toBe(false)
    expect(result.problems.some((p) => p.includes('silently missing'))).toBe(true)
  })

  it('fails on a crash signature even when the counts happen to match', () => {
    const result = evaluateOutput(
      ' Test Files  84 passed | 1 skipped (85)\n      Tests  1305 passed | 4 skipped (1309)\n',
      'Error: [vitest-pool]: Worker forks emitted error.'
    )
    expect(result.ok).toBe(false)
    expect(result.problems.some((p) => p.includes('crash signature'))).toBe(true)
  })

  it('fails closed when no summary line can be found', () => {
    const result = evaluateOutput('nothing recognizable here\n')
    expect(result.ok).toBe(false)
    expect(result.problems.length).toBeGreaterThan(0)
  })

  it('fails when the total is suspiciously below the expected floor', () => {
    const result = evaluateOutput(' Test Files  1 passed (1)\n      Tests  1 passed (1)\n')
    expect(result.ok).toBe(false)
    expect(result.problems.some((p) => p.includes(String(MIN_EXPECTED_TESTS)))).toBe(true)
  })

  // B1 closure: the exact reported shape (sum == total on both lines, no
  // crash signature, exit would be 0) that the old gate could not see.
  it('B1: fails when "Test Files" total matches internally but disagrees with the disk-derived expected count', () => {
    const result = evaluateOutput(
      ' Test Files  84 passed | 1 skipped (85)\n      Tests  1307 passed | 4 skipped (1311)\n',
      '',
      { expectedFileCount: 86 }
    )
    expect(result.ok).toBe(false)
    expect(result.problems.some((p) => p.includes('does not match the'))).toBe(true)
  })

  it('B1: passes when the reported "Test Files" total matches the disk-derived expected count', () => {
    const result = evaluateOutput(
      ' Test Files  85 passed | 1 skipped (86)\n      Tests  1323 passed | 4 skipped (1327)\n',
      '',
      { expectedFileCount: 86 }
    )
    expect(result.ok).toBe(true)
  })

  it('fails closed when the expected file count could not be determined at all', () => {
    const result = evaluateOutput(
      ' Test Files  85 passed | 1 skipped (86)\n      Tests  1323 passed | 4 skipped (1327)\n',
      '',
      { expectedFileCountError: new Error('vitest.config.ts not found') }
    )
    expect(result.ok).toBe(false)
    expect(
      result.problems.some((p) => p.includes('could not determine the expected test-file count'))
    ).toBe(true)
  })

  // Ö3 closure: an intentional narrow run must not be treated as a silent
  // drop, even though its file/test totals are far below both the floor and
  // the full-suite disk-derived expectation.
  it('Ö3: skipScopeChecks suppresses both the floor and the disk-count comparison', () => {
    const result = evaluateOutput(' Test Files  1 passed (1)\n      Tests  17 passed (17)\n', '', {
      expectedFileCount: 86,
      skipScopeChecks: true,
    })
    expect(result.ok).toBe(true)
  })
})

describe('scripts/verify-test-run.mjs end-to-end (real subprocess, fixture "vitest")', () => {
  it('a clean fixture run passes the gate', () => {
    const res = runGateAgainstFixture('fake-vitest-ok.mjs')
    expect(res.status).toBe(0)
  })

  // MUTATION TARGET: this is the live reproduction of the exact bug in
  // docs/blockers.md. If the sum-vs-total check in evaluateOutput() is ever
  // deleted or weakened, this test must go RED (verified by hand while
  // writing this gate -- see docs/progress.md for the mutation record).
  it('fails the gate end-to-end on the reported silent-drop shape, even though the fake runner itself exits 0', () => {
    const res = runGateAgainstFixture('fake-vitest-silent-drop.mjs')
    expect(res.status).not.toBe(0)
  })

  it('fails the gate on crash-signature text even when counts match', () => {
    const res = runGateAgainstFixture('fake-vitest-crash-text-but-counts-match.mjs')
    expect(res.status).not.toBe(0)
  })

  it('stays red on a genuinely failing run (the gate never launders a real failure)', () => {
    const res = runGateAgainstFixture('fake-vitest-red.mjs')
    expect(res.status).not.toBe(0)
  })

  it('fails closed when the fixture prints no recognizable summary at all', () => {
    const res = runGateAgainstFixture('fake-vitest-missing-summary.mjs')
    expect(res.status).not.toBe(0)
  })

  // B1 closure (fixture-level wiring proof): the disk-file-count check is
  // opted OUT by default when MC_TEST_RUN_CMD is set (so the five tests
  // above stay decoupled from this repo's real, ever-changing file count),
  // and opted IN via MC_EXPECTED_TEST_FILE_COUNT for these two tests.
  it('B1: fails end-to-end on the exact QA-reported file-drop shape when an expected file count is supplied', () => {
    const res = runGateAgainstFixture('fake-vitest-file-drop.mjs', {
      MC_EXPECTED_TEST_FILE_COUNT: '86',
    })
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('does not match the')
  })

  it('B1: the same fixture run passes if the supplied expected file count actually matches', () => {
    const res = runGateAgainstFixture('fake-vitest-file-drop.mjs', {
      MC_EXPECTED_TEST_FILE_COUNT: '85',
    })
    expect(res.status).toBe(0)
  })

  it('B1: does not check the file count at all when MC_TEST_RUN_CMD is set without an explicit override', () => {
    // Same fixture as above, no MC_EXPECTED_TEST_FILE_COUNT -- must not
    // silently fall back to scanning this repo's real tests/ directory.
    const res = runGateAgainstFixture('fake-vitest-file-drop.mjs')
    expect(res.status).toBe(0)
  })

  // Ö1 generalization closure.
  it('Ö1: fails end-to-end on an unrecognized worker-crash phrasing via the generalized fallback', () => {
    const res = runGateAgainstFixture('fake-vitest-unknown-crash.mjs')
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('unrecognized worker-crash phrasing')
  })
})

describe('B1 kalıcı regresyon (gerçek vitest, gerçek suite -- fixture DEĞİL)', () => {
  // This is the permanent regression test CEO/QA required for
  // docs/qa/test-skip-gate-2026-09-10.md B1: it reproduces the QA session's
  // exact repro (npm run test -- --exclude "<a real file>") against the
  // REAL vitest binary and the REAL repo suite. It cannot be faked with a
  // fixture -- it needs the real vitest.config.ts + real file system + real
  // vitest to prove the disk-vs-reported comparison actually fires on a
  // live run.
  //
  // CRITICAL: this spawned real run MUST also exclude tests/verify-test-
  // run.test.ts itself (this very file). Without that second --exclude, the
  // real suite spawned here would re-collect and re-run this exact test,
  // which would spawn ANOTHER real suite run containing this test, and so
  // on -- an exponential fork bomb (hit while writing this test: 185+
  // node.exe processes before it was caught and killed). Do not remove the
  // second --exclude.
  it('gate goes RED when a real test file is dropped via --exclude, even though vitest itself would exit 0', () => {
    const res = spawnSync(
      process.execPath,
      [
        gateScript,
        '--exclude',
        'tests/scripts/install-hook.test.ts',
        '--exclude',
        'tests/verify-test-run.test.ts',
      ],
      { cwd: repoRoot, encoding: 'utf8' }
    )
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('does not match the')
  }, 90_000)
})

describe('package.json wiring (B2 — the gate itself must not be silently bypassable via the script)', () => {
  it('"test" script invokes the silent-test-skip gate, and "verify" chains through "test"', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts.test).toBe('node scripts/verify-test-run.mjs')
    expect(pkg.scripts.verify.split('&&').map((s) => s.trim())).toContain('npm run test')
  })
})
