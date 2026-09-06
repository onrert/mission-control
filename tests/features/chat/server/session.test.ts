import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveSettings } from '@anthropic-ai/claude-agent-sdk'
import {
  createChatSession,
  isChatEnabled,
  resolveChatBudget,
  resolveChatSessionCwd,
  CHAT_SESSION_CWD,
} from '../../../../src/features/chat/server/session'
import { createFakeQueryFactory } from '../../../helpers/fake-chat-query'

function flush(times = 3): Promise<void> {
  return (async () => {
    for (let i = 0; i < times; i++) await Promise.resolve()
  })()
}

interface Broadcast {
  name: string
  data: unknown
}

function createStubHub() {
  const broadcasts: Broadcast[] = []
  return {
    hub: {
      subscribe: () => () => {},
      broadcast: (name: string, data: unknown) => {
        broadcasts.push({ name, data })
      },
      closeAll: () => {},
      subscriberCount: () => 0,
    },
    broadcasts,
  }
}

let dataDir: string

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-chat-session-'))
})

afterEach(async () => {
  // history-log.ts'in yazma kuyruğu fire-and-forget'tir (bkz. history-log.test.ts flush()) —
  // dataDir'i hemen silmek kuyrukta bekleyen bir `appendFile`'ı ENOENT'e düşürüp gürültülü ama
  // zararsız bir stderr satırı üretir; kısa bir bekleme bunu önler.
  await new Promise((resolve) => setTimeout(resolve, 20))
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('isChatEnabled / resolveChatBudget (saf fonksiyonlar)', () => {
  it('MC_CHAT_ENABLED tanımsızsa varsayılan açık', () => {
    expect(isChatEnabled({})).toBe(true)
  })
  it("MC_CHAT_ENABLED='0' kapalı", () => {
    expect(isChatEnabled({ MC_CHAT_ENABLED: '0' })).toBe(false)
  })
  it('MC_CHAT_ENABLED tanınmayan değer güvenli tarafa (kapalı) düşer', () => {
    expect(isChatEnabled({ MC_CHAT_ENABLED: 'false' })).toBe(false)
  })
  it('resolveChatBudget tanımsızsa $20', () => {
    expect(resolveChatBudget({})).toBe(20)
  })
  it('resolveChatBudget geçersiz/<=0 değerde $20', () => {
    expect(resolveChatBudget({ MC_CHAT_MAX_BUDGET_USD: '0' })).toBe(20)
    expect(resolveChatBudget({ MC_CHAT_MAX_BUDGET_USD: 'abc' })).toBe(20)
  })
  it('resolveChatBudget geçerli pozitif sayıda kendi değerini kullanır', () => {
    expect(resolveChatBudget({ MC_CHAT_MAX_BUDGET_USD: '5.5' })).toBe(5.5)
  })
})

describe('CHAT_SESSION_CWD (mutasyon 3 — çevrimdışı çit)', () => {
  it("cwd'den .claude/settings.json gerçekten çözülüyor", () => {
    expect(fs.existsSync(path.join(CHAT_SESSION_CWD, '.claude', 'settings.json'))).toBe(true)
  })
})

describe('resolveChatSessionCwd (QA F-014 H1 düzeltmesi — Electron paketlenmiş kopya asla çalışma dizini olmaz)', () => {
  it('MC_CHAT_SESSION_CWD tanımsızsa eski __dirname türetimiyle (CHAT_SESSION_CWD) BİREBİR aynı sonucu verir', () => {
    expect(resolveChatSessionCwd({})).toBe(CHAT_SESSION_CWD)
  })

  it('MC_CHAT_SESSION_CWD verilmişse (electron/main.cjs bunu gerçek proje dizinine sabitler) onu kullanır, __dirname türetimini GÖRMEZDEN gelir', () => {
    const fakeProjectDir = path.join(os.tmpdir(), 'mc-fake-real-repo')
    expect(resolveChatSessionCwd({ MC_CHAT_SESSION_CWD: fakeProjectDir })).toBe(
      path.resolve(fakeProjectDir)
    )
  })
})

async function bootstrapSession(env: NodeJS.ProcessEnv = {}) {
  const { queryFn, getHandles } = createFakeQueryFactory()
  const { hub, broadcasts } = createStubHub()
  const session = createChatSession({
    query: queryFn,
    dataDir,
    hub,
    now: () => new Date('2026-09-06T00:00:00Z'),
    env,
  })
  await session.bootstrap()
  await flush()
  return { session, getHandles, broadcasts }
}

describe('createChatSession — bootstrap seçenekleri (mutasyon 3/4)', () => {
  it('query() beklenen seçeneklerle çağrılır', async () => {
    const { getHandles } = await bootstrapSession()
    const handles = getHandles()
    expect(handles).toHaveLength(1)
    const opts = handles[0]!.options
    expect(opts.cwd).toBe(CHAT_SESSION_CWD)
    expect(opts.agent).toBe('ceo')
    expect(opts.settingSources).toEqual(['project'])
    expect(opts.permissionMode).toBe('default')
    expect(opts.includePartialMessages).toBe(true)
    expect(opts.maxBudgetUsd).toBe(20)
    // QA F-012 E1 düzeltmesi (B5) — `allowManagedPermissionRulesOnly` TEK BAŞINA salt-okunur
    // sınıflandırılan Bash komutlarını `canUseTool`'a hiç sormadan geçiriyordu (gerçek oturumda
    // ölçüldü, `docs/qa/F-012-2026-09-06.md` §3.2). `permissions.ask: ['Bash']` bu deliği kapatır
    // (iki yönlü kanıt: `.probe/live-test-e1.mjs`/`live-test-e1b.mjs`, `tests/integration/
    // chat-hooks-live.test.ts`).
    expect(opts.managedSettings).toEqual({
      allowManagedPermissionRulesOnly: true,
      permissions: { ask: ['Bash'] },
    })
  })

  it('MC_CHAT_ENABLED=0 iken query() hiç çağrılmaz', async () => {
    const { getHandles } = await bootstrapSession({ MC_CHAT_ENABLED: '0' })
    expect(getHandles()).toHaveLength(0)
  })
})

describe('createChatSession — mesaj kuyruklama + durum makinesi', () => {
  it('sendMessage kullanıcı ekosunu yayınlar, durumu busy yapar', async () => {
    const { session, broadcasts } = await bootstrapSession()
    const result = session.sendMessage('merhaba')
    expect('turn_id' in result).toBe(true)
    expect(session.getStatus().busy).toBe(true)
    const echo = broadcasts.find((b) => b.name === 'chat_user_echo')
    expect(echo).toBeDefined()
    expect((echo!.data as { text: string }).text).toBe('merhaba')
  })

  it('chat_disabled iken sendMessage hata döner', async () => {
    const { session } = await bootstrapSession({ MC_CHAT_ENABLED: '0' })
    const result = session.sendMessage('merhaba')
    expect(result).toEqual({ errorCode: 'chat_disabled' })
  })

  it("tam tur akışı: delta -> tool_use -> tool_result -> result(success) idle'a döner", async () => {
    const { session, getHandles, broadcasts } = await bootstrapSession()
    session.sendMessage('görevi yap')
    await flush()
    const handle = getHandles()[0]!

    handle.emit({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Me' } },
    })
    await flush()
    handle.emit({
      type: 'assistant',
      parent_tool_use_id: null,
      message: {
        content: [
          { type: 'tool_use', id: 'tu1', name: 'Bash', input: { description: 'Testi çalıştır' } },
        ],
      },
    })
    await flush()
    handle.emit({
      type: 'user',
      parent_tool_use_id: null,
      message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', is_error: false }] },
    })
    await flush()
    handle.emit({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.01 })
    await flush()

    const chatMessages = broadcasts.filter((b) => b.name === 'chat_message')
    expect(chatMessages.length).toBeGreaterThanOrEqual(2)
    expect((chatMessages[0]!.data as { delta: string }).delta).toBe('Me')
    expect((chatMessages.at(-1)!.data as { done: boolean }).done).toBe(true)

    const toolEvents = broadcasts.filter((b) => b.name === 'chat_tool')
    expect(toolEvents).toHaveLength(2)
    expect((toolEvents[0]!.data as { status: string }).status).toBe('started')
    expect((toolEvents[1]!.data as { status: string }).status).toBe('finished')
    expect((toolEvents[1]!.data as { elapsed_ms?: number }).elapsed_ms).toBeGreaterThanOrEqual(0)

    expect(session.getStatus().busy).toBe(false)
  })
})

describe('createChatSession — AC5/B3 (alt agent çalışırken ikinci mesaj, tur kuyruğu)', () => {
  it(
    "ikinci mesaj gönderilse bile ilk turun akan cevabı KENDİ turn_id'sinde kalır, " +
      'ikinci turun cevabıyla karışmaz',
    async () => {
      // Tekrar üretme (QA KALDI B3, docs/qa/F-012-2026-09-06.md §5): turn A akarken (bir alt
      // agent — tool_use — çalışırken) ikinci bir mesaj (turn B) gönderilirse, eski kod
      // `currentTurnId`'yi KOŞULSUZ B'ye geçiriyordu; A'nın devam eden delta'sı B'ye yazılıyordu
      // ve A sonsuza dek 'streaming' kalıyordu.
      const { session, getHandles, broadcasts } = await bootstrapSession()
      const resultA = session.sendMessage('turn A — bir agent başlat')
      await flush()
      const turnIdA = 'turn_id' in resultA ? resultA.turn_id : undefined
      expect(turnIdA).toBeDefined()
      const handle = getHandles()[0]!

      // Turn A: ilk delta parçası akıyor.
      handle.emit({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'A-cevabi-basladi ' },
        },
      })
      await flush()

      // Turn A: bir alt agent (tool_use) başlıyor — hâlâ turn A'nın içinde.
      handle.emit({
        type: 'assistant',
        parent_tool_use_id: null,
        message: {
          content: [
            { type: 'tool_use', id: 'tu1', name: 'Agent', input: { description: 'alt agent' } },
          ],
        },
      })
      await flush()

      // Alt agent HÂLÂ çalışırken kullanıcı ikinci bir mesaj gönderiyor (turn B).
      const resultB = session.sendMessage('turn B — araya giren mesaj')
      await flush()
      const turnIdB = 'turn_id' in resultB ? resultB.turn_id : undefined
      expect(turnIdB).toBeDefined()
      expect(turnIdB).not.toBe(turnIdA)

      // Turn A'nın devamı geliyor — B3 düzeltmesi olmadan bu B'nin turn_id'sine yazılırdı.
      handle.emit({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'A-cevabinin-DEVAMI' },
        },
      })
      await flush()

      // Turn A tamamlanıyor.
      handle.emit({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.01 })
      await flush()

      // Turn B şimdi işlenmeye başlar.
      handle.emit({
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'B-cevabi' } },
      })
      await flush()
      handle.emit({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.01 })
      await flush()

      const page = session.getHistoryPage()
      const turnAText = page.entries.find(
        (e) => e.turn_id === turnIdA && e.role === 'assistant' && e.kind === 'text'
      )
      const turnBText = page.entries.find(
        (e) => e.turn_id === turnIdB && e.role === 'assistant' && e.kind === 'text'
      )
      expect(turnAText?.text).toBe('A-cevabi-basladi A-cevabinin-DEVAMI')
      expect(turnAText?.status).toBe('done')
      expect(turnBText?.text).toBe('B-cevabi')
      expect(turnBText?.status).toBe('done')

      const chatMessages = broadcasts.filter((b) => b.name === 'chat_message')
      // Turn A'nın delta'larının HİÇBİRİ turn B'nin turn_id'sine yazılmamalı.
      expect(
        chatMessages.some(
          (b) =>
            (b.data as { turn_id: string }).turn_id === turnIdB &&
            (b.data as { delta: string }).delta.includes('DEVAMI')
        )
      ).toBe(false)
    }
  )
})

