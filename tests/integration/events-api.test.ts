import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createServer } from '../../src/server/index'
import { dayFileName } from '../../src/server/store/jsonl-store'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'

interface ServerHandle {
  server: http.Server
  port: number
  baseUrl: string
}

async function startServer(dataDir: string): Promise<ServerHandle> {
  const server = createServer(0, dataDir)
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('beklenmeyen adres türü')
  }
  return { server, port: address.port, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function stopServer(handle: ServerHandle): Promise<void> {
  // F-003 Bulgu 1: `server.close()` tek başına, açık bir SSE bağlantısı varken asla
  // tamamlanmaz (`'close'` olayı tüm bağlantılar bitene kadar ateşlenmez). `closeAllConnections`
  // (Node >=18.2 native) tüm aktif soketleri (SSE dahil) anında yok eder, bu da her SSE
  // bağlantısının kendi `req.on('close')` temizliğini (unsubscribe + keepalive) tetikler.
  handle.server.closeAllConnections()
  handle.server.close()
  await once(handle.server, 'close')
}

/**
 * Windows'ta bu makinede yüzlerce **eşzamanlı yeni TCP bağlantısı** (her istek ayrı soket)
 * bir kısmı `ECONNREFUSED` ile reddediliyor — çıplak `node:http` ile bile, sunucu kodundan
 * bağımsız, platforma özgü bir bağlantı kurma hızı sınırı (doğrulandı: F-002 geliştirme turu,
 * boş bir `http.createServer` ile aynı hata tekrarlandı). Gerçek dünyada `send-event.js` de
 * `keep-alive` kullanmayan tek seferlik istekler gönderir ama bu kadar yüksek eşzamanlılıkla
 * değil. Testin ölçmek istediği şey (yazma kuyruğunun sırayı bozmadığı) bağlantı sayısından
 * bağımsızdır — bu yüzden `keepAlive` + sınırlı soket sayılı bir ajan kullanılır; sunucu
 * tarafında hâlâ yüzlerce eşzamanlı istek işlenir, yalnızca istemci tarafı bağlantı kurma
 * darboğazı aşılır.
 */
const burstAgent = new http.Agent({ keepAlive: true, maxSockets: 50 })

function postJson(
  baseUrl: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/events', baseUrl)
    const payload = typeof body === 'string' ? body : JSON.stringify(body)
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        agent: burstAgent,
        headers: { 'content-type': 'application/json', ...headers },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({ status: res.statusCode ?? 0, json: text.length > 0 ? JSON.parse(text) : null })
        })
      }
    )
    req.on('error', reject)
    req.end(payload)
  })
}

function readDayFileLines(dataDir: string, now: Date = new Date()): string[] {
  const file = path.join(dataDir, 'events', dayFileName(now))
  const content = fs.readFileSync(file, 'utf8')
  return content.split('\n').filter((l) => l.length > 0)
}

