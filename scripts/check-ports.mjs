#!/usr/bin/env node
// N4 katman (a) — `npm run dev`'in `predev` adımı. `MC_PORT`/`MC_WEB_PORT` doluysa hiçbir alt
// süreç (concurrently/tsx/Vite) başlamadan gürültülü, Türkçe bir hatayla `exit(1)` verir.
// Bu script bilerek `src/server/index.ts`'in `resolvePort`'undan ayrı, kendi kopyasını taşır
// (bkz. `docs/qa/F-002-contract.md` kod turu notu N2) — .mjs olduğu için TS import edemez.
import net from 'node:net'

function resolvePortLike(raw, defaultPort) {
  if (raw === undefined) return defaultPort
  const trimmed = raw.trim()
  const parsed = Number(trimmed)
  if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    return defaultPort
  }
  return parsed
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => resolve(false))
    tester.once('listening', () => {
      tester.close(() => resolve(true))
    })
    tester.listen(port, '127.0.0.1')
  })
}

async function main() {
  const apiPort = resolvePortLike(process.env.MC_PORT, 7333)
  const webPort = resolvePortLike(process.env.MC_WEB_PORT, 7334)

  const [apiFree, webFree] = await Promise.all([isPortFree(apiPort), isPortFree(webPort)])

  const busy = []
  if (!apiFree) busy.push(apiPort)
  if (!webFree) busy.push(webPort)

  if (busy.length > 0) {
    process.stderr.write(
      `Hata: ${busy.join(', ')} portu/portları zaten kullanımda. 'npm run dev' başlatılamıyor.\n` +
        'Önce o portu tutan süreci kapatın veya MC_PORT/MC_WEB_PORT ile farklı port seçin.\n'
    )
    process.exitCode = 1
    return
  }
}

main()
