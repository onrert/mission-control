import crypto from 'node:crypto'
import { createServer } from '../../../src/server/index'
import { createFakeQueryFactory, type FakeQueryHandle } from '../../helpers/fake-chat-query'

/**
 * F-012 F6 — QA'nın "Ö5 erteleme öncülü yanlış" bulgusuna yanıt (`docs/qa/
 * F-012-2026-09-06-tur2.md` §3): sohbet ekranı için gerçek tarayıcı E2E'si, ürün kodunda ZATEN
 * var olan `createServer(port, dataDir, chatQueryOverride)` enjeksiyon dikişiyle, GERÇEK,
 * ÜCRETLİ bir SDK oturumu AÇMADAN. `tests/helpers/fake-chat-query.ts`'in (chat-api.test.ts'in
 * kullandığı) AYNI `FakeQueryHandle`'ı kullanılır — burada tek fark, bir vitest süreci içinde
 * `handle.emit(...)`'i testin kendisinin çağırması yerine, bu BAĞIMSIZ Node sürecinin
 * (Playwright `webServer`) senaryoyu kendi kendine oynatmasıdır (gerçek tarayıcı gerçek
 * HTTP/SSE üzerinden konuşur, sahte olan yalnızca "model").
 *
 * Senaryo (tek tur, `chat.spec.ts`'in kapsadığı akış: mesaj gönder → akan cevap → izin kartı →
 * karar): kullanıcı mesajı gelince önce birkaç kelimelik akan metin, sonra bir `Bash` `tool_use`
 * (gerçek SDK'nın izin motoru session.ts'in KENDİ `canUseTool`'unu tetikler — bu betik SADECE
 * `options.canUseTool(...)`'u çağırır, session.ts'in gerçek permission/SSE/history mantığı
 * DEĞİŞMEDEN çalışır), sonra karara göre `tool_result`, sonra kısa bir kapanış cümlesi, sonra
 * `result`. Kota: **0** — hiçbir gerçek `@anthropic-ai/claude-agent-sdk` çağrısı yapılmaz.
 */
const port = Number(process.env.PORT ?? '7333')
const dataDir = process.env.MC_DATA_DIR

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function streamWords(handle: FakeQueryHandle, text: string): Promise<void> {
  const words = text.split(' ')
  for (const word of words) {
    handle.emit({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: `${word} ` } },
    })
    await sleep(80)
  }
}

async function driveTurn(handle: FakeQueryHandle): Promise<void> {
  await streamWords(handle, 'Elbette, hemen klasörü kontrol ediyorum.')

  const toolUseId = `toolu_${crypto.randomUUID()}`
  handle.emit({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: toolUseId,
          name: 'Bash',
          input: { command: 'ls -la', description: 'Klasörü listele' },
        },
      ],
    },
    parent_tool_use_id: null,
  })

  const requestId = `req_${crypto.randomUUID()}`
  const decision = (await handle.options.canUseTool!(
    'Bash',
    { command: 'ls -la', description: 'Klasörü listele' },
    { requestId, toolUseID: toolUseId, signal: new AbortController().signal }
  )) as { behavior?: string }
  const allowed = decision.behavior === 'allow'

  handle.emit({
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          is_error: !allowed,
          content: allowed ? 'chat-fake-server.ts\nsession.ts' : 'Kullanıcı reddetti',
        },
      ],
    },
    parent_tool_use_id: null,
  })

  await streamWords(
    handle,
    allowed ? 'Klasörde iki dosya buldum, hazır.' : 'Anladım, komutu çalıştırmadım.'
  )
  handle.emit({ type: 'result', subtype: 'success', is_error: false })
}

async function main(): Promise<void> {
  const { queryFn, getHandles } = createFakeQueryFactory()
  const server = createServer(port, dataDir, queryFn)
  server.once('listening', () => {
    process.stdout.write(`[chat-fake-server] 127.0.0.1:${port} adresinde dinliyor (kota: 0).\n`)
  })

  // I2 (CEO kararı) — `bootstrap()` artık `query()`'yi TEMBEL çağırır: alt süreç yalnızca
  // tarayıcıdan gerçek bir sohbet mesajı gönderildiğinde (ilk `sendMessage()`) spawn edilir.
  // Bu yüzden bekleme, eski "birkaç mikro görev turu" bütçesinden çok daha uzun olmalı —
  // Playwright'ın kendi test zaman aşımının güvenle altında (30 sn, 20 ms aralıkla).
  let handle: FakeQueryHandle | undefined
  for (let i = 0; i < 1500 && !handle; i++) {
    handle = getHandles()[0]
    if (!handle) await sleep(20)
  }
  if (!handle) {
    process.stderr.write('[chat-fake-server] queryFn hiç çağrılmadı (bootstrap başarısız?)\n')
    return
  }

  for await (const userMessage of handle.prompt) {
    if (process.env.MC_E2E_CHAT_DEBUG) {
      process.stderr.write(`[chat-fake-server] kullanıcı mesajı: ${JSON.stringify(userMessage)}\n`)
    }
    await driveTurn(handle)
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`[chat-fake-server] beklenmeyen hata: ${String(err)}\n`)
  process.exit(1)
})
