// F-012 — GÜVENLİK ÖNLEMİ (Karpathy §2'nin ötesinde, KRİTİK): `src/server/index.ts` her
// `createServer()` çağrısında (test dahil) barındırılan CEO oturumunu başlatmayı DENER —
// varsayılan `MC_CHAT_ENABLED` açıktır (sözleşme §3, D11/K6). Bu depodaki `createServer(0,
// dataDir)` çağıran ONLARCA mevcut entegrasyon testi (`events-api`, `features-api`,
// `projects-api`, `sse-stream`, `health`, `adr-013-write-header`, `timeline.spec.ts`) chat'i hiç
// bilmiyor ve gerçek `@anthropic-ai/claude-agent-sdk` `query()`'sini enjekte ETMİYOR — bu yüzden
// varsayılan açık kalırsa `npm test` HER ÇALIŞTIRILDIĞINDA gerçek, ÜCRETLİ bir Claude oturumu
// açardı (CLAUDE.md üst düzey kural: "ücret/kredi" her zaman kullanıcı onayı ister — sessiz bir
// test suite bunu asla tetiklememeli).
//
// Bu dosya `vitest.config.ts`'in `setupFiles`'ı üzerinden HER test dosyasından ÖNCE bir kez
// çalışır ve yalnızca `MC_CHAT_ENABLED` ZATEN tanımlı DEĞİLSE `'0'`a sabitler — sohbeti gerçekten
// test etmek isteyen dosyalar (`tests/features/chat/**`, `tests/integration/chat-api.test.ts`)
// kendi `beforeAll`/`beforeEach`'inde `process.env.MC_CHAT_ENABLED = '1'` yaparak açıkça devre
// dışı bırakabilir — bu, aynı worker/dosya içinde çalışır (vitest her test dosyasını ayrı bir
// worker'da izole eder), diğer dosyalara sızmaz.
if (process.env.MC_CHAT_ENABLED === undefined) {
  process.env.MC_CHAT_ENABLED = '0'
}