describe('createChatSession — izin akışı (canUseTool, K3)', () => {
  it('canUseTool bekler, resolvePermission çağrılana kadar sonuçlanmaz', async () => {
    const { session, getHandles, broadcasts } = await bootstrapSession()
    session.sendMessage('bir şey yap')
    await flush()
    const handle = getHandles()[0]!

    let resolved: unknown
    const promise = handle.options.canUseTool!(
      'Bash',
      { command: 'echo hi' },
      {
        signal: new AbortController().signal,
        toolUseID: 'tu1',
        requestId: 'req-1',
      }
    ).then((r) => {
      resolved = r
    })

    await flush()
    expect(resolved).toBeUndefined()
    const request = broadcasts.find((b) => b.name === 'chat_permission_request')
    expect(request).toBeDefined()
    expect((request!.data as { request_id: string }).request_id).toBe('req-1')

    const outcome = session.resolvePermission('req-1', { behavior: 'allow' })
    expect(outcome).toEqual({ resolved: true })
    await promise
    expect(resolved).toEqual({ behavior: 'allow' })

    const resolvedEvent = broadcasts.find((b) => b.name === 'chat_permission_resolved')
    expect(resolvedEvent).toBeDefined()
    expect((resolvedEvent!.data as { outcome: string }).outcome).toBe('allow')
  })

  // QA F-012 tur 2 Y1 (BLOKLAYICI) düzeltmesi — "bekleyen izin isteği varken sayfa yenilenirse
  // oturum sessizce ve kalıcı olarak kilitleniyor" (`docs/qa/F-012-2026-09-06-tur2.md` §4).
  // Sunucu artık bekleyen isteği KENDİ durumunda taşıyor: `getStatus()` her çağrıldığında
  // (sayfa yenileme sonrası `GET /api/chat/status` dahil) hâlâ bekleyen isteği listeler ve o
  // istek GERÇEKTEN cevaplanabilir kalır (aynı `request_id`, `resolvePermission` haritasından).
  it('CEO kararı F1 — bekleyen izin getStatus().pending_permissions içinde görünür ve "sayfa yenilemesi" sonrası da cevaplanabilir', async () => {
    const { session, getHandles, broadcasts } = await bootstrapSession()
    session.sendMessage('npm test çalıştır')
    await flush()
    const handle = getHandles()[0]!

    let resolved: unknown
    const promise = handle.options.canUseTool!(
      'Bash',
      { command: 'npm test' },
      { signal: new AbortController().signal, toolUseID: 'tu1', requestId: 'req-reload' }
    ).then((r) => {
      resolved = r
    })
    await flush()

    // "Sayfa yenilemesi" simülasyonu — istemcinin `GET /api/chat/status`'u tekrar çağırdığı an,
    // yani `session.getStatus()`'un TAZE bir çağrısı (istemci belleği hiç kullanılmadı).
    const statusAfterReload = session.getStatus()
    expect(statusAfterReload.pending_permissions).toEqual([
      {
        request_id: 'req-reload',
        turn_id: expect.any(String),
        tool_name: 'Bash',
        input_preview: 'npm test',
        ts: expect.any(String),
      },
    ])
    // canUseTool anında `chat_status` da yayınlanmış olmalı (canlı sekmeler için) — yalnızca
    // `GET /api/chat/status`'a bel bağlanmıyor.
    const liveStatus = broadcasts.filter((b) => b.name === 'chat_status')
    expect(
      liveStatus.some(
        (b) => (b.data as { pending_permissions: unknown[] }).pending_permissions.length === 1
      )
    ).toBe(true)

    // "Yenilenmiş sayfa"nın gördüğü `request_id` ile karar veriliyor — hâlâ çalışıyor.
    const outcome = session.resolvePermission('req-reload', { behavior: 'allow' })
    expect(outcome).toEqual({ resolved: true })
    await promise
    expect(resolved).toEqual({ behavior: 'allow' })

    // Çözülünce liste boşalır (kalıcı kilitlenme kalıntısı bırakmaz).
    expect(session.getStatus().pending_permissions).toEqual([])
  })

  it('bilinmeyen request_id için request_not_found döner', async () => {
    const { session } = await bootstrapSession()
    expect(session.resolvePermission('yok', {})).toEqual({ errorCode: 'request_not_found' })
  })
})