describe('POST/GET /api/events — entegrasyon', () => {
  let dataDir: string
  let handle: ServerHandle

  beforeEach(async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
  })

  afterEach(async () => {
    await stopServer(handle)
    removeTempDataDir(dataDir)
  })

  it('AC-1: POST sonrası satır dosyaya yazılır ve GET ile geri döner', async () => {
    const res = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        hook_event_name: 'PreToolUse',
        project_path: 'C:\\dev\\apps\\demo',
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
        session_id: 's1',
      }),
    })
    expect(res.status).toBe(202)
    const body = (await res.json()) as {
      success: boolean
      data: { id: string; seq: number; flags: string[] }
    }
    expect(body.success).toBe(true)
    expect(body.data.seq).toBe(0)
    expect(body.data.flags).toEqual([])

    const lines = readDayFileLines(dataDir)
    expect(lines).toHaveLength(1)
    const onDisk = JSON.parse(lines[0]!) as { seq: number; summary: string }
    expect(onDisk.seq).toBe(0)
    expect(onDisk.summary).toBe('npm test')

    const getRes = await fetch(`${handle.baseUrl}/api/events?since_seq=-1`)
    expect(getRes.status).toBe(400) // since_seq negatif -> invalid_body (yalnızca eksikse -1 varsayılan)

    const getAll = await fetch(`${handle.baseUrl}/api/events`)
    expect(getAll.status).toBe(200)
    const allBody = (await getAll.json()) as {
      success: boolean
      data: unknown[]
      meta: { total: number }
    }
    expect(allBody.success).toBe(true)
    expect(allBody.data).toHaveLength(1)
    expect(allBody.meta.total).toBe(1)
  })

  it('AC-2: eksik alanlı olay 5xx dönmez, missing_fields ile kaydedilir', async () => {
    const res = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool_name: 'Bash' }),
    })
    expect(res.status).toBe(202)
    const body = (await res.json()) as { data: { flags: string[] } }
    expect(body.data.flags).toContain('missing_fields')
  })

  it('AC-2: patolojik gövdelerde asla 5xx dönmez', async () => {
    const bodies: Array<{ name: string; body: BodyInit; contentType?: string }> = [
      { name: 'boş gövde', body: '' },
      { name: 'null', body: 'null' },
      { name: 'dizi', body: '[]' },
      { name: 'json olmayan düz metin', body: 'bu json değil' },
      { name: 'content-type eksik', body: JSON.stringify({ a: 1 }), contentType: '' },
      { name: 'content-type yanlış', body: JSON.stringify({ a: 1 }), contentType: 'text/plain' },
      {
        name: 'çok derin iç içe nesne',
        body: JSON.stringify(
          Array.from({ length: 50 }).reduce((acc: unknown) => ({ nested: acc }), {})
        ),
      },
      { name: 'UTF-8 dışı bayt dizisi', body: new Uint8Array([0xff, 0xfe, 0x00, 0x80, 0x81]) },
      {
        name: '256KB sınırına yakın (sınırın altında) gövde',
        body: JSON.stringify({ hook_event_name: 'PreToolUse', filler: 'x'.repeat(250000) }),
      },
    ]

    for (const scenario of bodies) {
      const headers: Record<string, string> = {}
      if (scenario.contentType !== '')
        headers['content-type'] = scenario.contentType ?? 'application/json'
      const res = await fetch(`${handle.baseUrl}/api/events`, {
        method: 'POST',
        headers,
        body: scenario.body,
      })
      expect(res.status, `senaryo: ${scenario.name}`).toBeLessThan(500)
    }
  })

  it('AC-2: gövde 256 KB sınırını aşarsa 400 invalid_body döner, kaydedilmez', async () => {
    const oversized = 'x'.repeat(262144 + 10)
    const res = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse', filler: oversized }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { success: boolean; error: { code: string } }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('invalid_body')

    const eventsDir = path.join(dataDir, 'events')
    const file = path.join(eventsDir, dayFileName(new Date()))
    const exists = fs.existsSync(file)
    expect(!exists || fs.readFileSync(file, 'utf8').trim() === '').toBe(true)
  })

  it('AC-3: raw alanı diske yazılıp geri okunurken kaybolmaz (bilinmeyen alan dahil)', async () => {
    const res = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        hook_event_name: 'PreToolUse',
        project_path: 'C:\\dev\\apps\\demo',
        custom_marker: 'xyz123',
      }),
    })
    expect(res.status).toBe(202)

    const lines = readDayFileLines(dataDir)
    const onDisk = JSON.parse(lines[0]!) as { raw: { custom_marker: string } }
    expect(onDisk.raw.custom_marker).toBe('xyz123')

    const getRes = await fetch(`${handle.baseUrl}/api/events`)
    const body = (await getRes.json()) as { data: Array<{ raw: { custom_marker: string } }> }
    expect(body.data[0]?.raw.custom_marker).toBe('xyz123')
  })

  it('AC-4: 500 eşzamanlı POST — tamamı 202, JSONL fiziksel satır sırası seq ile birebir örtüşür', async () => {
    const N = 500
    const responses = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        postJson(handle.baseUrl, {
          hook_event_name: 'PreToolUse',
          project_path: 'C:\\dev\\apps\\demo',
          i,
        })
      )
    )
    for (const res of responses) {
      expect(res.status).toBe(202)
    }

    const lines = readDayFileLines(dataDir)
    expect(lines).toHaveLength(N)
    const seqs = lines.map((line) => (JSON.parse(line) as { seq: number }).seq)
    const expected = Array.from({ length: N }, (_, i) => i)
    expect(seqs).toEqual(expected)
  })

  it('AC-7: 300 eşzamanlı POST — her satır geçerli JSON, satır sayısı = istek sayısı', async () => {
    const N = 300
    await Promise.all(
      Array.from({ length: N }, () =>
        postJson(handle.baseUrl, {
          hook_event_name: 'PreToolUse',
          project_path: 'C:\\dev\\apps\\demo',
        })
      )
    )
    const lines = readDayFileLines(dataDir)
    expect(lines).toHaveLength(N)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
    const seqs = lines.map((line) => (JSON.parse(line) as { seq: number }).seq)
    const sorted = [...seqs].sort((a, b) => a - b)
    expect(seqs).toEqual(sorted)
    expect(new Set(seqs).size).toBe(N)
  })

  it('AC-8: cross-origin Origin ile POST -> 403, olay kaydedilmez', async () => {
    const res = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'http://evil.com' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { success: boolean; error: { code: string } }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('forbidden_origin')

    const eventsDir = path.join(dataDir, 'events')
    const file = path.join(eventsDir, dayFileName(new Date()))
    const exists = fs.existsSync(file)
    expect(!exists || fs.readFileSync(file, 'utf8').trim() === '').toBe(true)
  })

  it('AC-8: Origin başlığı yoksa POST normal işlenir', async () => {
    const res = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(res.status).toBe(202)
  })

  it('AC-8: aynı origin (127.0.0.1) ile POST normal işlenir', async () => {
    const res = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: handle.baseUrl },
      body: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(res.status).toBe(202)
  })
})

