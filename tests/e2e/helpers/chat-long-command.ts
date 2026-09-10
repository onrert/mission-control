/**
 * G5 Tur 4 (4-Ek3, `docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md`) düzeltmesi — denetimin
 * kendi reproduce ettiği sondayı gerçek tarayıcıda birebir tekrarlamak için sabitler. Kasıtlı
 * olarak `chat-fake-server.ts`'ten AYRI bir dosyada: o dosyanın alt satırı koşulsuz `main()`
 * çağırır (bir Playwright test süreci, `test.ts` içinde `chat-fake-server.ts`'i import ederse
 * ikinci bir sunucu spawn etmeye çalışır) — yalnızca sabit taşıyan, YAN ETKİSİZ bir modül hem
 * `chat-fake-server.ts` hem `chat.spec.ts` tarafından güvenle import edilebilir.
 */
export const LONG_COMMAND_TRIGGER = 'UZUN-KOMUT-TESTI'
export const LONG_COMMAND_TAIL = 'GIZLI-KOMUT-SONU-ISARETI-4EK3'
export const LONG_COMMAND = `${'#'.repeat(560)} ${LONG_COMMAND_TAIL}`
