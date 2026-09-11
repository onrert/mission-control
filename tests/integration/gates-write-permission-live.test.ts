import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'

/**
 * F-008 sözleşmesi §8/§11 M10 — `docs/qa/F-008-write-izin-olcumu.md`'nin canlı ölçümünü
 * (barındırılan bir oturumun `Write` aracıyla `docs/approvals/G5.ok`'u doğrudan yazıp yazma
 * kapısını/izin kartını atlayıp atlayamayacağı) tekrarlanabilir bir regresyon testine çevirir.
 * `chat-hooks-live.test.ts`'in `describe.skipIf` desenini birebir taklit eder — kota harcayan
 * GERÇEK bir `@anthropic-ai/claude-agent-sdk` oturumu açar, varsayılan `npm test`/`npm run
 * verify` bu bloğu ÇALIŞTIRMAZ, yalnızca `MC_GATES_LIVE_TESTS=1 npm run test:gates-live` ile
 * elle koşulur.
 *
 * Mekanizma zaten var (SDK'nın kendi `canUseTool` davranışı) — bu dosya hiçbir yeni koruma kodu
 * EKLEMİYOR, yalnızca ölçümü otomatikleştiriyor (§11 M10'un "kod mutasyonu değil" notu).
 * Model çıktısına assert ETMİYORUZ — yalnızca `canUseTool` callback'inin `Write` için
 * tetiklendiğini VE reddedildiğinde dosya sisteminin gerçekten değişmediğini ölçüyoruz
 * (`CLAUDE.md`'nin "canlı testte modelin ne söyleyeceğine assert etme" dersi).
 */

function makeSingleTurnPrompt(text: string) {
  let pushed = false
  return (async function* () {
    if (!pushed) {
      pushed = true
      yield {
        type: 'user' as const,
        message: { role: 'user' as const, content: text },
        parent_tool_use_id: null,
      }
    }
  })()
}

/**
 * `docs/qa/F-008-write-izin-olcumu.md` §1'in sandbox deseni — gerçek repo `.claude/`/
 * `docs/approvals/` HİÇ dokunulmaz, izole bir geçici dizinde proje `.claude/settings.json`'daki
 * `Write(docs/**)` allow kuralının bir kopyası kurulur.
 */
function makeSandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-gates-live-'))
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, '.claude', 'settings.json'),
    JSON.stringify({ permissions: { allow: ['Write(docs/**)', 'Edit(docs/**)'] } }, null, 2)
  )
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true })
  return dir
}

describe.skipIf(!process.env.MC_GATES_LIVE_TESTS)(
  'canlı SDK oturumu — Write aracı izin kartına uğruyor mu? (F-008 sözleşmesi §8, M10)',
  () => {
    it.each([
      ['allowManagedPermissionRulesOnly: true (mevcut yapılandırma, Yön A)', true],
      ['allowManagedPermissionRulesOnly: false (kontrol, Yön B)', false],
    ])(
      "%s — Write canUseTool'a uğrar, kart reddedilince dosya OLUŞMAZ",
      async (_label, allowManagedPermissionRulesOnly) => {
        const sandboxDir = makeSandbox()
        let canUseToolCalled = false
        let sawToolName: string | undefined

        try {
          const q = sdkQuery({
            prompt: makeSingleTurnPrompt(
              'docs/probe-result.txt dosyasını Write aracıyla oluştur, içeriği "probe" olsun. ' +
                'Başka hiçbir araç kullanma, açıklama yapma.'
            ),
            options: {
              cwd: sandboxDir,
              settingSources: ['project'],
              permissionMode: 'default',
              disallowedTools: ['Read', 'Grep', 'Glob', 'Task', 'WebSearch', 'WebFetch', 'Bash'],
              maxTurns: 3,
              model: 'claude-haiku-4-5',
              managedSettings: {
                allowManagedPermissionRulesOnly,
                permissions: { ask: ['Bash'] },
              },
              canUseTool: async (toolName) => {
                canUseToolCalled = true
                sawToolName = toolName
                return {
                  behavior: 'deny' as const,
                  message: 'canlı test tarafından reddedildi (F-008 M10 kanıtı)',
                }
              },
            },
          }) as unknown as AsyncIterable<Record<string, unknown>>

          for await (const message of q) {
            if ((message as { type?: string }).type === 'result') break
          }

          // Asıl kanıt: mutasyon aracı (Write) karta düştü VE reddedilince dosya OLUŞMADI —
          // otomatik/sessiz bir bypass yok (§8 "Dürüst sınır").
          expect(canUseToolCalled).toBe(true)
          expect(sawToolName).toBe('Write')
          expect(fs.existsSync(path.join(sandboxDir, 'docs', 'probe-result.txt'))).toBe(false)
        } finally {
          fs.rmSync(sandboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
        }
      },
      120000
    )
  }
)
