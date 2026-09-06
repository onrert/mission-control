import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'

/**
 * D4 (sözleşme §8/§11.3) — bu dosyanın CANLI describe bloğu (`describe.skipIf` ile sarılı)
 * GERÇEK, ÜCRETLİ bir `@anthropic-ai/claude-agent-sdk` oturumu açar. Varsayılan `npm test`/
 * `npm run verify` bu bloğu ÇALIŞTIRMAZ — yalnızca `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live`
 * ile elle koşulur. Kadans (§11.3): (a) hook zinciri veya `managedSettings`/izin yapılandırması
 * değiştiğinde elle bir kez, (b) her QA turunda en az bir kez (`ADR-014`'ün "iki yönlü kanıt"
 * şartı için).
 *
 * QA F-012 tur 3 Y3 düzeltmesi — aşağıdaki `describe('block-dangerous.cjs — hook doğrudan …')`
 * bloğu SARILI DEĞİL: kota harcamaz, modele hiç bağımlı değil, `npm run verify`'nin normal
 * parçasıdır. `.claude/hooks/block-dangerous.cjs`'i gerçek bir alt süreç olarak, PreToolUse'un
 * göndereceği JSON'un AYNISIYLA çalıştırıp çıkış kodunu doğrudan ölçer (QA'nın önerdiği
 * model-bağımsız alternatiflerden biri: "hook betiğini kendi başına çalıştırarak tetiklemek").
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
 *  komutu değiştirir. QA F-012 tur 3 Y3 düzeltmesi — eskiden mekanizmayı ölçmek için modelin
 *  ÖNERDİĞİ komutun BEKLENEN bir işaretleyiciyle (`npm publish`) eşleşmesi ŞART koşuluyordu;
 *  eşleşmezse test "kararsız" sayılıp elle tekrar çalıştırılması isteniyordu (4 art arda koşuda
 *  bu tanı dalına takıldı — CEO personası talimatı izlemek yerine proje bağlamını okuma
 *  alışkanlığını sürdürdü). Artık `proposedBashCommands`'ın İLK öğesi NE OLURSA OLSUN doğrudan
 *  `runHookDirect` (aşağıda) ile GERÇEK hook betiğine verilip "olması gereken karar" (ground
 *  truth) hesaplanıyor; çağıran taraf gözlenen canlı kararı bununla karşılaştırıyor — model HANGİ
 *  komutu önerirse önersin test her zaman deterministik ve anlamlıdır. */
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

const BLOCK_DANGEROUS_HOOK = path.join(repoRoot, '.claude', 'hooks', 'block-dangerous.cjs')

/** QA F-012 tur 3 Y3 düzeltmesi — `.claude/hooks/block-dangerous.cjs`'i GERÇEK bir Node alt
 *  süreci olarak, `PreToolUse`'un göndereceği JSON'un (`{tool_input:{command}}`) AYNISIYLA
 *  stdin'den besler ve `_common.cjs`'in `block()`'unun ürettiği çıkış kodunu (2 = engellendi,
 *  0 = geçti) doğrudan okur. Modelden, SDK'dan, kotadan TAMAMEN bağımsız — hem kendi başına bir
 *  kanıt (aşağıdaki `describe` bloğu) hem de canlı testin (AC4) ground truth kaynağı. */
function runHookDirect(command: string): {
  blocked: boolean
  exitCode: number | null
  stderr: string
} {
  const result = spawnSync(process.execPath, [BLOCK_DANGEROUS_HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
  })
  return { blocked: result.status === 2, exitCode: result.status, stderr: result.stderr ?? '' }
}

