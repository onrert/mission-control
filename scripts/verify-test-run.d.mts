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

export interface EvaluationOptions {
  expectedFileCount?: number | null
  expectedFileCountError?: Error | null
  skipScopeChecks?: boolean
}

export interface EvaluationResult {
  ok: boolean
  problems: string[]
  summaries: Record<string, SummaryLine | null>
}

export function stripAnsi(text: string): string
export function parseSummaryLine(line: string): SummaryLine | null
export function findCrashSignature(text: string): string | null
export function globToRegExp(pattern: string): RegExp
export function extractArrayLiteral(source: string, key: string): string[]
export function countDeclaredTestFiles(
  repoRoot: string,
  includePatterns: string[],
  excludePatterns: string[]
): number
export function computeExpectedFileCount(repoRoot: string): number
export function hasExplicitPositionalFilter(args: string[]): boolean
export function evaluateOutput(
  stdout: string,
  stderr?: string,
  options?: EvaluationOptions
): EvaluationResult
