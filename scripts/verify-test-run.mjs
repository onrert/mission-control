#!/usr/bin/env node
// scripts/verify-test-run.mjs
//
// Wraps `vitest run` with a hard gate against the "silent test skip" failure
// class recorded in docs/blockers.md (2026-09-10): a vitest worker fork can
// crash mid-run (observed on Windows: exit code 3221226505, an access
// violation). In every crash reproduced while writing this gate, vitest
// itself correctly reported the crash as an "Unhandled Error" and exited
// non-zero -- but QA reports from earlier sessions saw the opposite: vitest
// exiting 0 while quietly under-counting the tests it ran (10-16 tests
// missing from a run of ~1300). The exact race that produces that silent
// case was not reproduced while writing this gate (see
// docs/qa/test-skip-gate-contract.md, section 1) -- so this script does not
// rely on vitest's own exit code alone. It re-derives pass/fail from
// vitest's own summary-line arithmetic (the categorized counts it prints
// must sum to the total it prints) and independently scans the output for
// known crash signatures. Any of these signals failing makes this script
// fail, regardless of what vitest itself returned.
//
// Test hook: set MC_TEST_RUN_CMD to a JSON-encoded array (e.g.
// '["node","./tests/fixtures/fake-vitest-ok.mjs"]') to replace `vitest run`
// with another command. Used by tests/verify-test-run.test.ts to drive this
// script against fixture "vitest" scripts without spawning the real test
// suite. JSON (not a plain space-joined string) is required because
// process.execPath itself can contain spaces on Windows (e.g. "C:\Program
// Files\nodejs\node.exe").

import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const CRASH_SIGNATURES = [
  'Worker forks emitted error',
  'Worker exited unexpectedly',
  'Unhandled Error',
]

// Absolute floor: a cheap last-resort sanity check, not a per-added-test
// maintenance burden. Today's suite has 1309 tests across 85 files; this is
// set far below that so it only trips on a catastrophic under-collection
// (e.g. a config change that makes vitest match zero files and call that a
// success). If the suite is intentionally trimmed below this size, raise
// this constant along with a note explaining why.
export const MIN_EXPECTED_TESTS = 500

const SUMMARY_LINE_RE = /^\s*(Test Files|Tests)\s+(.+?)\s+\((\d+)\)\s*$/
const CATEGORY_RE = /(\d+)\s+(passed|failed|skipped|todo)/g

/**
 * Parses one of vitest's own summary lines, e.g.
 *   " Test Files  84 passed | 1 skipped (85)"
 *   "      Tests  1305 passed | 4 skipped (1309)"
 * Returns { label, total, sum } where `sum` is the sum of every categorized
 * count on the line and `total` is the number vitest printed in parens.
 * Returns null if the line does not look like one of these summary lines.
 */
export function parseSummaryLine(line) {
  const match = SUMMARY_LINE_RE.exec(line)
  if (!match) return null
  const [, label, categoriesText, totalText] = match
  const total = Number(totalText)
  let sum = 0
  let categoryMatch
  CATEGORY_RE.lastIndex = 0
  while ((categoryMatch = CATEGORY_RE.exec(categoriesText))) {
    sum += Number(categoryMatch[1])
  }
  return { label, total, sum }
}

/** Returns the first known crash signature found in `text`, or null. */
export function findCrashSignature(text) {
  return CRASH_SIGNATURES.find((signature) => text.includes(signature)) ?? null
}

/**
 * Evaluates a full vitest run given its captured stdout/stderr text.
 * Returns { ok, problems, summaries }. `ok` is false if anything is wrong
 * enough that the run should be treated as red even if vitest's own exit
 * code was 0.
 */
export function evaluateOutput(stdout, stderr = '') {
  const lines = stdout.split(/\r?\n/)
  const summaries = { 'Test Files': null, Tests: null }
  for (const line of lines) {
    const parsed = parseSummaryLine(line)
    if (parsed) summaries[parsed.label] = parsed
  }

  const problems = []

  const crash = findCrashSignature(`${stdout}\n${stderr}`)
  if (crash) problems.push(`crash signature detected in output: "${crash}"`)

  for (const label of ['Test Files', 'Tests']) {
    const summary = summaries[label]
    if (!summary) {
      problems.push(`could not find a "${label}" summary line in vitest output`)
      continue
    }
    if (summary.sum !== summary.total) {
      const missing = summary.total - summary.sum
      problems.push(
        `"${label}" summary says ${summary.sum}/${summary.total} accounted for -- ${missing} silently missing`
      )
    }
  }

  const testsSummary = summaries.Tests
  if (testsSummary && testsSummary.total < MIN_EXPECTED_TESTS) {
    problems.push(
      `only ${testsSummary.total} tests were collected, below the expected floor of ${MIN_EXPECTED_TESTS} ` +
        '(see MIN_EXPECTED_TESTS in scripts/verify-test-run.mjs)'
    )
  }

  return { ok: problems.length === 0, problems, summaries }
}

function resolveCommand() {
  const override = process.env.MC_TEST_RUN_CMD
  if (override) {
    // Test-only path: an already-resolved argv array (e.g. [process.execPath,
    // fixturePath]). No shell needed, and none wanted -- `shell: true` on
    // Windows does not quote array args for you (it just joins them with
    // spaces), which breaks paths like "C:\Program Files\nodejs\node.exe".
    const parts = JSON.parse(override)
    return { command: parts[0], args: parts.slice(1), useShell: false }
  }
  // Real path: resolve `vitest` through PATH/npm's node_modules/.bin shim,
  // which on Windows requires a shell.
  return { command: 'vitest', args: ['run', ...process.argv.slice(2)], useShell: true }
}

async function main() {
  const { command, args, useShell } = resolveCommand()
  const stdoutChunks = []
  const stderrChunks = []

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: useShell })
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
      stdoutChunks.push(chunk)
    })
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
      stderrChunks.push(chunk)
    })
    child.on('error', reject)
    child.on('close', (code, signal) => resolve(code ?? (signal ? 1 : 1)))
  })

  const stdout = Buffer.concat(stdoutChunks).toString('utf8')
  const stderr = Buffer.concat(stderrChunks).toString('utf8')
  const result = evaluateOutput(stdout, stderr)

  if (!result.ok) {
    console.error('\n[verify-test-run] KIRMIZI -- silent test-skip guard tripped:')
    for (const problem of result.problems) console.error(`  - ${problem}`)
  }

  process.exit(exitCode !== 0 ? exitCode : result.ok ? 0 : 1)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((error) => {
    console.error('[verify-test-run] failed to run test command:', error)
    process.exit(1)
  })
}