// QA F-012 tur 3 Y3 — bu describe BİLEREK `describe.skipIf` ile SARILMADI: kota harcamaz
// (gerçek SDK/model çağrısı yok), `npm run verify`'nin normal parçasıdır. QA'nın önerdiği iki
// model-bağımsız alternatiften biri ("hook betiğini kendi başına çalıştırarak tetiklemek").
describe('block-dangerous.cjs — hook doğrudan tetiklenir (model bağımlılığı yok, kota: 0)', () => {
  it('yayın komutunu (npm publish) ÇIKIŞ KODU 2 ile Engellendi mesajıyla durdurur', () => {
    const result = runHookDirect('npm publish --dry-run')
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain('Engellendi')
  })

  it('salt-okunur bir komutu (ls -la) engellemeden ÇIKIŞ KODU 0 ile geçirir', () => {
    const result = runHookDirect('ls -la')
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
  })
})

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
      'AC4 canlı kanıt: hook zinciri AKTİFKEN modelin önerdiği komutu block-dangerous.cjs ile ' +
        'AYNI kararla değerlendirir; DEVRE DIŞIYKEN (settingSources: []) hiçbir komutu ' +
        'engellemez (Ö10 + QA F-012 tur 3 Y3 düzeltmesi)',
      async () => {
        // QA F-012 tur 3 Y3 — eski tasarım modelin TAM OLARAK "npm publish" içeren bir komut
        // ÖNERMESİNİ ŞART koşuyordu; önermezse test "kararsız, tekrar dene" diye kırılıyordu (4
        // art arda koşuda bu tanı dalına takıldı — CEO personası talimatı izlemek yerine proje
        // bağlamını okuma alışkanlığını sürdürdü, bkz. `docs/qa/F-012-2026-09-06-tur3.md` §4).
        // O tanı dalı TAMAMEN KALKTI. Yeni tasarım modelin NE ÖNERDİĞİNE bakmaksızın çalışır:
        // model hangi Bash komutunu önerirse önersin, o AYNI ham komut `runHookDirect` ile
        // GERÇEK `.claude/hooks/block-dangerous.cjs` betiğine (kota harcamadan, ayrı bir alt
        // süreçte) verilip "olması gereken karar" (ground truth) hesaplanır; canlı oturumun
        // GÖZLENEN kararı bu ground truth ile karşılaştırılır. Ayrıca CEO personası
        // (`agent:'ceo'`) bu testte hiç KULLANILMIYOR — hook zinciri `settingSources:['project']`
        // ile persona'dan BAĞIMSIZ yüklenir, persona yalnızca modelin talimatı izleme
        // olasılığını düşürüyordu (bkz. yukarı).
        const markerCommand = 'npm publish --dry-run'
        const promptText =
          `İlk aracın Bash olsun: tam olarak şu komutu çalıştır: ${markerCommand}. ` +
          'Başka hiçbir komut çalıştırma, hiçbir açıklama yapma.'
        const directiveSystemPrompt =
          'SADECE Bash aracını çağırarak cevap ver. Metinle cevap vermek veya açıklama ' +
          'yapmak YASAK. İlk ve tek aracın Bash olmalı; kullanıcının istediği komutu ' +
          'doğrudan çalıştır.'
        // `canUseTool` hâlâ FİİLEN ÇALIŞACAK komutu güvenli `--dry-run`'a sabitliyor (savunma
        // katmanı, ADR-014 Ek) — ama bu, hook'un GÖRDÜĞÜ ham girdiyi değiştirmez (aşağıdaki
        // ground truth hesaplaması `proposedBashCommands`'ın HAM hâlini kullanır).
        const forceMarkerCommand = async (toolName: string, input: Record<string, unknown>) => ({
          behavior: 'allow' as const,
          updatedInput: toolName === 'Bash' ? { ...input, command: markerCommand } : input,
        })

        async function runBranch(settingSources: 'project'[] | []) {
          return collectToolResultTexts(
            sdkQuery({
              prompt: makeSingleTurnPrompt(promptText),
              options: {
                cwd: repoRoot,
                settingSources,
                systemPrompt: directiveSystemPrompt,
                permissionMode: 'default',
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
        }

        // (a) Hook zinciri AKTİF — Ö10 madde 2: gerçek cwd (repo kökü) üzerinden .claude/
        // settings.json'daki göreli hook yolu çözülüyor.
        const active = await runBranch(['project'])
        if (!active.sawBashToolUse || active.proposedBashCommands.length === 0) {
          throw new Error(
            'Model hiç Bash çağırmadı / komut alanı boş (aktif kol) — bu, hook mekanizması ' +
              'hakkında bir kanıt DEĞİL, yalnızca modelin bu turda aracı seçmediğini gösterir. ' +
              'Testi tekrar çalıştırın.'
          )
        }
        const activeGroundTruth = runHookDirect(active.proposedBashCommands[0]!)
        const blockedActive = active.toolResultTexts.some((t) => t.includes('Engellendi'))

        // (b) Hook zinciri DEVRE DIŞI — `settingSources: []` proje hook'larını hiç yüklemez
        // (SDK isolation mode, ✓ DOĞRULANDI sözleşme §8a); `managedSettings` ondan BAĞIMSIZ ayrı
        // bir politika katmanı olduğu için (`sdk.d.ts` `ResolveSettingsOptions.settingSources`)
        // `permissions.ask:['Bash']` burada da geçerli kalır — `canUseTool`'un HER Bash
        // çağrısında (salt-okunur olsa bile) tetiklenmesini garantiler.
        const inactive = await runBranch([])
        if (!inactive.sawBashToolUse) {
          throw new Error(
            'Model hiç Bash çağırmadı (devre dışı kol) — mekanizma hakkında kanıt DEĞİL. ' +
              'Testi tekrar çalıştırın.'
          )
        }
        const blockedInactive = inactive.toolResultTexts.some((t) => t.includes('Engellendi'))

        // Aktif kolda: canlı oturumun kararı, AYNI ham komutla doğrudan çağrılan hook
        // betiğinin kararıyla (ground truth) BİREBİR eşleşmeli — model HANGİ komutu önerirse
        // önersin (tehlikeli ya da zararsız), bu karşılaştırma her zaman anlamlıdır.
        expect(blockedActive).toBe(activeGroundTruth.blocked)
        // Devre dışı kolda: hook hiç yüklenmediği için karar HER ZAMAN "engellenmedi" olmalı —
        // ground truth'tan bağımsız (bu koldan tanım gereği hiçbir proje hook'u çalışmaz).
        expect(blockedInactive).toBe(false)
      },
      // QA F-012 tur 2 Y3 düzeltmesi — bu test İKİ art arda tam oturum çalıştırıyor; eski
      // 60000ms tek bir oturumun bile gözlemlenen dağılımının (40-70 sn) altındaydı. 240 sn iki
      // oturum + payla gerçekçi bir bütçe.
      240000
    )
  }
)
