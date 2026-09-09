import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import dgram from 'node:dgram'
import dns from 'node:dns'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { computeUsageReport } from '../../../../src/features/usage/server/usage-aggregator'
import { encodeProjectDirName } from '../../../../src/features/thread/server/transcript-reader'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'

// F-011 sözleşmesi §3 — Y4 doğruluk çiti: fixture'daki her sayı ELLE hesaplanmış, `computeUsageReport`
// yalnızca bu elle hesaplanmış toplamlarla karşılaştırılır (kod okuyarak "doğru görünüyor" değil).

const dirs: string[] = []
function tempDir(): string {
  const d = createTempDataDir()
  dirs.push(d)
  return d
}
afterEach(() => {
  while (dirs.length > 0) removeTempDataDir(dirs.pop()!)
  vi.restoreAllMocks()
})

function assistantLine(usage: {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}): string {
  return JSON.stringify({ type: 'assistant', message: { usage } })
}

function writeWithMtime(filePath: string, content: string, mtimeIso: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  const t = new Date(mtimeIso)
  fs.utimesSync(filePath, t, t)
}

/**
 * F-011 QA düzeltme turu 4 (AA1, BLOKLAYICI B1) — BİRİNCİL DAVRANIŞ KATMANI.
 * Turun 4'ünün bulgusu: bu dosyanın önceki "kendi rastgele portunu dinleyen sunucu" yaklaşımı
 * SADECE KENDİ portuna gelen isteği görebiliyordu; QA'nın V5/V6/V7 sondaları BAŞKA bir porta
 * (45911) gitti ve bu ikinci katman onları kaçırdı (bkz. `docs/qa/F-011-2026-09-10-tur4.md`
 * §2.5 — "iki katman pratikte tek katmandır"). Bu sonda artık GERÇEK bağlantı kurma
 * noktalarının (`net`/`tls`/`http`/`https`/`dgram`/`dns` + `fetch`) KENDİSİNİ GLOBAL olarak
 * kuşatır: hedef host/port ne olursa olsun, hangi SÖZDİZİMİYLE (`.js` uzantılı import,
 * `export … from`, dinamik `import()`, vb.) tetiklendiği tamamen ÖNEMSİZDİR — yalnızca
 * "gerçekten bir bağlantı girişimi oldu mu" ölçülür. Statik AST taraması (
 * `network-capability-guard.test.ts`) hâlâ birinci savunma hattı (erken uyarı); bu katman JS
 * seviyesindeki sözdizimi boşluklarını (bilinen veya bilinmeyen) yakalayan asıl korumadır —
 * `process.binding`/`process.dlopen` de (tur 5, B2) ayrıca doğrudan kuşatılır, çünkü metinsel
 * tarayıcının yakalayabildiği tek biçim (`process.binding(` literal) bu depoda derlenmez (bkz.
 * `network-capability-guard.test.ts`teki N2/N2b).
 *
 * `record()` HER ZAMAN önce kaydeder, SONRA senkron çağıran için fırlatır / asenkron (`fetch`,
 * `dns.promises.*`) çağıran için reddedilmiş bir promise döner — böylece çağıran taraf hatayı
 * yutsa ya da "unhandled rejection" oluşsa bile ihlal `calls` dizisinde kalıcı olarak görünür ve
 * test bunu okuyarak KIRMIZI verir.
 */
