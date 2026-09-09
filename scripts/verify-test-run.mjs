#!/usr/bin/env node
// scripts/verify-test-run.mjs
//
// Wraps `vitest run` with a hard gate against the "silent test skip" failure
// class recorded in docs/blockers.md (2026-09-10): a vitest worker fork can
// crash mid-run (observed on Windows: exit code 3221226505, an access
// violation). In every crash reproduced while writing this gate, vitest
// itself correctly reported the crash as an "Unhandled Error" and exited
// non-zero -- but QA reports from earlier sessions saw the opposite: vitest
// exiting 0 while quietly under-counting the tests it ran.
//
// This script does not rely on vitest's own exit code alone. It checks,
// independently:
//   1. Vitest's own summary-line arithmetic (categorized counts must sum to
//      the printed total) -- catches a mismatch *within* one summary line.
//   2. The number of test files vitest reports against the number of test
//      files actually present on disk that match vitest.config.ts's own
//      include/exclude patterns -- catches a whole file silently missing
//      from the run even when (1) reports a clean sum==total (this is the
//      gap a 2026-09-10 QA round found: docs/qa/test-skip-gate-2026-09-10.md
//      B1). This is the PRIMARY defense; it is a comparison against an
//      external, self-updating reference (the file system), not a fixed
//      number.
//   3. Known and generalized worker/fork crash text in the output --
//      SECONDARY, early-warning only. Do not rely on this list alone.
// Any of these signals failing makes this script fail, regardless of what
// vitest itself returned.
//
// Test hooks (see tests/verify-test-run.test.ts):
//   - MC_TEST_RUN_CMD: JSON-encoded argv array to replace `vitest run` with
//     a fixture script under tests/fixtures/fake-vitest-*.mjs.
//   - MC_EXPECTED_TEST_FILE_COUNT: overrides the disk-derived expected file
//     count (used to test the check in (2) without depending on this repo's
//     real file count, which changes over time).

import { spawn } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Signatures actually observed in live crashes while writing/maintaining
// this gate (see docs/blockers.md, docs/qa/test-skip-gate-2026-09-10.md
// section "Ö1"). This list is a SECONDARY, early-warning layer -- the
// primary defense is the disk-vs-reported file count comparison below
// (countDeclaredTestFiles / evaluateOutput's expectedFileCount check), which
// does not depend on recognizing any particular crash text.
const CRASH_SIGNATURES = [
  'Worker forks emitted error',
  'Worker exited unexpectedly',
  'Unhandled Error',
  'Worker terminated',
  'ERR_IPC_CHANNEL_CLOSED',
  'heap out of memory',
]

// Generalized fallback for worker/fork/IPC crash phrasings NOT in the literal
// list above (a new vitest/tinypool version, a differently worded
// memory-limit message, etc.). Requires one of a small set of
// worker/process nouns within 80 characters of a crash-shaped verb, so it
// does not fire on routine mentions of "worker" in healthy output (e.g.
// "86 workers spawned", "worker 1%" in the duration breakdown).
const GENERIC_WORKER_CRASH_RE =
  /\b(?:worker|tinypool|child\s*process)\b[\s\S]{0,80}?\b(?:crash(?:ed)?|terminat(?:ed|ion)|kill(?:ed)?|died|segmentation\s*fault|core\s*dump(?:ed)?|access\s*violation|exit(?:ed)?\s+unexpectedly|out\s+of\s+memory)\b/i

// Absolute floor: a cheap last-resort sanity check, not a per-added-test
// maintenance burden. Today's suite has 1327 tests across 86 files; this is
// set far below that so it only trips on a catastrophic under-collection
// (e.g. a config change that makes vitest match zero files and call that a
// success). The disk-file-count comparison (see below) is the real defense
// against partial loss -- this floor alone was proven insufficient on its
// own (docs/qa/test-skip-gate-2026-09-10.md B1b: 52% of the suite could
// silently vanish and still clear 500). If the suite is intentionally
// trimmed below this size, raise this constant along with a note explaining
// why.
export const MIN_EXPECTED_TESTS = 500

const SUMMARY_LINE_RE = /^\s*(Test Files|Tests)\s+(.+?)\s+\((\d+)\)\s*$/
const CATEGORY_RE = /(\d+)\s+(passed|failed|skipped|todo)/g
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_RE = /\u001b\[[0-9;]*m/g

/** Strips ANSI color escape sequences (e.g. from FORCE_COLOR runs). */
export function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE_RE, '')
}

