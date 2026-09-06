import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createChatSession,
  isChatEnabled,
  resolveChatBudget,
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
    expect(opts.managedSettings).toEqual({ allowManagedPermissionRulesOnly: true })
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

describe('createChatSession — stopAll', () => {
  it('Query.close() çağırır', async () => {
    const { session, getHandles } = await bootstrapSession()
    session.stopAll()
    expect(getHandles()[0]!.closeCalls).toBe(1)
  })
})