function installNetworkCapabilitySentinel(): {
  calls: string[]
  restore: () => void
} {
  const calls: string[] = []
  const restores: Array<() => void> = []

  function patch(obj: Record<string, unknown>, key: string, label: string, isAsync = false): void {
    const original = obj[key]
    // F-011 QA tur 5 (BLOKLAYICI B1) — `function` kullanılır (ok fonksiyonu DEĞİL) ki `new
    // WebSocket(...)` gibi constructor çağrıları da yakalanabilsin (`new (() => {})()` "not a
    // constructor" ile patlar; normal `function` hem düz çağrıda hem `new` ile atılan hatayı
    // aynı şekilde dışarı fırlatır).
    obj[key] = function () {
      calls.push(label)
      const err = new Error(`AĞ ÇİTİ İHLALİ (birincil katman): ${label} çağrıldı`)
      if (isAsync) return Promise.reject(err)
      throw err
    }
    restores.push(() => {
      obj[key] = original
    })
  }

  const netObj = net as unknown as Record<string, unknown>
  const socketProto = net.Socket.prototype as unknown as Record<string, unknown>
  const tlsObj = tls as unknown as Record<string, unknown>
  const httpObj = http as unknown as Record<string, unknown>
  const httpsObj = https as unknown as Record<string, unknown>
  const dgramObj = dgram as unknown as Record<string, unknown>
  const dnsObj = dns as unknown as Record<string, unknown>
  const dnsPromisesObj = dns.promises as unknown as Record<string, unknown>
  const globalObj = globalThis as unknown as Record<string, unknown>

  patch(netObj, 'connect', 'net.connect')
  patch(netObj, 'createConnection', 'net.createConnection')
  patch(socketProto, 'connect', 'net.Socket.prototype.connect')
  patch(tlsObj, 'connect', 'tls.connect')
  patch(httpObj, 'request', 'http.request')
  patch(httpObj, 'get', 'http.get')
  patch(httpsObj, 'request', 'https.request')
  patch(httpsObj, 'get', 'https.get')
  patch(dgramObj, 'createSocket', 'dgram.createSocket')
  patch(dnsObj, 'lookup', 'dns.lookup')
  patch(dnsObj, 'resolve', 'dns.resolve')
  patch(dnsPromisesObj, 'lookup', 'dns.promises.lookup', true)
  patch(dnsPromisesObj, 'resolve', 'dns.promises.resolve', true)
  patch(globalObj, 'fetch', 'fetch', true)
  // F-011 QA tur 5 (B1/B2) — `import`'suz global ağ API'leri (`new WebSocket(...)`) ve dolaylı
  // yetenek edinme yolları (`process.binding`/`process.dlopen`) da doğrudan kuşatılır; AST
  // katmanı bunları hiç göremez (bkz. `docs/qa/F-011-2026-09-10-tur5.md` §2.1/§2.2).
  patch(globalObj, 'WebSocket', 'WebSocket')
  const processObj = process as unknown as Record<string, unknown>
  patch(processObj, 'binding', 'process.binding')
  patch(processObj, 'dlopen', 'process.dlopen')

  return {
    calls,
    restore: () => {
      for (const r of restores) r()
    },
  }
}

