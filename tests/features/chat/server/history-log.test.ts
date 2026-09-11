import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createHistoryLog,
  foldByTurn,
  type HistoryLog,
} from '../../../../src/features/chat/server/history-log'
import type { ChatLogEntry } from '../../../../src/shared/types'

let dataDir: string
let log: HistoryLog

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-chat-history-'))
  log = createHistoryLog(dataDir)
  log.init()
})

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
})

function entry(overrides: Partial<ChatLogEntry> & { seq: number }): ChatLogEntry {
  return {
    turn_id: 't1',
    role: 'assistant',
    kind: 'text',
    status: 'done',
    ts: '2026-09-06T00:00:00.000Z',
    ...overrides,
  }
}

describe('foldByTurn (saf fonksiyon)', () => {
  it('aynı (turn_id, kind) çiftinde en yüksek seq kazanır, sonuç seq artan sıralı', () => {
    const entries = [
      entry({ seq: 1, turn_id: 'a', kind: 'text', status: 'streaming', text: 'me' }),
      entry({ seq: 2, turn_id: 'b', kind: 'text', status: 'done', text: 'other' }),
      entry({ seq: 3, turn_id: 'a', kind: 'text', status: 'done', text: 'merhaba' }),
    ]
    const folded = foldByTurn(entries)
    expect(folded.map((e) => e.seq)).toEqual([2, 3])
    expect(folded.find((e) => e.turn_id === 'a')?.text).toBe('merhaba')
    expect(folded.find((e) => e.turn_id === 'a')?.status).toBe('done')
  })

  it('farklı kind aynı turn_id için ayrı kayıt kalır', () => {
    const entries = [
      entry({ seq: 1, turn_id: 'a', kind: 'text' }),
      entry({ seq: 2, turn_id: 'a', kind: 'tool' }),
    ]
    expect(foldByTurn(entries)).toHaveLength(2)
  })
})

describe('createHistoryLog — append + readPage', () => {
  it('eklenen kayıt diskten okunabilir', async () => {
    log.append({
      turn_id: 't1',
      role: 'user',
      kind: 'text',
      status: 'done',
      text: 'merhaba',
      ts: 'x',
    })
    await log.flush()
    const page = log.readPage()
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0]?.text).toBe('merhaba')
    expect(page.entries[0]?.seq).toBe(1)
  })

  it('seq monoton artar, ekleme-only (var olan satır yeniden yazılmaz)', async () => {
    const first = log.append({ turn_id: 't1', role: 'user', kind: 'text', status: 'done', ts: 'x' })
    const second = log.append({
      turn_id: 't1',
      role: 'assistant',
      kind: 'text',
      status: 'streaming',
      ts: 'x',
    })
    expect(first.seq).toBe(1)
    expect(second.seq).toBe(2)
    await log.flush()
    const raw = fs.readFileSync(path.join(dataDir, 'chat', 'history.jsonl'), 'utf8')
    expect(raw.split('\n').filter(Boolean)).toHaveLength(2)
  })

  it('sayfalama: limit ve beforeSeq (Ö4)', async () => {
    for (let i = 0; i < 5; i++) {
      log.append({
        turn_id: `t${i}`,
        role: 'user',
        kind: 'text',
        status: 'done',
        text: `m${i}`,
        ts: 'x',
      })
    }
    const page1 = log.readPage({ limit: 2 })
    expect(page1.entries.map((e) => e.text)).toEqual(['m3', 'm4'])
    expect(page1.has_more).toBe(true)

    const cursor = page1.entries[0]!.seq
    const page2 = log.readPage({ limit: 2, beforeSeq: cursor })
    expect(page2.entries.map((e) => e.text)).toEqual(['m1', 'm2'])
    expect(page2.has_more).toBe(true)

    const page3 = log.readPage({ limit: 50, beforeSeq: page2.entries[0]!.seq })
    expect(page3.entries.map((e) => e.text)).toEqual(['m0'])
    expect(page3.has_more).toBe(false)
  })
})

describe('createHistoryLog — B2 (QA KALDI): aynı turdaki kullanıcı mesajı ve CEO cevabı', () => {
  it('kullanıcı (role:user) ve CEO (role:assistant) girdileri AYNI turn_id paylaşsa bile ikisi de kalır', async () => {
    // Tekrar üretme: `session.ts` `sendMessage` ile `finalizeTurn` aynı `turnId`'yi kullanır —
    // kullanıcının kendi mesajı ve CEO'nun cevabı gerçekte hep aynı turn_id'yi paylaşır. `role`
    // olmadan `foldByTurn`'ün `${turn_id}::${kind}` anahtarı ikisini de aynı sepete koyup yüksek
    // `seq`'li (assistant) girdiyi kullanıcının mesajının ÜZERİNE yazıyordu (AC7 ihlali, B2).
    const userEntry = log.append({
      turn_id: 't1',
      role: 'user',
      kind: 'text',
      status: 'done',
      text: 'merhaba CEO',
      ts: 'x',
    })
    const assistantEntry = log.append({
      turn_id: 't1',
      role: 'assistant',
      kind: 'text',
      status: 'done',
      text: 'merhaba, nasıl yardımcı olabilirim?',
      ts: 'x',
    })
    await log.flush()
    const page = log.readPage()
    expect(page.entries).toHaveLength(2)
    const byRole = new Map(page.entries.map((e) => [e.role, e]))
    expect(byRole.get('user')?.text).toBe('merhaba CEO')
    expect(byRole.get('user')?.seq).toBe(userEntry.seq)
    expect(byRole.get('assistant')?.text).toBe('merhaba, nasıl yardımcı olabilirim?')
    expect(byRole.get('assistant')?.seq).toBe(assistantEntry.seq)
  })
})

