import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'

/** Real, checked-in hook script — the same file the install script copies (single source). */
export const SEND_EVENT_SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  '.claude',
  'hooks',
  'send-event.cjs'
)

export interface RunHookOptions {
  env?: Record<string, string | undefined>
  scriptPath?: string
  /** Default `true`. Set to `false` to simulate a hook framework that never closes stdin. */
  closeStdin?: boolean
}

export interface RunHookResult {
  stdout: string
  stderr: string
  exitCode: number | null
  /** Real wall-clock time from spawn to process exit (`Date.now()` difference). */
  elapsedMs: number
}

/** Spawns `send-event.cjs` as a child process without writing/closing stdin. */
export function spawnSendEvent(
  env: Record<string, string | undefined> = {},
  scriptPath: string = SEND_EVENT_SCRIPT_PATH
): ChildProcessWithoutNullStreams {
  return spawn('node', [scriptPath], {
    env: { ...process.env, ...env } as NodeJS.ProcessEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

/**
 * Runs `send-event.cjs` as a real child process, feeds it `stdinText`, and resolves once the
 * process exits with captured stdout/stderr, exit code and real elapsed wall-clock time.
 */
export function runHook(stdinText: string, options: RunHookOptions = {}): Promise<RunHookResult> {
  const { env = {}, scriptPath = SEND_EVENT_SCRIPT_PATH, closeStdin = true } = options
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawnSendEvent(env, scriptPath)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code, elapsedMs: Date.now() - startedAt })
    })
    child.stdin.write(stdinText)
    if (closeStdin) child.stdin.end()
  })
}