describe('createChatSession — interrupt', () => {
  it('busy değilken no_active_turn döner', async () => {
    const { session } = await bootstrapSession()
    const result = await session.interrupt()
    expect(result).toEqual({ errorCode: 'no_active_turn' })
  })

  it("busy iken interrupt() gerçek Query.interrupt()'ı çağırır, turu sonlandırır", async () => {
    const { session, getHandles } = await bootstrapSession()
    session.sendMessage('uzun iş')
    await flush()
    const handle = getHandles()[0]!
    const result = await session.interrupt()
    expect(result).toEqual({ interrupted: true })
    expect(handle.interruptCalls).toBe(1)
    expect(session.getStatus().busy).toBe(false)
  })
})

describe('createChatSession — restart', () => {
  it('eski Query.close() çağrılır, yeni query() resume ile açılır', async () => {
    const { session, getHandles } = await bootstrapSession()
    const firstHandle = getHandles()[0]!
    firstHandle.emit({ type: 'system', subtype: 'init', session_id: 'sess-abc' })
    await flush()
    expect(session.getStatus().session_id).toBe('sess-abc')

    const result = await session.restart()
    expect(firstHandle.closeCalls).toBe(1)
    const handles = getHandles()
    expect(handles).toHaveLength(2)
    expect(handles[1]!.options.resume).toBe('sess-abc')
    expect('session_id' in result).toBe(true)
  })
})