describe('computeUsageReport — Y4 doğruluk', () => {
  it('ana oturum + subagent dosyalarının token toplamını proje/gün/oturum/agent bazında ELLE hesaplanan değerlerle eşleştirir', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)

    // Ana oturum dosyası — `session_id: "sess-1"`, agent: "ana oturum". İki assistant satırı.
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 10, output_tokens: 2 })}\n${assistantLine({ input_tokens: 5, output_tokens: 1, cache_creation_input_tokens: 3, cache_read_input_tokens: 7 })}\n`,
      '2026-09-04T10:00:00Z'
    )
    // ELLE HESAPLANAN ana oturum toplamı: input=15, output=3, cache_creation=3, cache_read=7.

    // Subagent dosyası — `sess-1/subagents/agent-a.jsonl` + meta.json {agentType:'developer'}.
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
      `${assistantLine({ input_tokens: 100, output_tokens: 40 })}\n`,
      '2026-09-04T11:00:00Z'
    )
    fs.writeFileSync(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.meta.json'),
      JSON.stringify({ agentType: 'developer' })
    )
    // ELLE HESAPLANAN agent-a toplamı: input=100, output=40.

    // İkinci subagent — meta.json YOK → "bilinmiyor".
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-b.jsonl'),
      `${assistantLine({ input_tokens: 9, output_tokens: 1 })}\n`,
      '2026-09-04T11:05:00Z'
    )
    // ELLE HESAPLANAN agent-b (bilinmiyor) toplamı: input=9, output=1.

    // "memory" gibi subagents/ TAŞIMAYAN bir alt dizin — sessizce atlanmalı (gerçek makinede
    // gözlenen desen, `docs/qa/F-011-contract.md`).
    fs.mkdirSync(path.join(projDir, 'memory'), { recursive: true })
    fs.writeFileSync(path.join(projDir, 'memory', 'not-a-transcript.json'), '{}')

    const report = computeUsageReport(claudeRoot, [
      { id: 'p1', label: 'mission-control', path: project },
    ])

    expect(report.source_unreadable).toBe(false)
    expect(report.projects).toHaveLength(1)
    const proj = report.projects[0]!
    expect(proj.project_id).toBe('p1')
    expect(proj.project_label).toBe('mission-control')

    // Toplam proje kullanımı = 15+100+9=124 giriş, 3+40+1=44 çıkış, 3 cache_creation, 7 cache_read.
    expect(proj.usage).toEqual({
      input_tokens: 124,
      output_tokens: 44,
      cache_creation_input_tokens: 3,
      cache_read_input_tokens: 7,
    })
    expect(report.usage).toEqual(proj.usage)

    // Hepsi aynı güne (mtime 2026-09-04) düşer.
    expect(proj.days).toHaveLength(1)
    const day = proj.days[0]!
    expect(day.day).toBe('2026-09-04')
    expect(day.usage).toEqual(proj.usage)

    // Tek oturum (sess-1), üç agent: "ana oturum", "developer", "bilinmiyor".
    expect(day.sessions).toHaveLength(1)
    const session = day.sessions[0]!
    expect(session.session_id).toBe('sess-1')
    const agentsByName = Object.fromEntries(session.agents.map((a) => [a.agent, a.usage]))
    expect(agentsByName['ana oturum']).toEqual({
      input_tokens: 15,
      output_tokens: 3,
      cache_creation_input_tokens: 3,
      cache_read_input_tokens: 7,
    })
    expect(agentsByName['developer']).toEqual({
      input_tokens: 100,
      output_tokens: 40,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
    expect(agentsByName['bilinmiyor']).toEqual({
      input_tokens: 9,
      output_tokens: 1,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })

    expect(report.lines_ok).toBe(4)
    expect(report.lines_bad).toBe(0)
    expect(report.degraded).toBe(false)
  })

  it('iki farklı mtime günü ayrı gün grubuna düşer', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)

    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-01T00:00:00Z'
    )
    writeWithMtime(
      path.join(projDir, 'sess-2.jsonl'),
      `${assistantLine({ input_tokens: 2, output_tokens: 2 })}\n`,
      '2026-09-02T00:00:00Z'
    )

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    const days = report.projects[0]!.days.map((d) => d.day)
    expect(days).toEqual(['2026-09-01', '2026-09-02'])
  })

  it('meta.json bozuksa (geçersiz JSON) agent "bilinmiyor" olur, çökmez', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    fs.writeFileSync(path.join(projDir, 'sess-1', 'subagents', 'agent-a.meta.json'), '{ bozuk')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    const session = report.projects[0]!.days[0]!.sessions[0]!
    expect(session.agents.map((a) => a.agent)).toEqual(['bilinmiyor'])
  })

  it('meta.json var ama agentType alanı yoksa/boşsa agent "bilinmiyor" olur (Y2, uydurma yok)', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    fs.writeFileSync(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.meta.json'),
      JSON.stringify({ description: 'meta var ama agentType yok' })
    )

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.projects[0]!.days[0]!.sessions[0]!.agents[0]!.agent).toBe('bilinmiyor')
  })
})

describe('computeUsageReport — yalnızca type:"assistant" satırları sayılır', () => {
  it('user/system gibi diğer tipler usage toplamına katılmaz (reused reader garantisi, uçtan uca kanıt)', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const lines = [
      assistantLine({ input_tokens: 10, output_tokens: 5 }),
      // "user" tipi, usage alanı taşısa bile SAYILMAMALI.
      JSON.stringify({
        type: 'user',
        message: { usage: { input_tokens: 999, output_tokens: 999 } },
      }),
      // "system" tipi de aynı şekilde sayılmamalı.
      JSON.stringify({
        type: 'system',
        message: { usage: { input_tokens: 999, output_tokens: 999 } },
      }),
    ].join('\n')
    writeWithMtime(path.join(projDir, 'sess-1.jsonl'), `${lines}\n`, '2026-09-04T00:00:00Z')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.usage).toEqual({
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
  })
})

describe('computeUsageReport — Y8: kaynak okunamazsa çökmez ("bulunamadı" ile "fırlattı" AYRI)', () => {
  it('claudeProjectsRoot bulunamadı (existsSync=false) → source_unreadable:true, boş rapor', () => {
    const missingRoot = path.join(tempDir(), 'hic-var-olmayan-alt-dizin')
    const report = computeUsageReport(missingRoot, [{ id: 'p1', label: 'p', path: tempDir() }])
    expect(report.source_unreadable).toBe(true)
    expect(report.projects).toEqual([])
    expect(report.usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
  })

  it('claudeProjectsRoot VAR ama listelenirken FIRLIYOR (ör. EPERM) → source_unreadable:true, çökmez', () => {
    const claudeRoot = tempDir()
    const originalReaddir = fs.readdirSync.bind(fs)
    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: fs.PathLike, options?: unknown) => {
      if (p === claudeRoot) {
        const err = new Error('EPERM: yapay') as NodeJS.ErrnoException
        err.code = 'EPERM'
        throw err
      }
      return (originalReaddir as (p: fs.PathLike, options?: unknown) => unknown)(p, options)
    }) as typeof fs.readdirSync)

    let report: ReturnType<typeof computeUsageReport> | undefined
    expect(() => {
      report = computeUsageReport(claudeRoot, [])
    }).not.toThrow()
    expect(report!.source_unreadable).toBe(true)
    expect(report!.projects).toEqual([])
  })

  it("tek bir dosyanın fs.statSync'i FIRLARSA (yarış durumu) yalnızca o dosya atlanır, rapor çökmez", () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const badFile = path.join(projDir, 'sess-bad.jsonl')
    const goodFile = path.join(projDir, 'sess-good.jsonl')
    writeWithMtime(
      badFile,
      `${assistantLine({ input_tokens: 111, output_tokens: 111 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    writeWithMtime(
      goodFile,
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const originalStat = fs.statSync.bind(fs)
    vi.spyOn(fs, 'statSync').mockImplementation((p: fs.PathLike) => {
      if (p === badFile) {
        const err = new Error('EPERM: yapay') as NodeJS.ErrnoException
        err.code = 'EPERM'
        throw err
      }
      return originalStat(p)
    })

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    // yalnızca `goodFile` sayılır — `badFile` sessizce atlanır, throw dışarı SIZMAZ.
    expect(report.usage.input_tokens).toBe(1)
  })
})