describe('B1 (QA düzeltme turu 1): disk yazma hatasında sunucu ölmez, kuyruk zehirlenmez', () => {
  let dataDir: string
  let handle: ServerHandle

  beforeEach(async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
  })

  afterEach(async () => {
    await stopServer(handle)
    removeTempDataDir(dataDir)
  })

  it('gün dosyası adında bir dizin varken POST 503 döner (timeout yok), engel kalkınca sonraki POST 202 olur', async () => {
    const eventsDir = path.join(dataDir, 'events')
    const dayFilePath = path.join(eventsDir, dayFileName(new Date()))
    // QA'nın ürettiği senaryo birebir: gün dosyası adında bir DİZİN oluştur.
    fs.mkdirSync(dayFilePath)

    const res1 = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    // İstemci bir yanıt ALDI (timeout'a düşmedi) ve yanıt dürüst: olay saklanmadı.
    expect(res1.status).toBe(503)
    const body1 = (await res1.json()) as { success: boolean; error: { code: string } }
    expect(body1.success).toBe(false)
    expect(body1.error.code).toBe('storage_unavailable')

    // Sunucu sürecinin YAŞADIĞININ kanıtı: aynı Node sürecinde koşan bu test dosyasının
    // geri kalanı hâlâ çalışıyor (eski davranışta unhandledRejection tüm süreci öldürürdü).
    const healthRes = await fetch(`${handle.baseUrl}/api/health`)
    expect(healthRes.status).toBe(200)
    const health = (await healthRes.json()) as { write_errors: number }
    expect(health.write_errors).toBeGreaterThanOrEqual(1)

    // Engeli kaldır — kuyruk zehirlenmemiş olmalı, sonraki sağlıklı istek çalışmalı.
    fs.rmdirSync(dayFilePath)
    const res2 = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(res2.status).toBe(202)

    const lines = readDayFileLines(dataDir)
    expect(lines).toHaveLength(1)
  })
})