describe('createChatSession — hata sınırı (§9)', () => {
  it('generator hata fırlatınca durum crashed olur, chat_error yayınlanır, süreç çökmez', async () => {
    const { session, getHandles, broadcasts } = await bootstrapSession()
    session.sendMessage('patlayacak')
    await flush()
    const handle = getHandles()[0]!
    handle.throwError(new Error('boom'))
    await flush()

    expect(session.getStatus().last_error).toBe('crashed')
    expect(broadcasts.some((b) => b.name === 'chat_error')).toBe(true)
    // Sunucu ayakta: session.getStatus() hâlâ çağrılabiliyor, throw etmiyor.
    expect(() => session.getStatus()).not.toThrow()
  })
})

describe('createChatSession — Ö4 (QA KALDI): tur-içi hata oturumu çökertmese bile kalıcı olarak görünür', () => {
  it(
    "is_error===true ama session_active=true kalan bir 'result' " +
      "geçmişe kind:'error' girdisi ekler ve chat_error turn_id/chat_seq taşır",
    async () => {
      // Tekrar üretme (QA KALDI Ö4): eskiden bu dal yalnızca `chat_error` broadcast edip
      // `finalizeTurn('done')` çağırıyordu — oturum ÇÖKMEDİĞİ (session_active hâlâ true) için
      // `ChatScreen`'in `sessionDown`/`ErrorRow` yolu hiç tetiklenmiyordu ve `chat_error`
      // hiçbir transkript girdisine bağlı değildi; kullanıcı turun hatayla bittiğini asla
      // görmüyordu.
      const { session, getHandles, broadcasts } = await bootstrapSession()
      const result = session.sendMessage('bu tur hatayla bitecek')
      await flush()
      const turnId = 'turn_id' in result ? result.turn_id : undefined
      expect(turnId).toBeDefined()
      const handle = getHandles()[0]!

      handle.emit({ type: 'result', subtype: 'success', is_error: true, total_cost_usd: 0.01 })
      await flush()

      // Oturum ÇÖKMEDİ — bu Ö4'ün tam da ayırt ettiği durum (crashed farklı bir test'te).
      expect(session.getStatus().session_active).toBe(true)

      const errorBroadcast = broadcasts.find(
        (b) => b.name === 'chat_error' && (b.data as { code: string }).code === 'internal_error'
      )
      expect(errorBroadcast).toBeDefined()
      const errorData = errorBroadcast!.data as { turn_id?: string; chat_seq?: number }
      expect(errorData.turn_id).toBe(turnId)
      expect(typeof errorData.chat_seq).toBe('number')

      const page = session.getHistoryPage()
      const errorEntry = page.entries.find((e) => e.turn_id === turnId && e.kind === 'error')
      expect(errorEntry?.text).toBe('Sohbet turu hatayla sonuçlandı.')
      expect(errorEntry?.seq).toBe(errorData.chat_seq)
    }
  )
})

