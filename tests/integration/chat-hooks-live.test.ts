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
 *  gerçekten bir `Bash` `tool_use` çağrısı olup olmadığını ve modelin ÖNERDİĞİ (canUseTool'un
 *  `updatedInput`'undan ETKİLENMEMİŞ ham) komutları da döner. Bu ikinci alan kritik: 4. denemede
 *  (bkz. çağıran taraf) `PreToolUse` hook'unun modelin ÖNERDİĞİ komut üzerinde çalıştığı, `canUseTool`
 *  ÇAĞRILMADAN ÖNCE karar verdiği ampirik olarak gözlemlendi (bkz. SDK'nın kendi `PermissionDenied`
 *  belgesi: "Denials that resolve before canUseTool runs — PreToolUse hook denies... are not
 *  covered [by this event]" — `sdk.d.ts:4853`) — yani `updatedInput` ile komutu ZORLAMAK hook'un
 *  GÖRDÜĞÜ girdiyi DEĞİŞTİRMEZ, yalnızca hook+izin ikisi de geçtikten SONRA gerçekten ÇALIŞACAK
 *  komutu değiştirir. Mekanizmayı (hook'un doğru komutu engelleyip engellemediğini) ölçebilmek
 *  için modelin GERÇEKTEN önerdiği komutun beklenen işaretleyiciyle eşleştiğini doğrulamak
 *  gerekiyor; eşleşmezse mekanizma hakkında hiçbir şey söylenemez (bkz. çağıran taraf). */
async function collectToolResultTexts(
  q: AsyncIterable<Record<string, unknown>>
): Promise<{ toolResultTexts: string[]; sawBashToolUse: boolean; proposedBashCommands: string[] }> {
  const toolResultTexts: string[] = []
  const proposedBashCommands: string[] = []
  let sawBashToolUse = false
  for await (const message of q) {
    const type = message.type
    if (process.env.MC_CHAT_LIVE_DEBUG)
      console.error('[debug]', JSON.stringify(message).slice(0, 500))
    if (type === 'assistant' || type === 'user') {
      const content =
        (message.message as { content?: Array<Record<string, unknown>> } | undefined)?.content ?? []
      for (const block of content) {
        if (block.type === 'tool_use' && block.name === 'Bash') {
          sawBashToolUse = true
          const input = block.input as Record<string, unknown> | undefined
          if (typeof input?.command === 'string') proposedBashCommands.push(input.command)
        }
        if (block.type === 'tool_result') {
          const raw = block.content
          toolResultTexts.push(typeof raw === 'string' ? raw : JSON.stringify(raw))
        }
      }
    }
    if (type === 'result') break
  }
  return { toolResultTexts, sawBashToolUse, proposedBashCommands }
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
        // QA F-012 tur 2 Y3 — 4 deneme, sonuncusu bir MİMARİ BULGU ortaya çıkardı: 3. denemenin
        // "canUseTool modelin önerdiği komutu NE OLURSA OLSUN markerCommand'a ZORLAR" tasarımı
        // YANLIŞ VARSAYIMA dayanıyordu. `PreToolUse` hook'u modelin ÖNERDİĞİ ham `tool_input`
        // üzerinde çalışır ve `canUseTool` ÇAĞRILMADAN ÖNCE karar verir (SDK'nın kendi belgesi,
        // `sdk.d.ts:4853`: "Denials that resolve before canUseTool runs — PreToolUse hook
        // denies... are not covered"). Yani `updatedInput` hook'un GÖRDÜĞÜ girdiyi asla
        // değiştirmez — yalnızca hook+izin ikisi de geçtikten SONRA fiilen ÇALIŞACAK komutu
        // değiştirir. 4. koşuda bu netleşti: `blockedActive` beklenmedik biçimde `false` çıktı
        // çünkü model o turda `npm publish` DIŞINDA bir salt-okunur komut önermişti; hook onu
        // (haklı olarak) hiç engellemedi, ama test "mekanizma çalışmıyor" gibi yanlış yorumluyordu.
        //
        // Düzeltme: `canUseTool`'un komutu zorlaması KALDIRILMADI (fiilen çalışacak komutu hâlâ
        // güvenli `--dry-run`'a sabitliyor, savunma katmanı), ama artık mekanizma yalnızca
        // modelin GERÇEKTEN önerdiği komut beklenen işaretleyiciyle eşleştiğinde değerlendiriliyor
        // (`proposedBashCommands`, hook'un gördüğü ham veri). Eşleşmezse (model talimatı
        // izlemediyse) mekanizma hakkında hiçbir iddiada bulunulmaz, ayrı ve okunabilir bir tanı
        // hatası verilir — tıpkı `sawBashToolUse` deseninde olduğu gibi.
        const markerCommand = 'npm publish --dry-run'
        const promptText =
          `İlk aracın Bash olsun: tam olarak şu komutu çalıştır: ${markerCommand}. ` +
          'Başka hiçbir komut çalıştırma, hiçbir açıklama yapma.'
        const forceMarkerCommand = async (toolName: string, input: Record<string, unknown>) => ({
          behavior: 'allow' as const,
          updatedInput: toolName === 'Bash' ? { ...input, command: markerCommand } : input,
        })
        const proposedMarkerCommand = (cmds: string[]) => cmds.some((c) => /npm\s+publish/.test(c))
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
        if (!proposedMarkerCommand(active.proposedBashCommands)) {
          throw new Error(
            'Model işaretleyici komutu (npm publish) ÖNERMEDİ (aktif kol) — hook bu ham girdi ' +
              `üzerinde çalışır (canUseTool'un komut zorlaması hook'tan SONRA devreye girer), ` +
              `bu yüzden mekanizma hakkında hiçbir şey söylenemez. Önerilen komut(lar): ` +
              `${JSON.stringify(active.proposedBashCommands)}. Testi tekrar çalıştırın.`
          )
        }
        const blockedActive = active.toolResultTexts.some((t) => t.includes('Engellendi'))

        // (b) Hook zinciri DEVRE DIŞI — `settingSources: []` proje hook'larını hiç yüklemez
        // (SDK isolation mode, ✓ DOĞRULANDI sözleşme §8a). Aynı ZORLANMIŞ komut, hook
        // koruması olmadan.
        //
        // QA F-012 tur 2 Y3 (3. deneme) — `allowedTools: ['Bash']` (2. denemede eklenmişti)
        // KALDIRILDI: gerçek SDK bu koşuda `[CLAUDE_SDK_CAN_USE_TOOL_SHADOWED]` uyarısı verdi —
        // "bare allowedTools entries auto-approve the whole tool before the callback is
        // consulted" — yani `canUseTool` (dolayısıyla `forceMarkerCommand`'ın komut zorlaması)
        // BAŞTAN İTİBAREN hiç çağrılmıyordu, sonucun kendisi güvenilmezdi. Bunun yerine
        // `resolveSettings`'in kendi dokümantasyonunun doğruladığı gerçek: `managedSettings`
        // (`Options.managedSettings`), `settingSources`'tan BAĞIMSIZ ayrı bir politika katmanı —
        // "Pass [] to skip user/project/local sources — the managed-settings policy tier is
        // still read" (`sdk.d.ts` `ResolveSettingsOptions.settingSources`). Yani buraya da (a)
        // kolundaki AYNI `permissions.ask:['Bash']`'i eklemek `settingSources:[]`'i BOZMAZ
        // (proje `.claude/hooks/**` hâlâ hiç yüklenmez) ama `canUseTool`'un HER Bash çağrısında
        // (salt-okunur olsa bile) tetiklenmesini garantiler — tam da E1/B5'in ölçtüğü mekanizma,
        // burada test determinizmi için kullanılıyor.
        const inactive = await collectToolResultTexts(
          sdkQuery({
            prompt: makeSingleTurnPrompt(promptText),
            options: {
              cwd: repoRoot,
              settingSources: [],
              permissionMode: 'default',
              // Persona (`agent:'ceo'`) bu kolda yüklenemediği için modeli doğrudan yönlendiren
              // kısa bir sistem talimatı — hook zincirinin kendisiyle İLGİSİZ, yalnızca "hemen
              // bir araç çağır" determinizmini artırır. QA F-012 tur2 Y3 (3. deneme, 2. düzeltme)
              // — iki canlı koşuda da model persona olmadan Bash'i HİÇ çağırmadan düz metinle
              // cevap verdi; talimat daha buyurgan hâle getirildi ve `TodoWrite`/keşif araçları
              // da (`NO_EXPLORATION_TOOLS`) devre dışı bırakıldı ki model bir ara adıma
              // sığınmasın.
              systemPrompt:
                'SADECE Bash aracını çağırarak cevap ver. Metinle cevap vermek veya açıklama ' +
                'yapmak YASAK. İlk ve tek aracın Bash olmalı; kullanıcının istediği komutu ' +
                'doğrudan çalıştır.',
              disallowedTools: [...NO_EXPLORATION_TOOLS, 'TodoWrite'],
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
        if (!inactive.sawBashToolUse) {
          throw new Error(
            'Model hiç Bash çağırmadı (devre dışı kol) — mekanizma hakkında kanıt DEĞİL. ' +
              'Testi tekrar çalıştırın.'
          )
        }
        if (!proposedMarkerCommand(inactive.proposedBashCommands)) {
          throw new Error(
            'Model işaretleyici komutu (npm publish) ÖNERMEDİ (devre dışı kol) — mekanizma ' +
              `hakkında hiçbir şey söylenemez. Önerilen komut(lar): ` +
              `${JSON.stringify(inactive.proposedBashCommands)}. Testi tekrar çalıştırın.`
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
