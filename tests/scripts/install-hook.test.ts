import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const REPO_ROOT = path.join(__dirname, '..', '..')
const scriptPath = path.join(REPO_ROOT, 'scripts', 'install-hook.mjs')
const REAL_SOURCE_SCRIPT = path.join(REPO_ROOT, '.claude', 'hooks', 'send-event.cjs')
const REAL_SETTINGS_PATH = path.join(REPO_ROOT, '.claude', 'settings.json')

const HOOK_EVENT_NAMES = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'StopFailure',
  'Notification',
  'PreCompact',
  'PostCompact',
]

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

function runInstall(targetDir: string, extraArgs: string[] = []): RunResult {
  try {
    const stdout = execFileSync('node', [scriptPath, targetDir, ...extraArgs], { stdio: 'pipe' })
    return { status: 0, stdout: stdout.toString('utf8'), stderr: '' }
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer }
    return {
      status: e.status ?? 1,
      stdout: e.stdout?.toString('utf8') ?? '',
      stderr: e.stderr?.toString('utf8') ?? '',
    }
  }
}

function readSettings(targetDir: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(targetDir, '.claude', 'settings.json'), 'utf8')
  return JSON.parse(raw) as Record<string, unknown>
}

function countGroupsWithCommand(groups: unknown, command: string): number {
  if (!Array.isArray(groups)) return 0
  return groups.filter(
    (g) =>
      g &&
      Array.isArray((g as { hooks?: unknown }).hooks) &&
      (g as { hooks: Array<{ command?: string }> }).hooks.some((h) => h.command === command)
  ).length
}

