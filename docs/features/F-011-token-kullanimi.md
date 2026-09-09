---
id: F-011
title: Token kullanımı ekranı (proje / gün / oturum / agent grupları)
status: qa
owner: developer
deps: [F-009]
sprint: 2
---
## Açıklama
Yerel transkriptlerden token tüketimini toplar ve gösterir. Kendi minimal okuyucumuz kullanılır (G2'de onaylandı); ccusage yalnızca elle çapraz kontrol için README'de önerilir.
Kaynak: PRD özellik 6; `docs/03-ux.md` ekran 6; ADR-007 karar 3.

## Kabul kriterleri
- [x] Yalnızca `type: "assistant"` satırları okunur; `message.usage.*` alanları (input, output, cache_creation, cache_read) toplanır. Konuşma yeniden kurulmaz.
- [x] Rakamlar proje, gün, oturum ve agent bazında gruplanabilir; agent bilgisi `subagents/*.meta.json` içindeki `agentType`'tan gelir (PRD F6/AC1, AC3).
- [x] Kaynak okunamadığında ekran "veri yok / okunamadı" gösterir; panel çökmez, diğer ekranlar etkilenmez (PRD F6/AC2).
- [x] Tanınan satır oranı düştüğünde "veri eksik olabilir" uyarısı gösterilir (ADR-007 risk azaltımı).
- [x] Hesaplama tamamen yereldir; hiçbir ağ isteği atılmaz (PRD F6/AC4).
- [x] README'de `ccusage` ile elle çapraz kontrol yöntemi anlatılır.
- [x] 64 MB üzeri transkript dosyalarında yalnızca son 32 MB okunur ve bu davranış testlidir.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/usage/**`, ilgili testler, `README.md` (çapraz kontrol bölümü).

## Notlar / kararlar
- G0.ok'taki "hazır kaynak öncelikli" daralmasından bilinçli sapma; G2'de kullanıcı onayladı.
- QA düzeltme turu 2 (`docs/qa/F-011-2026-09-10-tur2.md`, KALDI → AA1-AA4 + nit düzeltildi,
  `docs/qa/F-011-contract.md` §5). Bu turda CEO kararıyla dosya sahipliği geçici olarak
  `docs/03-ux.md` ve `src/web/App.tsx`'e (asgari dokunuş) genişletildi.
- QA düzeltme turu 3 (`docs/qa/F-011-2026-09-10-tur3.md`, KALDI → tek madde B1/AA1 düzeltildi,
  `docs/qa/F-011-contract.md` §7). Yalnızca `tests/features/usage/server/
  network-capability-guard.test.ts` değişti; ürün koduna dokunulmadı.
- QA düzeltme turu 4 (`docs/qa/F-011-2026-09-10-tur4.md`, KALDI → B1 birincil davranış katmanı
  eklendi, `installNetworkCapabilitySentinel` ile `net`/`tls`/`http`/`https`/`dgram`/`dns`/`fetch`
  global kuşatıldı). Yalnızca `usage-aggregator.test.ts` + `network-capability-guard.test.ts`
  değişti; ürün koduna dokunulmadı.
- QA düzeltme turu 5 (`docs/qa/F-011-2026-09-10-tur5.md`, KALDI → BB1/BB2 düzeltildi,
  `docs/qa/F-011-contract.md` "Ek — tur 5 → tur 6" bölümü): sentinel'in kendi öz-testi (pozitif
  kontrol) eklendi, `process.binding`/`process.dlopen`/`WebSocket` de sentinel'e dahil edildi,
  `network-capability-guard.test.ts`'e N2b (yazılabilir cast biçiminin statik tarayıcıda
  yakalanmadığını belgeleyen kalıcı negatif kontrol) eklendi. Yine yalnızca iki test dosyası
  değişti; ürün koduna dokunulmadı. Yanlış pozitif (yorumda "fetch()" yazmak) ve M5 (giriş
  uzantı listesi kapsaması) bilinçli olarak bu turda kapatılmadı — bkz. `docs/blockers.md`.
