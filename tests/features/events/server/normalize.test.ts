import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeEvent } from '../../../../src/features/events/server/normalize'

const NOW = new Date('2026-09-04T10:00:00.000Z')

describe('normalizeEvent', () => {
  it('project_path eksikse ve cwd de yoksa missing_fields eklenir, olay düşürülmez', () => {
    const result = normalizeEvent(JSON.stringify({ hook_event_name: 'PreToolUse' }), NOW)
    expect(result.project_path).toBe('')
    expect(result.flags).toContain('missing_fields')
  })

  it('hook_event_name eksikse "unknown" + missing_fields eklenir', () => {
    const result = normalizeEvent(JSON.stringify({ project_path: 'C:\\dev\\apps\\demo' }), NOW)
    expect(result.hook_event_name).toBe('unknown')
    expect(result.flags).toContain('missing_fields')
  })

  it('bilinmeyen hook_event_name değeri korunur, missing_fields eklenmez', () => {
    const result = normalizeEvent(
      JSON.stringify({ project_path: 'C:\\dev\\apps\\demo', hook_event_name: 'FutureEvent' }),
      NOW
    )
    expect(result.hook_event_name).toBe('FutureEvent')
    expect(result.flags).not.toContain('missing_fields')
    expect(result.summary).toBe('')
  })

  it('yalnızca cwd verilmişse project_path ondan türetilir, missing_fields eklenmez', () => {
    const realDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-normalize-'))
    try {
      const result = normalizeEvent(
        JSON.stringify({ cwd: realDir, hook_event_name: 'SessionStart', reason: 'startup' }),
        NOW
      )
      expect(result.project_path).toBe(fs.realpathSync(realDir))
      expect(result.project_name).toBe(path.basename(fs.realpathSync(realDir)))
      expect(result.flags).not.toContain('missing_fields')
    } finally {
      fs.rmSync(realDir, { recursive: true, force: true })
    }
  })

  it('cwd erişilemez bir yolsa ham değer korunur, throw etmez', () => {
    const fakePath = path.join(os.tmpdir(), 'mc-normalize-does-not-exist-xyz')
    expect(() =>
      normalizeEvent(JSON.stringify({ cwd: fakePath, hook_event_name: 'SessionStart' }), NOW)
    ).not.toThrow()
    const result = normalizeEvent(
      JSON.stringify({ cwd: fakePath, hook_event_name: 'SessionStart' }),
      NOW
    )
    expect(result.project_path).toBe(fakePath)
  })

  it('gövde project_path içeriyorsa cwd yok sayılır, olduğu gibi kullanılır', () => {
    const result = normalizeEvent(
      JSON.stringify({
        project_path: 'C:\\dev\\apps\\demo',
        cwd: 'C:\\dev\\apps\\other',
        hook_event_name: 'PreToolUse',
      }),
      NOW
    )
    expect(result.project_path).toBe('C:\\dev\\apps\\demo')
  })

  it('bilinmeyen ek alanlar raw içinde korunur', () => {
    const result = normalizeEvent(
      JSON.stringify({
        project_path: 'C:\\dev\\apps\\demo',
        hook_event_name: 'PreToolUse',
        custom_marker: 'xyz123',
      }),
      NOW
    )
    expect((result.raw as Record<string, unknown>).custom_marker).toBe('xyz123')
  })

  it('MC_MAX_PAYLOAD aşan raw kırpılır ve raw_truncated eklenir', () => {
    const bigString = 'x'.repeat(200)
    const result = normalizeEvent(
      JSON.stringify({
        project_path: 'C:\\dev\\apps\\demo',
        hook_event_name: 'PreToolUse',
        tool_input: { command: bigString },
      }),
      NOW,
      50
    )
    expect(result.flags).toContain('raw_truncated')
    const raw = result.raw as { truncated: boolean; byte_length: number; keys: string[] }
    expect(raw.truncated).toBe(true)
    expect(raw.keys).toContain('tool_input')
  })

  it('gövde JSON değilse parse_error ile kaydedilir, throw etmez', () => {
    const result = normalizeEvent('not json at all', NOW)
    expect(result.flags).toEqual(['parse_error'])
    expect((result.raw as { raw_text: string }).raw_text).toBe('not json at all')
  })

  it('gövde null ise parse_error ile kaydedilir', () => {
    const result = normalizeEvent('null', NOW)
    expect(result.flags).toContain('parse_error')
  })

  it('gövde dizi ise parse_error ile kaydedilir', () => {
    const result = normalizeEvent('[]', NOW)
    expect(result.flags).toContain('parse_error')
  })

  it('boş gövde eksik alan olarak ele alınır, throw etmez', () => {
    expect(() => normalizeEvent('', NOW)).not.toThrow()
    const result = normalizeEvent('', NOW)
    expect(result.flags).toContain('missing_fields')
  })

  describe('summary türetme tablosu', () => {
    it('PreToolUse + Bash -> tool_input.command', () => {
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: 'npm test' },
        }),
        NOW
      )
      expect(result.summary).toBe('npm test')
    })

    it('PostToolUse + Edit -> tool_input.file_path', () => {
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PostToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: 'src/index.ts' },
        }),
        NOW
      )
      expect(result.summary).toBe('src/index.ts')
    })

    it('PreToolUse + Task -> tool_input.description', () => {
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Task',
          tool_input: { description: 'alt görevi yürüt' },
        }),
        NOW
      )
      expect(result.summary).toBe('alt görevi yürüt')
    })

    it('UserPromptSubmit -> user_input', () => {
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'UserPromptSubmit',
          user_input: 'merhaba',
        }),
        NOW
      )
      expect(result.summary).toBe('merhaba')
    })

    it('Notification -> notification_type', () => {
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'Notification',
          notification_type: 'permission_needed',
        }),
        NOW
      )
      expect(result.summary).toBe('permission_needed')
    })

    it('BUG-001: 200 karakteri aşan tool_input.command kırpma işaretiyle 200 karaktere kısaltılır', () => {
      const longCommand = 'echo '.padEnd(800, 'a')
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: longCommand },
        }),
        NOW
      )
      expect(result.summary.length).toBeLessThanOrEqual(200)
      expect(result.summary.endsWith('…')).toBe(true)
    })

    it('BUG-001: 200 karakter veya altındaki tool_input.command aynen korunur, kırpılmaz', () => {
      const shortCommand = 'npm test'
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: shortCommand },
        }),
        NOW
      )
      expect(result.summary).toBe(shortCommand)
    })
  })

  describe('K3 — sır redaksiyonu ve içerik kırpma (docs/qa/G5-guvenlik-denetimi-2026-09-10.md)', () => {
    it('sk- önekli bir anahtar raw ve summary içinde [redakte] ile maskelenir', () => {
      const secret = 'sk-ant-api03-' + 'a'.repeat(40)
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: `curl -H "x-api-key: ${secret}" https://example.com` },
        }),
        NOW
      )
      const raw = result.raw as { tool_input: { command: string } }
      expect(raw.tool_input.command).not.toContain(secret)
      expect(raw.tool_input.command).toContain('[redakte]')
      expect(result.summary).not.toContain(secret)
      expect(result.summary).toContain('[redakte]')
      expect(result.flags).toContain('secrets_redacted')
    })

    it('secret olmayan çevresindeki metin korunur — tüm dizge silinmez', () => {
      const secret = 'sk-' + 'b'.repeat(30)
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: `echo start ${secret} end` },
        }),
        NOW
      )
      const raw = result.raw as { tool_input: { command: string } }
      expect(raw.tool_input.command).toBe('echo start [redakte] end')
    })

    it('Bearer token maskelenir, "Bearer " öneki korunur', () => {
      const token = 'x'.repeat(40)
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: `curl -H "Authorization: Bearer ${token}" https://x` },
        }),
        NOW
      )
      const raw = result.raw as { tool_input: { command: string } }
      expect(raw.tool_input.command).toContain('Bearer [redakte]')
      expect(raw.tool_input.command).not.toContain(token)
      expect(result.flags).toContain('secrets_redacted')
    })

    it('api_key=değer biçimi maskelenir, alan adı korunur', () => {
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: 'export api_key=abcdef1234567890' },
        }),
        NOW
      )
      const raw = result.raw as { tool_input: { command: string } }
      expect(raw.tool_input.command).toBe('export api_key=[redakte]')
      expect(result.flags).toContain('secrets_redacted')
    })

    it('5000 karakterlik zararsız bir alan 4000 karakterde görünür şekilde kırpılır', () => {
      const longContent = 'a'.repeat(5000)
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: 'src/index.ts', new_string: longContent },
        }),
        NOW
      )
      const raw = result.raw as { tool_input: { new_string: string } }
      expect(raw.tool_input.new_string.length).toBe(4000 + '…[içerik kırpıldı]'.length)
      expect(raw.tool_input.new_string.endsWith('…[içerik kırpıldı]')).toBe(true)
      expect(result.flags).toContain('content_truncated')
    })

    it('secret/uzun alan yoksa yeni bayraklar eklenmez', () => {
      const result = normalizeEvent(
        JSON.stringify({
          project_path: 'C:\\dev\\apps\\demo',
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: 'npm test' },
        }),
        NOW
      )
      expect(result.flags).not.toContain('secrets_redacted')
      expect(result.flags).not.toContain('content_truncated')
    })
  })
})
