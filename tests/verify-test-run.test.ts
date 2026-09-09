import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  evaluateOutput,
  findCrashSignature,
  MIN_EXPECTED_TESTS,
  parseSummaryLine,
} from '../scripts/verify-test-run.mjs'

/**
 * Guards against the "silent test skip" failure class recorded in
 * docs/blockers.md (2026-09-10): a vitest worker fork can crash mid-run
 * while vitest's own process still exits 0, quietly under-counting the
 * tests it ran. scripts/verify-test-run.mjs wraps `vitest run` and refuses
 * to call a run green unless vitest's own summary-line arithmetic accounts
 * for every test, and no known crash signature appears in the output.
 *
 * The unit tests below exercise the pure parsing/decision functions
 * directly. The "end-to-end" tests further down actually spawn
 * scripts/verify-test-run.mjs as a real subprocess (MC_TEST_RUN_CMD swaps
 * out the real `vitest run` for a fixture script under tests/fixtures/) so
 * the mechanism itself is triggered, not a mock of it.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gateScript = path.join(repoRoot, 'scripts', 'verify-test-run.mjs')

function runGateAgainstFixture(fixtureFileName: string) {
  const fixturePath = path.join(repoRoot, 'tests', 'fixtures', fixtureFileName)
  return spawnSync(process.execPath, [gateScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MC_TEST_RUN_CMD: JSON.stringify([process.execPath, fixturePath]),
    },
  })
}

describe('parseSummaryLine', () => {
  it('parses a healthy "Tests" summary line (real vitest output, copied verbatim)', () => {
    expect(parseSummaryLine('      Tests  1305 passed | 4 skipped (1309)')).toEqual({
      label: 'Tests',
      total: 1309,
      sum: 1309,
    })
  })

  it('parses a healthy "Test Files" summary line', () => {
    expect(parseSummaryLine(' Test Files  84 passed | 1 skipped (85)')).toEqual({
      label: 'Test Files',
      total: 85,
      sum: 85,
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

describe('findCrashSignature', () => {
  it('finds the real error text observed in live worker-fork crashes', () => {
    expect(findCrashSignature('Error: [vitest-pool]: Worker forks emitted error.')).toBe(
      'Worker forks emitted error'
    )
    expect(
      findCrashSignature('Caused by: Error: Worker exited unexpectedly with exit code 3221226505')
    ).toBe('Worker exited unexpectedly')
  })

  it('returns null when nothing suspicious is present', () => {
    expect(findCrashSignature('all good, nothing to see here')).toBeNull()
  })
})

describe('evaluateOutput', () => {
  it('passes on a clean, fully-accounted run', () => {
    const result = evaluateOutput(
      ' Test Files  84 passed | 1 skipped (85)\n      Tests  1305 passed | 4 skipped (1309)\n'
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
})
