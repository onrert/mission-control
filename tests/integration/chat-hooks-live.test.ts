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
 *  ASLA panele basmaz — S2/B4, bkz. `chat-api.test.ts`). QA F-012 tur 2 Y3 düzeltmesi — ayrıca
 *  gerçekten bir `Bash` `tool_use` çağrısı olup olmadığını da döner: eski test yalnızca
 *  `tool_result` metnini ölçüyordu, model hiç Bash ÇAĞIRMADIYSA (ör. doğrudan metinle cevap
 *  verdiyse) `blockedActive`/`blockedInactive` ikisi de sessizce `false` kalıp testi YANLIŞ
 *  nedenle (mekanizma değil, model kararı) kırmızıya düşürüyordu; artık bu durum ayrı, okunabilir
 *  bir hata olarak raporlanır (bkz. çağıran taraf). */
async function collectToolResultTexts(
  q: AsyncIterable<Record<string, unknown>>
): Promise<{ toolResultTexts: string[]; sawBashToolUse: boolean }> {
  const toolResultTexts: string[] = []
  let sawBashToolUse = false
  for await (const message of q) {
    const type = message.type
    if (process.env.MC_CHAT_LIVE_DEBUG)
      console.error('[debug]', JSON.stringify(message).slice(0, 500))
    if (type === 'assistant' || type === 'user') {
      const content =
        (message.message as { content?: Array<Record<string, unknown>> } | undefined)?.content ?? []
      for (const block of content) {
        if (block.type === 'tool_use' && block.name === 'Bash') sawBashToolUse = true
        if (block.type === 'tool_result') {
          const raw = block.content
          toolResultTexts.push(typeof raw === 'string' ? raw : JSON.stringify(raw))
        }
      }
    }
    if (type === 'result') break
  }
  return { toolResultTexts, sawBashToolUse }
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
      // QA F-012 tur 2 Y3 düzeltmesi — 30000ms gerçek CEO personasında (proje bağlamını önce
      // okuma alışkanlığı, QA gözlemi) yetersizdi: bağımsız QA probu aynı yapılandırmayla
      // 40-70 sn arası koştu (`docs/qa/F-012-2026-09-06-tur2.md` §4 Y3). 120 sn bu dağılımın
      // üzerinde gerçekçi bir bütçe.
      120000
    )

    it(
      'AC4 iki yönlü kanıt: hook zinciri AKTİFKEN tehlikeli komutu engeller, ' +
        'DEVRE DIŞIYKEN (settingSources: []) aynı komut geçer (Ö10)',
      async () => {
        // Ö10 madde 1 — işaretleyici komut `.claude/settings.json`'ın `permissions.deny`
        // listesiyle örtüşmüyor (yalnızca rm -rf/git push --force/git reset --hard var), ama
        // `.claude/hooks/block-dangerous.cjs`'in kendi `release` deseniyle eşleşiyor
        // (`npm\s+publish`) — QA'nın §3.5'te gerçek oturumda kullandığı KOMUTUN AYNISI.
        //
        // QA F-012 tur 2 Y3 düzeltmesi — eski hâli MODEL DAVRANIŞINA bağımlıydı: modelin
        // doğal dille verilen talimatı harfiyen izleyip TAM OLARAK `markerCommand`'ı çalıştırması
        // gerekiyordu; yapmazsa (ör. başka bir komut denerse/hiç Bash çağırmazsa) test yanlış
        // nedenle kırmızı oluyordu (`docs/qa/F-012-2026-09-06-tur2.md` §4 Y3 kök neden 2). Artık
        // `canUseTool`, modelin önerdiği komut NE OLURSA OLSUN `updatedInput.command`'ı
        // `markerCommand`'a ZORLA çeviriyor — mekanizma (hook zincirinin bu komutu engelleyip
        // engellemediği) artık modelin doğal dil talimatını ne kadar sadık izlediğinden
        // BAĞIMSIZ; tek model bağımlılığı modelin (hâlâ) EN AZ BİR Bash çağrısı yapması, ki
        // bu `sawBashToolUse` ile ayrıca doğrulanıp ayrı, okunabilir bir hata verir.
        const markerCommand = 'npm publish --dry-run'
        const promptText = 'İlk aracın Bash olsun, herhangi bir salt-okunur komut çalıştır.'
        const forceMarkerCommand = async (toolName: string, input: Record<string, unknown>) => ({
          behavior: 'allow' as const,
          updatedInput: toolName === 'Bash' ? { ...input, command: markerCommand } : input,
        })
        // QA F-012 tur 2 Y3 (2. deneme) — (b) kolu `settingSources: []` olduğu için `agent:'ceo'`
        // YÜKLENEMEZ (persona proje ayarlarından okunur); persona olmadan model bazen Bash'i hiç
        // çağırmadan düz metinle cevap veriyordu (ilk koşuda gözlemlendi, `sawBashToolUse:false`).
        // `allowedTools: ['Bash']` araç yüzeyini TEK seçeneğe indirir (Karpathy §2'nin izin
        // verdiği ölçüde agresif — bu yalnızca test determinizmi için, üretim koduna dokunmuyor).
        const forceBashOnly = ['Bash']

        // (a) Hook zinciri AKTİF — Ö10 madde 2: gerçek cwd (repo kökü) üzerinden .claude/
        // settings.json'daki göreli hook yolu çözülüyor.
        const active = await collectToolResultTexts(
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
              canUseTool: forceMarkerCommand,
            },
          }) as unknown as AsyncIterable<Record<string, unknown>>
        )
        if (!active.sawBashToolUse) {
          throw new Error(
            'Model hiç Bash çağırmadı (aktif kol) — bu, hook mekanizmasının kendisi hakkında ' +
              'bir kanıt DEĞİL, yalnızca modelin bu turda aracı seçmediğini gösterir. Testi ' +
              'tekrar çalıştırın; tekrarlıyorsa promptu güçlendirin.'
          )
        }
        const blockedActive = active.toolResultTexts.some((t) => t.includes('Engellendi'))

        // (b) Hook zinciri DEVRE DIŞI — `settingSources: []` proje hook'larını hiç yüklemez
        // (SDK isolation mode, ✓ DOĞRULANDI sözleşme §8a). Aynı ZORLANMIŞ komut, hook
        // koruması olmadan.
        const inactive = await collectToolResultTexts(
          sdkQuery({
            prompt: makeSingleTurnPrompt(promptText),
            options: {
              cwd: repoRoot,
              settingSources: [],
              permissionMode: 'default',
              allowedTools: forceBashOnly,
              // Persona (`agent:'ceo'`) bu kolda yüklenemediği için modeli doğrudan yönlendiren
              // kısa bir sistem talimatı — hook zincirinin kendisiyle İLGİSİZ, yalnızca "hemen
              // bir araç çağır" determinizmini artırır.
              systemPrompt:
                'Kullanıcının istediği kabuk komutunu ÇAĞIRMADAN ÖNCE hiçbir metinle cevap verme; ' +
                'ilk aracın her zaman Bash olsun.',
              maxTurns: 3,
              model: 'claude-haiku-4-5',
              canUseTool: forceMarkerCommand,
            },
          }) as unknown as AsyncIterable<Record<string, unknown>>
        )
        if (!inactive.sawBashToolUse) {
          throw new Error(
            'Model hiç Bash çağırmadı (devre dışı kol) — mekanizma hakkında kanıt DEĞİL. ' +
              'Testi tekrar çalıştırın.'
          )
        }
        const blockedInactive = inactive.toolResultTexts.some((t) => t.includes('Engellendi'))

        expect(blockedActive).toBe(true)
        expect(blockedInactive).toBe(false)
      },
      // QA F-012 tur 2 Y3 düzeltmesi — bu test İKİ art arda tam oturum çalıştırıyor; eski
      // 60000ms tek bir oturumun bile gözlemlenen dağılımının (40-70 sn) altındaydı. 240 sn iki
      // oturum + payla gerçekçi bir bütçe.
      240000
    )
  }
)