/**
 * Parses one of vitest's own summary lines, e.g.
 *   " Test Files  84 passed | 1 skipped (85)"
 *   "      Tests  1323 passed | 4 skipped (1327)"
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

/** Returns the first known/generalized crash signature found in `text`, or null. */
export function findCrashSignature(text) {
  const literal = CRASH_SIGNATURES.find((signature) => text.includes(signature))
  if (literal) return literal
  const generic = GENERIC_WORKER_CRASH_RE.exec(text)
  if (generic) return `unrecognized worker-crash phrasing: "${generic[0]}"`
  return null
}

/**
 * Converts a tiny subset of glob syntax to a RegExp: `**` (zero or more path
 * segments), `*` (one path segment), `?(x)` (extglob optional group). This
 * is NOT a general-purpose glob engine -- it targets exactly the patterns
 * used in this repo's vitest.config.ts today (see
 * docs/qa/test-skip-gate-contract.md section 2c for why a full glob library
 * was not added as a dependency).
 */
export function globToRegExp(pattern) {
  let re = ''
  let i = 0
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*'
      i += 2
      if (pattern[i] === '/') i += 1 // "**/" also matches zero directories
      continue
    }
    if (c === '*') {
      re += '[^/]*'
      i += 1
      continue
    }
    if (c === '?' && pattern[i + 1] === '(') {
      const close = pattern.indexOf(')', i)
      if (close === -1) throw new Error(`unterminated extglob group in pattern: ${pattern}`)
      const inner = pattern.slice(i + 2, close)
      re += `(?:${inner})?`
      i = close + 1
      continue
    }
    if ('.+^$(){}|[]\\'.includes(c)) {
      re += `\\${c}`
    } else {
      re += c
    }
    i += 1
  }
  return new RegExp(`^${re}$`)
}

/**
 * Extracts a flat string array literal (e.g. `include: ['a', "b"]`) from raw
 * source text by key name. Deliberately simple (regex, not an AST parser --
 * see docs/qa/test-skip-gate-contract.md section 2c): targets exactly the
 * plain `key: [...]` shape vitest.config.ts uses today. Returns [] if the
 * key is not found.
 */