describe('computeUsageReport — Y5: tanınan satır oranı düşerse degraded:true', () => {
  it("bozuk satır oranı %1'i aşarsa degraded:true olur", () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    // 10 satır: 1 assistant + 8 iyi ayrıştırılan (user) + 1 bozuk JSON → lines_ok=9, lines_bad=1
    // → oran 9/10=0.9 < 0.99 → degraded:true.
    const goodLines = Array.from({ length: 8 }, () => JSON.stringify({ type: 'user' })).join('\n')
    const content = `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n${goodLines}\nBOZUK {{{\n`
    writeWithMtime(path.join(projDir, 'sess-1.jsonl'), content, '2026-09-04T00:00:00Z')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.lines_ok).toBe(9)
    expect(report.lines_bad).toBe(1)
    expect(report.degraded).toBe(true)
  })

  it('hiç bozuk satır yoksa degraded:false kalır', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.degraded).toBe(false)
  })
})

describe('computeUsageReport — Y3: ağ isteği yok', () => {
  it('fetch/http.request/https.request çağrılmadan gerçek fixture verisi doğru hesaplanır', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 7, output_tokens: 3 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Y3 İHLALİ: fetch çağrıldı')
    })
    const httpSpy = vi.spyOn(http, 'request').mockImplementation(() => {
      throw new Error('Y3 İHLALİ: http.request çağrıldı')
    })
    const httpsSpy = vi.spyOn(https, 'request').mockImplementation(() => {
      throw new Error('Y3 İHLALİ: https.request çağrıldı')
    })

    let report
    expect(() => {
      report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    }).not.toThrow()
    expect(report!.usage).toEqual({
      input_tokens: 7,
      output_tokens: 3,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(httpSpy).not.toHaveBeenCalled()
    expect(httpsSpy).not.toHaveBeenCalled()
  })

  // F-011 QA düzeltme turu 4 (AA1, BLOKLAYICI B1, BİRİNCİL DAVRANIŞ KATMANI) — bu testin önceki
  // sürümü "kendi rastgele portunu dinleyen sunucu" yaklaşımını kullanıyordu; QA bunun SADECE
  // kendi portuna gelen isteği görebildiğini, başka bir porta giden bir sızıntıyı (V5/V6/V7)
  // KAÇIRDIĞINI kanıtladı. Artık gerçek bağlantı kurma noktalarının (`net`/`tls`/`http`/`https`/
  // `dgram`/`dns` + `fetch`) KENDİSİ global olarak kuşatılıyor — bkz.
  // `installNetworkCapabilitySentinel` üstündeki yorum. Hedef host/port ve tetikleyen sözdizimi
  // (`.js` uzantılı import, `export … from`, dinamik `import()`, …) tamamen önemsiz: yalnızca
  // "gerçekten bir bağlantı girişimi oldu mu" ölçülüyor.
  it('GERÇEK computeUsageReport çalışırken net/tls/http/https/dgram/dns/fetch bağlantı noktalarından HİÇBİRİ çağrılmaz (AA1 tur 4, birincil davranış katmanı, global sonda)', async () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLine({ input_tokens: 7, output_tokens: 3 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    writeWithMtime(
      path.join(projDir, 'sess-1', 'subagents', 'agent-a.jsonl'),
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const sentinel = installNetworkCapabilitySentinel()
    let report: ReturnType<typeof computeUsageReport> | undefined
    try {
      report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
      // `computeUsageReport` kendisi senkron — olası gizli bir ASENKRON ağ çağrısının event
      // loop'a kuyruklanmış olma ihtimaline karşı bir tık beklenir.
      await new Promise((resolve) => setImmediate(resolve))
    } finally {
      sentinel.restore()
    }
    expect(sentinel.calls).toEqual([])
    expect(report!.usage.input_tokens).toBe(8)
  })

  // F-011 QA tur 5 (BLOKLAYICI B1) — sentinel'in KENDİ öz-testi yoktu: `patch()`'i no-op yapan
  // bir mutasyon 52/52 YEŞİL kalıyordu çünkü `calls` yalnızca yukarıdaki TEK negatif iddiada
  // kullanılıyordu. Bu test sentinel kuruluyken KASITLI çağrılar yaparak mekanizmanın gerçekten
  // çalıştığını kanıtlar: sentinel devre dışı bırakılırsa (ya da bu testin kendi assert'i
  // gevşetilirse) bu test KIRMIZI verir.
  it('sentinelin öz-testi: kasıtlı net.connect/http.get/WebSocket/process.binding/fetch çağrıları `calls` içinde yakalanır ve KIRMIZI verir (F-011 QA tur5 B1/B2)', async () => {
    const sentinel = installNetworkCapabilitySentinel()
    try {
      expect(() => net.connect(80, '127.0.0.1')).toThrow(/AĞ ÇİTİ İHLALİ/)
      expect(() => http.get('http://127.0.0.1:1')).toThrow(/AĞ ÇİTİ İHLALİ/)
      // Ok fonksiyonu DEĞİL, `new` ile çağrılabilen bir yapıcı bekleniyor (bkz. `patch()`).
      expect(() => new WebSocket('ws://127.0.0.1:1')).toThrow(/AĞ ÇİTİ İHLALİ/)
      const qaProc = process as unknown as { binding: (name: string) => unknown }
      expect(() => qaProc.binding('tcp_wrap')).toThrow(/AĞ ÇİTİ İHLALİ/)
      await expect(globalThis.fetch('http://127.0.0.1:1')).rejects.toThrow(/AĞ ÇİTİ İHLALİ/)

      expect(sentinel.calls).toEqual(
        expect.arrayContaining(['net.connect', 'http.get', 'WebSocket', 'process.binding', 'fetch'])
      )
    } finally {
      sentinel.restore()
    }
  })
})

describe('computeUsageReport — AC7/B6: 64 MB+ dosyada 32 MB kuyruk okuma davranışı devralınır', () => {
  // F-011 sözleşmesi §3 B6 — W1/Y1 gereği İKİNCİ bir kuyruk-okuma testi İCAT EDİLMEZ
  // (`transcript-reader.ts`'in KENDİ testi F-009'da bu mekanizmayı zaten kanıtlıyor). Bu test
  // yalnızca `computeUsageReport`'un `readAllowedTranscript`'i GERÇEK varsayılan eşiklerle
  // (64 MiB/32 MiB, hiçbir seçenek geçirilmeden) çağırdığını, yani DAVRANIŞI DEVRALDIĞINI uçtan
  // uca kanıtlar: dosyanın başındaki (kırpılan bölgedeki) bir "zehir" usage değeri sayılmamalı,
  // yalnızca son satırdaki (kuyruktaki) gerçek değer sayılmalı.
  it('dosya başındaki zehir usage değeri (kırpılan bölge) sayılmaz, yalnızca kuyruktaki gerçek satır sayılır', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const filePath = path.join(projDir, 'sess-big.jsonl')
    fs.mkdirSync(projDir, { recursive: true })

    const poison = `${assistantLine({ input_tokens: 999_999, output_tokens: 999_999 })}\n`
    const filler = `${JSON.stringify({ type: 'user', pad: 'a'.repeat(500) })}\n`
    const real = `${assistantLine({ input_tokens: 5, output_tokens: 2 })}\n`
    // Gerçek `DEFAULT_MAX_BYTES_BEFORE_TAIL` (64 MiB) eşiğini kesin aşacak toplam boyut —
    // dosya başındaki zehir, `DEFAULT_TAIL_BYTES` (32 MiB) kuyruğun ÇOK dışında kalır.
    const targetBytes = 68 * 1024 * 1024
    const fillerBytesNeeded = targetBytes - Buffer.byteLength(poison) - Buffer.byteLength(real)
    const fillerCount = Math.ceil(fillerBytesNeeded / Buffer.byteLength(filler))
    const content = poison + filler.repeat(fillerCount) + real
    fs.writeFileSync(filePath, content)
    const t = new Date('2026-09-04T00:00:00Z')
    fs.utimesSync(filePath, t, t)

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    // Zehir (999999) sayılsaydı toplam 1.000.004 olurdu — kuyruk kırpması gerçekten devralındı.
    expect(report.usage.input_tokens).toBe(5)
    expect(report.usage.output_tokens).toBe(2)
    // F-011 QA düzeltme turu (Z4/Ö3) — kırpma SESSİZ değil: `truncated_file_count` > 0 ve
    // `degraded:true` (eskiden satır sınırı bulunduğu için ikisi de sessizce `false`/`0` kalıyordu,
    // QA gerçek 70 MB'lık bir dosyada verinin %54,4'ünün sessizce düştüğünü ölçtü).
    expect(report.truncated_file_count).toBe(1)
    expect(report.degraded).toBe(true)
  })
})