describe('N-1 (F-003 CEO kararı C): 503 dönen olay GET /api/events üzerinde hiç görünmez', () => {
  let dataDir: string
  let handle: ServerHandle

  beforeEach(async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
  })

  afterEach(async () => {
    await stopServer(handle)
    removeTempDataDir(dataDir)
  })

  it('503 dönen olay ring/GET sonucunda hayalet olarak kalmaz, sonraki geçerli olay görünür', async () => {
    const eventsDir = path.join(dataDir, 'events')
    const dayFilePath = path.join(eventsDir, dayFileName(new Date()))
    fs.mkdirSync(dayFilePath)

    const failRes = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(failRes.status).toBe(503)

    const getAfterFail = await fetch(`${handle.baseUrl}/api/events`)
    const afterFailBody = (await getAfterFail.json()) as { data: unknown[] }
    expect(afterFailBody.data).toHaveLength(0)

    fs.rmdirSync(dayFilePath)
    const okRes = await fetch(`${handle.baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(okRes.status).toBe(202)

    const getFinal = await fetch(`${handle.baseUrl}/api/events`)
    const finalBody = (await getFinal.json()) as { data: Array<{ seq: number }> }
    expect(finalBody.data.map((e) => e.seq)).toEqual([1])
  })
})

describe('AC-5: sunucu yeniden başlatılınca en az 100 olay geri döner', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = createTempDataDir()
  })

  afterEach(() => {
    removeTempDataDir(dataDir)
  })

  it("aynı dataDir üzerinde ikinci sunucu örneği ring buffer'ı diskten yükler", async () => {
    const firstHandle = await startServer(dataDir)
    for (let i = 0; i < 150; i++) {
      const res = await fetch(`${firstHandle.baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'PreToolUse',
          project_path: 'C:\\dev\\apps\\demo',
          i,
        }),
      })
      expect(res.status).toBe(202)
    }
    await stopServer(firstHandle)

    const secondHandle = await startServer(dataDir)
    try {
      const res = await fetch(`${secondHandle.baseUrl}/api/events?limit=1000`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { data: Array<{ seq: number }> }
      expect(body.data.length).toBeGreaterThanOrEqual(100)
      const seqs = body.data.map((e) => e.seq)
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
      expect(new Set(seqs).size).toBe(seqs.length)

      // wiring kanıtı: yeni sunucudan gelen bir POST, önceki sunucunun bıraktığı seq'ten
      // devam eder (bootstrap gerçekten store.init() çağırıyor).
      const postRes = await fetch(`${secondHandle.baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hook_event_name: 'PreToolUse',
          project_path: 'C:\\dev\\apps\\demo',
        }),
      })
      const postBody = (await postRes.json()) as { data: { seq: number } }
      expect(postBody.data.seq).toBe(150)
    } finally {
      await stopServer(secondHandle)
    }
  })
})

describe("CEO düzeltmesi: istemcinin gerçek ilk yükleme URL'i sunucuda 200 döner", () => {
  let dataDir: string
  let handle: ServerHandle

  beforeEach(async () => {
    dataDir = createTempDataDir()
    handle = await startServer(dataDir)
  })

  afterEach(async () => {
    await stopServer(handle)
    removeTempDataDir(dataDir)
  })

  it('useEventStream.loadEvents ile birebir aynı URL (`?limit=200`, since_seq YOK) gerçek sunucudan 200 döner', async () => {
    // Mock yok: gerçek createServer + gerçek istek. Bu test, useEventStream.ts'in kurduğu
    // URL'i (INITIAL_LOAD_LIMIT=200, since_seq parametresiz) sunucunun kabul ettiğini kanıtlar.
    // Mutasyon: bu satırdaki URL'e `since_seq=-1` eklenirse sunucu 400 invalid_body döner ve
    // bu test KIRMIZI olur (bkz. docs/qa/F-003-contract.md "CEO düzeltmesi — ilk yükleme URL'i").
    const res = await fetch(`${handle.baseUrl}/api/events?limit=200`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; data: unknown[] }
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })
})
