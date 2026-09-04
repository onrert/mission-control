# QA — latest

KARAR: SÖZLEŞME ONAY (F-001, tur 3)
ESKALE: false
Tarih: 2026-09-04 · Tur: sözleşme denetimi tur 3 (kod yok, uygulama çalıştırılmadı)

- **Y1 kapandı:** AC3'ün dev kanıtı ayrı `playwright.dev.config.ts` + `npm run e2e:dev` ile veriliyor; `webServer` her iki dosyada da üst düzeyde (typecheck kırılmaz), prod `webServer` dev configde hiç yok → iki webServer aynı koşuda asla başlamaz, tur 2'nin "prod sunucusu dev testini yanlış yeşil yapar" senaryosu elendi. **Y2 kapandı:** `document.fonts.ready` + `document.fonts.check('16px "Departure Mono"')` woff2 404/eksikken `false` döner (yüz `error` durumuna düşer; fallback font sonucu kurtarmaz) ve `theme.test.ts`'in `@font-face` statik kontrolüyle birlikte deliksiz. **Y3/Y4/Y5 ve B3/B8/B13 de kapandı**; regresyon yok, hiçbir assert gevşetilmemiş (net +1 assert, +1 koşu).
- **Kod turunda ZORUNLU (F-001'in GEÇTİ kararı bunlara bağlı):** K1 — dev e2e koşusu `env: { MC_PORT: '7433', MC_WEB_PORT: '7434' }` ile yalıtılsın; aksi hâlde 7333'te yabancı/yetim bir sunucu varken `dev:server` EADDRINUSE ile ölse bile 3.–4. assert'ler o yabancı süreci ölçüp yeşil verebilir. K2 — guard kapsamına `svg` eklensin (`favicon.svg` servis edilen işaretlemedir, S1 orada kör kalıyor). K3 — §8'in "qa-evaluator tarafından onaylanmıştır" cümlesi sözleşme gövdesinden çıkarılsın (QA kararı denetim bölümünde yaşar).
- **Kod turu başlayabilir.** Bloklamayan, kod turunda ampirik doğrulanacaklar: `use.baseURL` hiçbir configde yazılı değil (ilk koşu kırmızı verir), Vitest varsayılan `include`'u Playwright `*.spec.ts`'lerini toplar (`vitest.config.ts` sınırlansın), font assert'i için tek seferlik negatif kontrol, Vite'ın hash'lediği woff2'lerin prod'da 200 dönmesi + tur 2'nin 6 maddesi. F-001'in GEÇTİ kararı ayrıca kullanıcı onaylı push sonrası 3 OS'lik CI matrisinin yeşiline bağlıdır.

Ayrıntı: `docs/qa/F-001-contract.md` §"QA sözleşme denetimi — tur 3 — 2026-09-04".
