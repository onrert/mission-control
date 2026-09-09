// Type declarations for verify-test-run.mjs. Kept as a plain .mjs script
// (matching this repo's existing scripts/*.mjs convention, see
// scripts/check-ports.mjs) so it can be run directly by `node` without a
// build step; this file exists only so tests/verify-test-run.test.ts can
// import its pure functions under `strict` typecheck.

export const MIN_EXPECTED_TESTS: number

export interface SummaryLine {
  label: string
  total: number
  sum: number
}

export interface EvaluationResult {
  ok: boolean
  problems: string[]
  summaries: Record<string, SummaryLine | null>
}

export function parseSummaryLine(line: string): SummaryLine | null
export function findCrashSignature(text: string): string | null
export function evaluateOutput(stdout: string, stderr?: string): EvaluationResult
