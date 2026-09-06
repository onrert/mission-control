import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'

/**
 * D4 (sözleşme §8/§11.3) — bu dosya GERÇEK, ÜCRETLİ bir `@anthropic-ai/claude-agent-sdk`
 * oturumu açar. Varsayılan `npm test`/`npm run verify` bu dosyayı ÇALIŞTIRMAZ
 * (`describe.skipIf` aşağıda) — yalnızca `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` ile
 * elle koşulur. Kadans (§11.3): (a) hook zinciri veya `managedSettings`/izin yapılandırması
 * değiştiğinde elle bir kez, (b) her QA turunda en az bir kez (`ADR-014`'ün "iki yönlü kanıt"
 * şartı için).
 *
 * QA F-012 KALDI B6 — bu dosya sözleşmenin §2.3/§8/§11.3'ün şart koştuğu, `package.json:26`'nın
 * çağırdığı ama önceki turlarda hiç YAZILMAMIŞ olan testtir.
 *
 * Kota kontrolü: CEO personası (`agent:'ceo'`, `settingSources:['project']` ile yüklenir) her
 * isteği önce proje bağlamını okuyarak (progress.md, feature notu vb.) karşılama alışkanlığı
 * gösteriyor (QA B5 gözlemi) — bir bekçi komutuna hiç ulaşmadan `maxTurns`'ü tüketebilir. Bu
 * yüzden her iki test de `Read`/`Grep`/`Glob`/`Task`/`WebSearch`/`WebFetch`'i DEVRE DIŞI
 * bırakıp modeli doğrudan Bash çağırmaya zorluyor — test edilen mekanizma (izin motoru/hook
 * zinciri) persona'dan BAĞIMSIZDIR, bu kısıtlama sonucu etkilemez, yalnızca kota/süreyi kısaltır.
 */
const NO_EXPLORATION_TOOLS = ['Read', 'Grep', 'Glob', 'Task', 'WebSearch', 'WebFetch']

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

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

/** Ham `query()` mesaj akışından `tool_result` içeriklerini toplar — hook'un `block()` mesajı
 *  (`.claude/hooks/block-dangerous.cjs`) modele bir `tool_result` hatası olarak geri döner; bu
 *  yardımcı o metni yakalar (yalnızca canlı testin gözlemi içindir, üretim kodu bu ham içeriği
 *  ASLA panele basmaz — S2/B4, bkz. `chat-api.test.ts`). */
async function collectToolResultTexts(
  q: AsyncIterable<Record<string, unknown>>
): Promise<string[]> {
  const toolResultTexts: string[] = []
  for await (const message of q) {
    const type = message.type
    if (type === 'assistant' || type === 'user') {
      const content =
        (message.message as { content?: Array<Record<string, unknown>> } | undefined)?.content ?? []
      for (const block of content) {
        if (block.type === 'tool_result') {
          const raw = block.content
          toolResultTexts.push(typeof raw === 'string' ? raw : JSON.stringify(raw))
        }
      }
    }
    if (type === 'result') break
  }
  return toolResultTexts
}