describe('install-hook.mjs', () => {
  let targetDir: string

  beforeEach(() => {
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-install-hook-'))
  })

  afterEach(() => {
    fs.rmSync(targetDir, { recursive: true, force: true })
  })

  it('argüman yoksa hiçbir dosyaya dokunmadan hata verir', () => {
    const result = runInstall('')
    expect(result.status).not.toBe(0)
    expect(fs.existsSync(path.join(targetDir, '.claude'))).toBe(false)
  })

  it('geçersiz/olmayan yol verilirse hiçbir dosyaya dokunmadan hata verir', () => {
    const bogus = path.join(targetDir, 'yok-boyle-bir-yer')
    const result = runInstall(bogus)
    expect(result.status).not.toBe(0)
    expect(fs.existsSync(bogus)).toBe(false)
  })

  it('temiz hedefte kurulum: send-event.cjs kopyalanır, 13 olay tipi eklenir', () => {
    const result = runInstall(targetDir)
    expect(result.status).toBe(0)

    const copied = path.join(targetDir, '.claude', 'hooks', 'send-event.cjs')
    expect(fs.existsSync(copied)).toBe(true)
    expect(fs.readFileSync(copied, 'utf8')).toBe(fs.readFileSync(REAL_SOURCE_SCRIPT, 'utf8'))

    const settings = readSettings(targetDir) as { hooks: Record<string, unknown> }
    for (const name of HOOK_EVENT_NAMES) {
      expect(
        countGroupsWithCommand(settings.hooks[name], 'node .claude/hooks/send-event.cjs')
      ).toBe(1)
    }

    // Hiç önceki settings.json yoktu -> yedek alınmadı.
    expect(fs.existsSync(path.join(targetDir, '.claude', 'settings.json.bak'))).toBe(false)
  })

  it('settings.json hiç yokken sıfırdan oluşturur', () => {
    expect(fs.existsSync(path.join(targetDir, '.claude'))).toBe(false)
    const result = runInstall(targetDir)
    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(targetDir, '.claude', 'settings.json'))).toBe(true)
  })

  it('iki kez çalıştırma → tek kayıt (pozitif kontrol: exitCode===0 ve özet metni)', () => {
    const first = runInstall(targetDir)
    expect(first.status).toBe(0)

    const second = runInstall(targetDir)
    expect(second.status).toBe(0)
    expect(second.stdout).toContain('0 eklendi')
    expect(second.stdout).toContain(`${HOOK_EVENT_NAMES.length} zaten var`)

    const settings = readSettings(targetDir) as { hooks: Record<string, unknown> }
    for (const name of HOOK_EVENT_NAMES) {
      expect(
        countGroupsWithCommand(settings.hooks[name], 'node .claude/hooks/send-event.cjs')
      ).toBe(1)
    }
  })

  it("mevcut yabancı hook'lar korunur (bu reponun settings.json kopyası)", () => {
    const claudeDir = path.join(targetDir, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    const originalRaw = fs.readFileSync(REAL_SETTINGS_PATH, 'utf8')
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), originalRaw, 'utf8')
    const original = JSON.parse(originalRaw) as { hooks: Record<string, unknown> }

    const result = runInstall(targetDir)
    expect(result.status).toBe(0)

    const merged = readSettings(targetDir) as { hooks: Record<string, unknown> }
    for (const [eventName, groups] of Object.entries(original.hooks)) {
      if (!Array.isArray(groups)) continue
      for (const group of groups) {
        const mergedGroups = merged.hooks[eventName]
        expect(Array.isArray(mergedGroups)).toBe(true)
        expect(mergedGroups as unknown[]).toContainEqual(group)
      }
    }
    // Yeni 13 kayıt da eklendi.
    for (const name of HOOK_EVENT_NAMES) {
      expect(countGroupsWithCommand(merged.hooks[name], 'node .claude/hooks/send-event.cjs')).toBe(
        1
      )
    }
  })

  it('bozuk JSON → hiçbir şey yazmadan hata, .claude/hooks/send-event.cjs OLUŞMAMIŞ', () => {
    const claudeDir = path.join(targetDir, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    const brokenContent = '{ bu gecerli json degil'
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), brokenContent, 'utf8')

    const result = runInstall(targetDir)
    expect(result.status).not.toBe(0)

    expect(fs.existsSync(path.join(claudeDir, 'hooks', 'send-event.cjs'))).toBe(false)
    expect(fs.existsSync(path.join(claudeDir, 'settings.json.bak'))).toBe(false)
    expect(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8')).toBe(brokenContent)
  })

  it('.bak ilk koşuda kurulum-öncesi içerikle oluşur, ikinci koşuda değişmez', () => {
    const claudeDir = path.join(targetDir, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    const originalContent = JSON.stringify(
      {
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/custom.cjs' }] }],
        },
      },
      null,
      2
    )
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), originalContent, 'utf8')

    const first = runInstall(targetDir)
    expect(first.status).toBe(0)
    const backupPath = path.join(claudeDir, 'settings.json.bak')
    expect(fs.existsSync(backupPath)).toBe(true)
    expect(fs.readFileSync(backupPath, 'utf8')).toBe(originalContent)

    const second = runInstall(targetDir)
    expect(second.status).toBe(0)
    expect(fs.readFileSync(backupPath, 'utf8')).toBe(originalContent)
  })

  it('--dry-run hiçbir dosyaya yazmaz', () => {
    const result = runInstall(targetDir, ['--dry-run'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('--dry-run')
    expect(fs.existsSync(path.join(targetDir, '.claude'))).toBe(false)
  })

  it('type:module hedefte kopyalanan send-event.cjs gerçekten çalışır (uzantı tuzağı kanıtı)', () => {
    fs.mkdirSync(targetDir, { recursive: true })
    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify({ type: 'module' }),
      'utf8'
    )
    const result = runInstall(targetDir)
    expect(result.status).toBe(0)

    const copied = path.join(targetDir, '.claude', 'hooks', 'send-event.cjs')
    const run = execFileSync('node', [copied], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse' }),
      env: { ...process.env, MC_PORT: '0' },
      stdio: 'pipe',
    })
    expect(run.toString('utf8')).toBe('')
  })

  it('type alanı olmayan (varsayılan CJS) hedefte kopyalanan send-event.cjs çalışır', () => {
    fs.mkdirSync(targetDir, { recursive: true })
    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({}), 'utf8')
    const result = runInstall(targetDir)
    expect(result.status).toBe(0)

    const copied = path.join(targetDir, '.claude', 'hooks', 'send-event.cjs')
    const run = execFileSync('node', [copied], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse' }),
      env: { ...process.env, MC_PORT: '0' },
      stdio: 'pipe',
    })
    expect(run.toString('utf8')).toBe('')
  })
})