describe('createChatSession — D11 bütçe tavanı (mutasyon 14)', () => {
  it("error_max_budget_usd sonucu sessizce yutulmaz: crashed + 'budget_exceeded' + chat_error", async () => {
    const { session, getHandles, broadcasts } = await bootstrapSession()
    session.sendMessage('pahalı iş')
    await flush()
    const handle = getHandles()[0]!
    handle.emit({
      type: 'result',
      subtype: 'error_max_budget_usd',
      is_error: true,
      total_cost_usd: 25,
    })
    await flush()

    expect(session.getStatus().last_error).toBe('budget_exceeded')
    expect(session.getStatus().session_active).toBe(false)
    expect(broadcasts.some((b) => b.name === 'chat_status')).toBe(true)
    expect(broadcasts.some((b) => b.name === 'chat_error')).toBe(true)
  })
})

describe('K3 çevrimdışı çit (mutasyon 13, Y-B1) — allowManagedPermissionRulesOnly gerçekten etkili', () => {
  it("buildOptions'ın ürettiği managedSettings, SDK'nın kendi resolveSettings motorunda etkili olur", async () => {
    // Kaynaktan türetilmiş: burada literal bir obje YAZILMIYOR, `session.ts`'in gerçek
    // buildOptions() çıktısından (sahte query()'e geçirilen `options.managedSettings`) okunuyor.
    // Bu turun mutasyonu (D6/D10, F-012-kod-turu-A-notlari.md) bu alanın `permissions` içine
    // gömülürse veya kaldırılırsa `resolveSettings`'in `managed` kaynağı hiç belirmez.
    const { getHandles } = await bootstrapSession()
    const opts = getHandles()[0]!.options
    const resolved = await resolveSettings({
      cwd: CHAT_SESSION_CWD,
      managedSettings: opts.managedSettings,
    })
    expect(resolved.effective.allowManagedPermissionRulesOnly).toBe(true)
    const managedSource = resolved.sources.find((s) => s.source === 'managed')
    expect(managedSource).toBeDefined()
    expect(
      (managedSource!.settings as { allowManagedPermissionRulesOnly?: boolean })
        .allowManagedPermissionRulesOnly
    ).toBe(true)
    // QA F-012 E1 (B5) — `permissions.ask: ['Bash']`'ın da gerçekten etkin ayar kademesine
    // ulaştığını doğrula. Bu tek başına "SDK izin motoru buna uyuyor mu" sorusunu KANITLAMAZ
    // (o yalnızca canlı testle kanıtlanır, `tests/integration/chat-hooks-live.test.ts`) — ama
    // yapılandırmanın sessizce kaybolmadığını (§8a'nın kendi uyarısı: "raw cascade, not a
    // security decision") çevrimdışı, `verify` içinde, kota harcamadan doğrular.
    expect(resolved.effective.permissions?.ask).toEqual(['Bash'])
  })
})

describe('createChatSession — stopAll', () => {
  it('Query.close() çağırır', async () => {
    const { session, getHandles } = await bootstrapSession()
    session.stopAll()
    expect(getHandles()[0]!.closeCalls).toBe(1)
  })
})