describe('createHistoryLog — markDanglingAsInterrupted (Ö3, init() çağırır)', () => {
  it('restart sonrası yarım kalan streaming girdisi yeni bir interrupted satırla düzeltilir, eski satır silinmez', async () => {
    log.append({
      turn_id: 't1',
      role: 'assistant',
      kind: 'text',
      status: 'streaming',
      text: 'yarım',
      ts: 'x',
    })
    await log.flush()

    // "restart" — yeni bir HistoryLog örneği aynı dataDir'i açar (gerçek dünyadaki init() çağrısı).
    const restarted = createHistoryLog(dataDir)
    restarted.init()
    await restarted.flush()

    const raw = fs.readFileSync(path.join(dataDir, 'chat', 'history.jsonl'), 'utf8')
    const lines = raw
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ChatLogEntry)
    // Eski satır DEĞİŞMEDİ (hâlâ streaming olarak duruyor, diskte).
    expect(lines[0]?.status).toBe('streaming')
    // Yeni bir düzeltme satırı eklendi.
    expect(lines).toHaveLength(2)
    expect(lines[1]?.status).toBe('interrupted')
    expect(lines[1]?.turn_id).toBe('t1')

    const page = restarted.readPage()
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0]?.status).toBe('interrupted')
  })

  it('done durumundaki girdiler restart sonrası dokunulmaz kalır', async () => {
    log.append({
      turn_id: 't1',
      role: 'assistant',
      kind: 'text',
      status: 'done',
      text: 'tamam',
      ts: 'x',
    })
    await log.flush()

    const restarted = createHistoryLog(dataDir)
    restarted.init()
    await restarted.flush()

    const page = restarted.readPage()
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0]?.status).toBe('done')
  })
})

describe('foldByTurn — Ö7 (kind:tool, tool_use_id anahtarı)', () => {
  it('aynı turda İKİ FARKLI tool_use_id İKİSİ DE hayatta kalır (turn_id/kind/role tek başına yetersiz)', () => {
    const entries = [
      entry({
        seq: 1,
        turn_id: 'a',
        kind: 'tool',
        tool_use_id: 'tuA',
        tool_name: 'Read',
        tool_status: 'started',
      }),
      entry({
        seq: 2,
        turn_id: 'a',
        kind: 'tool',
        tool_use_id: 'tuB',
        tool_name: 'Bash',
        tool_status: 'started',
      }),
    ]
    const folded = foldByTurn(entries)
    expect(folded).toHaveLength(2)
    expect(folded.map((e) => e.tool_use_id).sort()).toEqual(['tuA', 'tuB'])
  })

  it('aynı tool_use_id için started -> finished geçişinde yalnızca finished hayatta kalır (tek satır)', () => {
    const entries = [
      entry({
        seq: 1,
        turn_id: 'a',
        kind: 'tool',
        tool_use_id: 'tuA',
        tool_name: 'Bash',
        tool_status: 'started',
        text: 'çalışıyor',
      }),
      entry({
        seq: 2,
        turn_id: 'a',
        kind: 'tool',
        tool_use_id: 'tuA',
        tool_name: 'Bash',
        tool_status: 'finished',
        text: 'çalışıyor',
        elapsed_ms: 500,
      }),
    ]
    const folded = foldByTurn(entries)
    expect(folded).toHaveLength(1)
    expect(folded[0]?.tool_status).toBe('finished')
    expect(folded[0]?.elapsed_ms).toBe(500)
  })
})

describe('createHistoryLog — markDanglingAsInterrupted, Ö7 (kind:tool)', () => {
  it('restart sırasında hâlâ tool_status:started olan bir araç kaydı error olarak kapatılır (yeni satır, eski silinmez)', async () => {
    log.append({
      turn_id: 't1',
      role: 'assistant',
      kind: 'tool',
      status: 'done',
      text: 'yarım kalan araç',
      tool_use_id: 'tuX',
      tool_name: 'Bash',
      tool_status: 'started',
      ts: 'x',
    })
    await log.flush()

    const restarted = createHistoryLog(dataDir)
    restarted.init()
    await restarted.flush()

    const raw = fs.readFileSync(path.join(dataDir, 'chat', 'history.jsonl'), 'utf8')
    const lines = raw
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ChatLogEntry)
    expect(lines).toHaveLength(2)
    expect(lines[0]?.tool_status).toBe('started')
    expect(lines[1]?.tool_status).toBe('error')
    expect(lines[1]?.tool_use_id).toBe('tuX')

    const page = restarted.readPage()
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0]?.tool_status).toBe('error')
  })

  it('tool_status:finished olan bir araç kaydı restart sonrası dokunulmaz kalır', async () => {
    log.append({
      turn_id: 't1',
      role: 'assistant',
      kind: 'tool',
      status: 'done',
      text: 'bitti',
      tool_use_id: 'tuY',
      tool_name: 'Bash',
      tool_status: 'finished',
      elapsed_ms: 10,
      ts: 'x',
    })
    await log.flush()

    const restarted = createHistoryLog(dataDir)
    restarted.init()
    await restarted.flush()

    const page = restarted.readPage()
    expect(page.entries).toHaveLength(1)
    expect(page.entries[0]?.tool_status).toBe('finished')
  })
})