describe('computeUsageReport — Z4/Ö1: format değişimi (tüm satırlar tanınmaz) sessizce 0 gösterMEZ', () => {
  it('tüm satırlar tanınmayan bir type taşırsa (ör. format yeniden adlandırılmış) lines_bad=0 olsa bile degraded:true olur, unknown_type_lines dolu döner', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    // "assistant" → "assistant_message" (gerçek bir format yeniden adlandırma senaryosunun
    // simülasyonu, QA'nın canlı sandbox'ta bizzat ürettiği senaryo).
    const lines = Array.from({ length: 8 }, () =>
      JSON.stringify({ type: 'assistant_message', message: { usage: { input_tokens: 1 } } })
    ).join('\n')
    writeWithMtime(path.join(projDir, 'sess-1.jsonl'), `${lines}\n`, '2026-09-04T00:00:00Z')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.lines_ok).toBe(8)
    expect(report.lines_bad).toBe(0)
    expect(report.unknown_type_lines).toBe(8)
    expect(report.degraded).toBe(true)
    expect(report.usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
  })
})

// F-011 QA düzeltme turu 2 (AA3, BLOKLAYICI) — QA gerçek üretim verisinde (57.795 satır) ölçtü:
// normal transkriptlerin %33,8'i reader'ın "tanınan" kümesinin (user/assistant/system/summary)
// DIŞINDA ama BİLİNEN VE NORMAL tiplerdir (`attachment`, `queue-operation`, …,
// `docs/wiki/pages/desen/claude-transcript-formati.md`) — eski %99 eşiği bu yüzden gerçek veride
// HER ZAMAN tetikleniyordu (doğruluğu kanıtlanmış bir rakamın yanında kalıcı yanlış alarm).
describe('computeUsageReport — AA3 (F-011 QA düzeltme turu 2): gerçek tip dağılımı yanlış alarm ÜRETMEZ', () => {
  it('gerçek üretim dağılımını taşıyan bir dosyada (assistant %41 + user %24 + system %1 tanınan, %34 bilinen-normal-ama-tanınmayan diğer tipler) degraded:false kalır', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    // Oranlar QA'nın gerçek taramasıyla (assistant 41,2% / user 24,3% / system 0,7% / diğer 33,8%)
    // tutarlı, 100 satıra ölçeklenmiş bir temsilci karışım — hangi "diğer" tipin kullanıldığı
    // usage-aggregator için önemsiz (`unknown_type_lines` hepsini aynı sayar), tek bir temsilci
    // tip (`attachment`) yeterli.
    const assistantLines = Array.from({ length: 41 }, () =>
      assistantLine({ input_tokens: 1, output_tokens: 1 })
    ).join('\n')
    const userLines = Array.from({ length: 24 }, () =>
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'x' } })
    ).join('\n')
    const systemLine = JSON.stringify({ type: 'system', subtype: 'stop_hook_summary' })
    const otherLines = Array.from({ length: 34 }, () =>
      JSON.stringify({ type: 'attachment' })
    ).join('\n')
    const content = `${assistantLines}\n${userLines}\n${systemLine}\n${otherLines}\n`
    writeWithMtime(path.join(projDir, 'sess-1.jsonl'), content, '2026-09-04T00:00:00Z')

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.lines_ok).toBe(100)
    expect(report.lines_bad).toBe(0)
    expect(report.unknown_type_lines).toBe(34)
    expect(report.usage.input_tokens).toBe(41)
    // AA3'ün asıl iddiası: gerçek dağılım YANLIŞ ALARM üretmez.
    expect(report.degraded).toBe(false)
  })

  it('%50 eşiğinin AŞIRI gevşek OLMADIĞININ kanıtı: tanınan oran tam sınırın altına (< %50) düşerse hâlâ degraded:true olur', () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    // 100 satır: yalnızca 40 tanınan (assistant), 60 tanınmayan → oran 0,40 < 0,5 eşiği.
    const assistantLines = Array.from({ length: 40 }, () =>
      assistantLine({ input_tokens: 1 })
    ).join('\n')
    const otherLines = Array.from({ length: 60 }, () =>
      JSON.stringify({ type: 'attachment' })
    ).join('\n')
    writeWithMtime(
      path.join(projDir, 'sess-1.jsonl'),
      `${assistantLines}\n${otherLines}\n`,
      '2026-09-04T00:00:00Z'
    )

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.unknown_type_lines).toBe(60)
    expect(report.degraded).toBe(true)
  })
})