describe.skipIf(!process.env.MC_CHAT_LIVE_TESTS)(
  'canlı SDK oturumu — hook zinciri ve izin motoru (D4, AC2/AC4, E1/B5)',
  () => {
    it(
      "E1/B5: salt-okunur sınıfa giren bir Bash komutu bile canUseTool'a düşer " +
        "(managedSettings.permissions.ask:['Bash'] deliği kapatıyor)",
      async () => {
        // Tekrar üretme (QA KALDI B5, docs/qa/F-012-2026-09-06.md §3.2): gerçek oturumda
        // kullanıcı hiç mesaj göndermeden bile `git log --oneline -3` gibi salt-okunur
        // sınıflandırılan Bash komutları `canUseTool`'a hiç sorulmadan otomatik geçiyordu.
        // Bu test `session.ts`'in gerçek `buildOptions()` çıktısıyla BİREBİR aynı
        // `managedSettings`/`settingSources`/`permissionMode`'u kullanır (o çıktının GERÇEKTEN
        // bu değerleri ürettiği ayrıca `session.test.ts`'in offline K3 çevrimdışı çitiyle
        // doğrulanıyor) — burada yalnızca SDK'nın izin motorunun bu yapılandırmaya CANLI olarak
        // uyup uymadığı ölçülüyor (persona'dan bağımsız bir SDK-seviyesi mekanizma, bkz. yukarı).
        let sawPermissionRequest = false
        let sawToolName: string | undefined
        const q = sdkQuery({
          prompt: makeSingleTurnPrompt(
            'İlk aracın Bash olsun: tam olarak şu komutu çalıştır: git log --oneline -3'
          ),
          options: {
            cwd: repoRoot,
            agent: 'ceo',
            settingSources: ['project'],
            permissionMode: 'default',
            disallowedTools: NO_EXPLORATION_TOOLS,
            maxTurns: 3,
            model: 'claude-haiku-4-5',
            managedSettings: {
              allowManagedPermissionRulesOnly: true,
              permissions: { ask: ['Bash'] },
            },
            canUseTool: async (toolName) => {
              sawPermissionRequest = true
              sawToolName = toolName
              // Amaç komutu gerçekten çalıştırmak değil, deliğin kapandığını kanıtlamak.
              return { behavior: 'deny', message: 'canlı test tarafından reddedildi (E1 kanıtı)' }
            },
          },
        }) as unknown as AsyncIterable<Record<string, unknown>>

        for await (const message of q) {
          if (message.type === 'result') break
        }

        expect(sawPermissionRequest).toBe(true)
        expect(sawToolName).toBe('Bash')
      },
      30000
    )

    it(
      'AC4 iki yönlü kanıt: hook zinciri AKTİFKEN tehlikeli komutu engeller, ' +
        'DEVRE DIŞIYKEN (settingSources: []) aynı komut geçer (Ö10)',
      async () => {
        // Ö10 madde 1 — işaretleyici komut `.claude/settings.json`'ın `permissions.deny`
        // listesiyle örtüşmüyor (yalnızca rm -rf/git push --force/git reset --hard var), ama
        // `.claude/hooks/block-dangerous.cjs`'in kendi `release` deseniyle eşleşiyor
        // (`npm\s+publish`) — QA'nın §3.5'te gerçek oturumda kullandığı KOMUTUN AYNISI.
        const markerCommand = 'npm publish --dry-run'
        const promptText = `İlk aracın Bash olsun: tam olarak şu komutu çalıştır: ${markerCommand}`
        const alwaysAllow = async (_toolName: string, input: Record<string, unknown>) => ({
          behavior: 'allow' as const,
          updatedInput: input,
        })

        // (a) Hook zinciri AKTİF — Ö10 madde 2: gerçek cwd (repo kökü) üzerinden .claude/
        // settings.json'daki göreli hook yolu çözülüyor.
        const activeToolResults = await collectToolResultTexts(
          sdkQuery({
            prompt: makeSingleTurnPrompt(promptText),
            options: {
              cwd: repoRoot,
              agent: 'ceo',
              settingSources: ['project'],
              permissionMode: 'default',
              disallowedTools: NO_EXPLORATION_TOOLS,
              maxTurns: 3,
              model: 'claude-haiku-4-5',
              managedSettings: {
                allowManagedPermissionRulesOnly: true,
                permissions: { ask: ['Bash'] },
              },
              canUseTool: alwaysAllow,
            },
          }) as unknown as AsyncIterable<Record<string, unknown>>
        )
        const blockedActive = activeToolResults.some((t) => t.includes('Engellendi'))

        // (b) Hook zinciri DEVRE DIŞI — `settingSources: []` proje hook'larını hiç yüklemez
        // (SDK isolation mode, ✓ DOĞRULANDI sözleşme §8a). Aynı komut, hook koruması olmadan.
        const inactiveToolResults = await collectToolResultTexts(
          sdkQuery({
            prompt: makeSingleTurnPrompt(promptText),
            options: {
              cwd: repoRoot,
              settingSources: [],
              permissionMode: 'default',
              disallowedTools: NO_EXPLORATION_TOOLS,
              maxTurns: 3,
              model: 'claude-haiku-4-5',
              canUseTool: alwaysAllow,
            },
          }) as unknown as AsyncIterable<Record<string, unknown>>
        )
        const blockedInactive = inactiveToolResults.some((t) => t.includes('Engellendi'))

        expect(blockedActive).toBe(true)
        expect(blockedInactive).toBe(false)
      },
      60000
    )
  }
)