export function extractArrayLiteral(source, key) {
  const arrayMatch = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`).exec(source)
  if (!arrayMatch) return []
  const values = []
  const stringRe = /'([^']*)'|"([^"]*)"/g
  let stringMatch
  while ((stringMatch = stringRe.exec(arrayMatch[1]))) {
    values.push(stringMatch[1] ?? stringMatch[2])
  }
  return values
}

/**
 * Counts files under `<repoRoot>/tests` whose repo-root-relative path
 * (forward-slash-normalized) matches at least one of `includePatterns` and
 * none of `excludePatterns`. This is the disk-side "expected" count that
 * vitest's own reported "Test Files" total is checked against.
 */
export function countDeclaredTestFiles(repoRoot, includePatterns, excludePatterns) {
  const includeRes = includePatterns.map(globToRegExp)
  const excludeRes = excludePatterns.map(globToRegExp)
  const testsDir = path.join(repoRoot, 'tests')
  let count = 0
  const entries = readdirSync(testsDir, { withFileTypes: true, recursive: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const dir = entry.parentPath ?? entry.path ?? testsDir
    const absolute = path.join(dir, entry.name)
    const relative = path.relative(repoRoot, absolute).split(path.sep).join('/')
    if (!includeRes.some((re) => re.test(relative))) continue
    if (excludeRes.some((re) => re.test(relative))) continue
    count += 1
  }
  return count
}

/**
 * Reads vitest.config.ts's own include/exclude patterns and returns how many
 * files on disk currently match them. Throws if vitest.config.ts cannot be
 * read/parsed (caller treats that as fail-closed).
 */
export function computeExpectedFileCount(repoRoot) {
  const configSource = readFileSync(path.join(repoRoot, 'vitest.config.ts'), 'utf8')
  const includePatterns = extractArrayLiteral(configSource, 'include')
  const excludePatterns = extractArrayLiteral(configSource, 'exclude')
  if (includePatterns.length === 0) {
    throw new Error('could not find a non-empty "include" array in vitest.config.ts')
  }
  return countDeclaredTestFiles(repoRoot, includePatterns, excludePatterns)
}

// Flags that take a following value, so that value token is not mistaken for
// a positional file/pattern filter. Only the flags this repo's scripts and
// QA reproductions actually pass are listed -- see hasExplicitPositionalFilter.
const FLAGS_WITH_VALUE = new Set(['--exclude', '--reporter', '--config', '-c'])

/**
 * Returns true if `args` (vitest CLI args, e.g. process.argv.slice(2))
 * contain a positional file/pattern filter (an argument that is not a flag
 * and not a flag's value) -- i.e. the developer explicitly asked to run a
 * narrower scope on purpose (docs/qa/test-skip-gate-2026-09-10.md Ö3).
 * Flag-only invocations (e.g. `--exclude "tests/x.test.ts"`, no positional
 * target) return false -- that shape looks like "run everything" while
 * silently carving pieces out, which is exactly the B1 attack surface, so it
 * must NOT be treated as an intentional narrow run.
 */
export function hasExplicitPositionalFilter(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg.startsWith('-')) {
      if (FLAGS_WITH_VALUE.has(arg)) i += 1
      continue
    }
    return true
  }
  return false
}

/**
 * Evaluates a full vitest run given its captured stdout/stderr text.
 * `options.expectedFileCount`, if a number, is compared against the
 * reported "Test Files" total (see countDeclaredTestFiles). `options.
 * expectedFileCountError`, if set, is reported as its own fail-closed
 * problem (we could not determine the expected count at all).
 * `options.skipScopeChecks` disables both the file-count comparison and the
 * MIN_EXPECTED_TESTS floor (intentional narrow run, see
 * hasExplicitPositionalFilter).
 * Returns { ok, problems, summaries }. `ok` is false if anything is wrong
 * enough that the run should be treated as red even if vitest's own exit
 * code was 0.
 */
export function evaluateOutput(stdout, stderr = '', options = {}) {
  const { expectedFileCount = null, expectedFileCountError = null, skipScopeChecks = false } =
    options
  const cleanStdout = stripAnsi(stdout)
  const cleanStderr = stripAnsi(stderr)
  const lines = cleanStdout.split(/\r?\n/)
  const summaries = { 'Test Files': null, Tests: null }
  for (const line of lines) {
    const parsed = parseSummaryLine(line)
    if (parsed) summaries[parsed.label] = parsed
  }

  const problems = []

  const crash = findCrashSignature(`${cleanStdout}\n${cleanStderr}`)
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

  const testFilesSummary = summaries['Test Files']
  if (!skipScopeChecks) {
    if (expectedFileCountError) {
      problems.push(
        `could not determine the expected test-file count from vitest.config.ts: ${expectedFileCountError.message}`
      )
    } else if (typeof expectedFileCount === 'number' && testFilesSummary) {
      if (testFilesSummary.total !== expectedFileCount) {
        problems.push(
          `"Test Files" total reported by vitest (${testFilesSummary.total}) does not match the ` +
            `number of test files on disk matching vitest.config.ts's include/exclude patterns ` +
            `(${expectedFileCount}) -- a file may have been silently dropped from the run (e.g. an ` +
            `undeclared --exclude flag)`
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
  }

  return { ok: problems.length === 0, problems, summaries }
}

function resolveCommand(cliArgs) {
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
  return { command: 'vitest', args: ['run', ...cliArgs], useShell: true }
}

/** Test-only hook: resolves the expected file count without touching the
 * real file system, so fixture-driven tests can exercise the comparison
 * logic without depending on this repo's real, ever-changing file count. */
function resolveExpectedFileCount(explicitFilterGiven) {
  if (explicitFilterGiven) return { expectedFileCount: null, expectedFileCountError: null }
  if (process.env.MC_EXPECTED_TEST_FILE_COUNT !== undefined) {
    return { expectedFileCount: Number(process.env.MC_EXPECTED_TEST_FILE_COUNT), expectedFileCountError: null }
  }
  if (process.env.MC_TEST_RUN_CMD) {
    // Fixture harness without an explicit override: this signal is opted
    // out for the pre-existing arithmetic/crash-signature fixture tests,
    // and exercised separately (with the override above) by dedicated
    // disk-file-count fixture tests.
    return { expectedFileCount: null, expectedFileCountError: null }
  }
  try {
    return { expectedFileCount: computeExpectedFileCount(REPO_ROOT), expectedFileCountError: null }
  } catch (error) {
    return { expectedFileCount: null, expectedFileCountError: error }
  }
}

async function main() {
  const cliArgs = process.argv.slice(2)
  const explicitFilterGiven = hasExplicitPositionalFilter(cliArgs)
  const { command, args, useShell } = resolveCommand(cliArgs)
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
  const { expectedFileCount, expectedFileCountError } = resolveExpectedFileCount(explicitFilterGiven)
  const result = evaluateOutput(stdout, stderr, {
    expectedFileCount,
    expectedFileCountError,
    skipScopeChecks: explicitFilterGiven,
  })

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