describe('computeUsageReport — Z4/Ö2: guard sonrası GERÇEKTEN okunamayan dosya sessizce düşmez', () => {
  it("bir dosyanın fs.readFileSync'i FIRLARSA (ör. EPERM, guard geçtikten sonra) unreadable_file_count artar, degraded:true olur, yalnızca o dosya toplamdan düşer", () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const badFile = path.join(projDir, 'sess-bad.jsonl')
    const goodFile = path.join(projDir, 'sess-good.jsonl')
    writeWithMtime(
      badFile,
      `${assistantLine({ input_tokens: 111, output_tokens: 111 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    writeWithMtime(
      goodFile,
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const originalReadFileSync = fs.readFileSync.bind(fs)
    vi.spyOn(fs, 'readFileSync').mockImplementation(((
      p: Parameters<typeof fs.readFileSync>[0],
      opts?: Parameters<typeof fs.readFileSync>[1]
    ) => {
      if (p === badFile) {
        const err = new Error('EPERM: yapay') as NodeJS.ErrnoException
        err.code = 'EPERM'
        throw err
      }
      return (originalReadFileSync as (...args: unknown[]) => unknown)(p, opts)
    }) as typeof fs.readFileSync)

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.unreadable_file_count).toBe(1)
    expect(report.degraded).toBe(true)
    // yalnızca `goodFile` sayılır — `badFile` toplamdan sessizce düşmez, sayaca yansır.
    expect(report.usage.input_tokens).toBe(1)
  })
})

// F-011 QA düzeltme turu 2 (AA2, BLOKLAYICI) — 1. turun Ö2 düzeltmesi yalnızca `readFileSync`'in
// fırlamasını kapsıyordu; QA gerçek `icacls /deny "(RA,RD,RX)"` ile guard'ın KENDİSİNİN
// (`resolveAllowedTranscriptPath`'in sarılmamış `fs.realpathSync.native`'i) EPERM fırlattığını,
// bunun ise usage-aggregator'ın best-effort `catch`'i tarafından sessizce yutulduğunu (175→10
// token, %94 kayıp, uyarı YOK) kanıtladı. Bu blok o iki katmanı (mock + gerçek ACL) ayrı ayrı
// kanıtlar ve "yarış durumu hâlâ sessiz kalıyor mu" regresyon çitini korur.
describe('computeUsageReport — AA2 (F-011 QA düzeltme turu 2): guard katmanının KALICI erişim reddi artık sessizce yutulmuyor', () => {
  it("guard'ın fs.realpathSync.native çağrısı EPERM fırlatırsa (QA'nın gerçek icacls repro'sunun kod-yolu eşdeğeri) unreadable_file_count artar, degraded:true olur, yalnızca o dosya toplamdan düşer", () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const deniedFile = path.join(projDir, 'sess-denied.jsonl')
    const goodFile = path.join(projDir, 'sess-good.jsonl')
    writeWithMtime(
      deniedFile,
      `${assistantLine({ input_tokens: 999, output_tokens: 999 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    writeWithMtime(
      goodFile,
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const originalRealpathNative = fs.realpathSync.native
    vi.spyOn(fs.realpathSync, 'native').mockImplementation(((p: fs.PathLike) => {
      if (path.resolve(p.toString()) === path.resolve(deniedFile)) {
        const err = new Error('EPERM: yapay (guard realpath)') as NodeJS.ErrnoException
        err.code = 'EPERM'
        throw err
      }
      return originalRealpathNative(p as fs.PathOrFileDescriptor as fs.PathLike)
    }) as typeof fs.realpathSync.native)

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.unreadable_file_count).toBe(1)
    expect(report.degraded).toBe(true)
    // yalnızca `deniedFile` toplamdan düşer — `goodFile` sessizce kaybolmaz (sessiz kısmi kayıp yok).
    expect(report.usage.input_tokens).toBe(1)
    expect(report.usage.output_tokens).toBe(1)
  })

  it("guard katmanında GERÇEK bir yarış durumu (lstatSync ENOENT — dosya listelendikten SONRA silindi) hâlâ sessizce atlanır, sayılmaz (regresyon çiti — EPERM/EACCES/EBUSY dışındaki hatalar 'gerçek erişim reddi' SAYILMAMALI)", () => {
    const claudeRoot = tempDir()
    const project = tempDir()
    const encoded = encodeProjectDirName(project)
    const projDir = path.join(claudeRoot, encoded)
    const raceFile = path.join(projDir, 'sess-race.jsonl')
    const goodFile = path.join(projDir, 'sess-good.jsonl')
    writeWithMtime(
      raceFile,
      `${assistantLine({ input_tokens: 999, output_tokens: 999 })}\n`,
      '2026-09-04T00:00:00Z'
    )
    writeWithMtime(
      goodFile,
      `${assistantLine({ input_tokens: 1, output_tokens: 1 })}\n`,
      '2026-09-04T00:00:00Z'
    )

    const originalLstatSync = fs.lstatSync.bind(fs)
    vi.spyOn(fs, 'lstatSync').mockImplementation(((
      p: Parameters<typeof fs.lstatSync>[0],
      opts?: Parameters<typeof fs.lstatSync>[1]
    ) => {
      if (path.resolve(p.toString()) === path.resolve(raceFile)) {
        const err = new Error('ENOENT: yapay (yarış durumu)') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      }
      return (originalLstatSync as (...args: unknown[]) => unknown)(p, opts)
    }) as typeof fs.lstatSync)

    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    // yarış durumu unreadable_file_count'a SAYILMAZ — yalnızca goodFile sayılır, degraded bu
    // yüzden false kalır (goodFile'ın kendisi bozuk değil).
    expect(report.unreadable_file_count).toBe(0)
    expect(report.degraded).toBe(false)
    expect(report.usage.input_tokens).toBe(1)
  })

  it.skipIf(process.platform !== 'win32')(
    'GERÇEK Windows ACL reddiyle (icacls /deny "(RA,RD,RX)") birebir tekrar üretilir — QA\'nın sandbox repro\'sunun aynısı, mock değil',
    () => {
      const claudeRoot = tempDir()
      const project = tempDir()
      const encoded = encodeProjectDirName(project)
      const projDir = path.join(claudeRoot, encoded)
      const deniedFile = path.join(projDir, 'sess-real-denied.jsonl')
      writeWithMtime(
        deniedFile,
        `${assistantLine({ input_tokens: 150, output_tokens: 0 })}\n`,
        '2026-09-04T00:00:00Z'
      )

      const username = os.userInfo().username
      execFileSync('icacls', [deniedFile, '/deny', `${username}:(RA,RD,RX)`], { stdio: 'pipe' })
      try {
        const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
        expect(report.unreadable_file_count).toBe(1)
        expect(report.degraded).toBe(true)
        expect(report.usage.input_tokens).toBe(0)
      } finally {
        // ACL'i geri al — aksi halde `afterEach`'in `removeTempDataDir`'i dosyayı silemeyebilir.
        execFileSync('icacls', [deniedFile, '/reset'], { stdio: 'pipe' })
      }
    }
  )
})

describe('computeUsageReport — boş/izlenmeyen durumlar', () => {
  it('hiç transkript bulunamayan proje `projects` dizisinde YER ALMAZ', () => {
    const claudeRoot = tempDir()
    const project = tempDir() // claudeRoot altında hiçbir karşılığı yok
    const report = computeUsageReport(claudeRoot, [{ id: 'p1', label: 'p', path: project }])
    expect(report.projects).toEqual([])
    expect(report.source_unreadable).toBe(false)
  })

  it('izlenen proje listesi boşsa boş rapor döner, çökmez', () => {
    const claudeRoot = tempDir()
    const report = computeUsageReport(claudeRoot, [])
    expect(report.projects).toEqual([])
  })
})
