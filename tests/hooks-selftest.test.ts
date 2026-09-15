import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * B4 closure (docs/qa/hook-polarite-karari-2026-09-15.md §3(c) item 6, docs/qa/
 * hook-writepos-contract.md): .claude/hooks/_selftest.cjs is CLAUDE.md's mandated
 * regression gate for block-dangerous.cjs and gate-check.cjs (currently 420+
 * cases), but until this test existed it had NO version-controlled runner --
 * only ad-hoc scratchpad wrappers, which QA flagged as "a security fence whose
 * own regression test is unreachable from any tracked path" (practically
 * equivalent to a silently-dead gate, the repo's most expensive failure class).
 *
 * This test spawns the REAL _selftest.cjs as a subprocess and asserts its exit
 * code. It deliberately does NOT invoke `npm run test` / vitest itself --
 * _selftest.cjs is a standalone Node script with its own sandboxing (it
 * chdir()s into a temp directory and copies the real hook files there before
 * running any case), so there is no re-entrancy risk of the kind recorded in
 * docs/blockers.md (a test that spawns the real suite must exclude its own
 * file or it forks exponentially) -- that lesson applies to spawning vitest
 * itself, not to spawning this unrelated, self-contained script.
 *
 * If a pending, not-yet-consumed approval/guard file exists under
 * docs/approvals/ (PUSH.ok/DANGER.ok/GUARD.ok/.guard-state.json) at the moment
 * this test runs, _selftest.cjs refuses to touch anything and exits 3 (by
 * design, see the script's own header comment) rather than risk destroying a
 * real pending approval. That is a legitimate, safe outcome in this repo's
 * workflow (not a test bug), so it is asserted separately below instead of
 * lumped in with a genuine regression (exit 1).
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const selftestScript = path.join(repoRoot, '.claude', 'hooks', '_selftest.cjs')

describe('.claude/hooks/_selftest.cjs (B4: version-controlled runner for the hook regression gate)', () => {
  it('exits 0 (all cases pass) or 3 (a real pending approval blocked the run) -- never 1 (a real regression)', () => {
    const res = spawnSync(process.execPath, [selftestScript], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 120_000,
    })

    if (res.status === 3) {
      // A real, not-yet-consumed approval/guard file is pending -- _selftest.cjs
      // correctly refused to run rather than risk touching it. This is not a
      // hook regression; skip the stricter assertion below but do not report
      // a false failure either.
      expect(res.stderr).toContain('REDDEDILDI')
      return
    }

    if (res.status !== 0) {
      // Surface the actual FAIL lines in the assertion message so a real
      // regression is diagnosable directly from the test failure output.
      const failLines = (res.stdout || '')
        .split(/\r?\n/)
        .filter((l) => l.startsWith('FAIL'))
        .join('\n')
      throw new Error(
        `.claude/hooks/_selftest.cjs exited ${res.status} (expected 0). FAIL lines:\n${failLines || '(none captured; see full stdout/stderr)'}\n--- stdout tail ---\n${(res.stdout || '').split(/\r?\n/).slice(-15).join('\n')}\n--- stderr ---\n${res.stderr || ''}`
      )
    }

    expect(res.status).toBe(0)
    expect(res.stdout).toContain('TUM TESTLER GECTI')
  }, 120_000)
})
