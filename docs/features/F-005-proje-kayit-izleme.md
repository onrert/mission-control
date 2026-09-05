---
id: F-005
title: Proje kayıt defteri + chokidar izleme + Ayarlar ekranı (çok projeli izleme)
status: qa
owner: developer
deps: [F-003]
sprint: 1
---
## Açıklama
İzlenen proje klasörlerinin panelden eklenip çıkarılması, kalıcı kayıt defteri ve chokidar ile canlı dosya izleme.
Kaynak: `docs/02-architecture.md` §5 (proje kaydı), §6 (API); `docs/03-ux.md` ekran 3.

## Kabul kriterleri
- [x] Klasör eklendiğinde `docs/features/*.md` dosyaları, sunucu yeniden başlatılmadan en geç 5 sn içinde görünür (PRD F3/AC1). **Not:** Kanban henüz yok (F-007); bu feature'ın payı `features` SSE sinyalinin (`{project_id}`) event-driven, debounce dahil ~150-300 ms içinde üretildiğinin kanıtlanmasıdır (`tests/server/watch/debounce.test.ts`, `tests/server/watch/project-watcher.test.ts`, `tests/integration/projects-api.test.ts`). "Kanbanda görünür" ifadesinin tam görsel doğrulaması `docs/qa/F-005-contract.md` §9 madde 7 ile F-007'ye devredildi.
- [x] Proje çıkarıldığında kartları ve olayları 5 sn içinde arayüzden kalkar; diskte hiçbir dosya silinmez veya değişmez (PRD F3/AC2). Kanıt: `tests/integration/projects-api.test.ts` dosya sistemi manifest testi (öncesi/sonrası sha256/boyut birebir, silinen=0, eklenen⊆test aktörünün yazdığı) + `tests/e2e/settings.spec.ts`.
- [x] Geçmiş olaylar depoda kalır; proje geri eklenirse yeniden görünür (ADR-001 karar 6). Kanıt: F-005 `data/events/**`'e hiç dokunmuyor (manifest testiyle negatif kanıt), kayıt defteri kaldırma sonrası olayları silmiyor.
- [x] `docs/features` içermeyen geçersiz yol reddedilir ve okunabilir hata gösterilir (PRD F3/AC3). Kanıt: `tests/features/projects/server/validate-path.test.ts` (~20 vaka) + `tests/integration/projects-api.test.ts` + `tests/e2e/settings.spec.ts` satır içi hata.
- [x] En az 3 proje aynı anda izlenirken kartlar ve olaylar proje etiketiyle ayırt edilir (PRD F3/AC4). Kanıt: `tests/integration/projects-api.test.ts` AC4 izolasyon testi (3 proje, yalnızca değişenin `project_id`'si sinyal üretiyor) + `tests/e2e/settings.spec.ts` 3 satır.
- [x] İzlenen proje listesi kalıcıdır; sunucu yeniden başlatılınca korunur (PRD F3/AC5). Kanıt: `tests/integration/projects-api.test.ts` — aynı `MC_DATA_DIR`'e karşı ikinci `createServer()` kayıtları korur ve otomatik yeniden izlemeye başlar.

Mutasyon kanıtı ve chokidar ölçümleri: `docs/qa/F-005-contract.md` "Mutasyon kanıtı (kod turu,
2026-09-05)" bölümü. Mimari karar kaydı: `docs/decisions/ADR-012-proje-izleme-mekanizmasi.md`.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/projects/**`, `src/server/watch/**`, `src/server/store/projects-registry.ts`, ilgili
testler.

Ayrıca (paylaşılan, sözleşme §2.2'de gerekçeli — QA düzeltme turu 1 NOT-2c/D24 kapanışı):
`src/shared/types.ts`, `src/server/index.ts`, `src/web/App.tsx`, `src/web/index.css`,
`src/web/lib/useEventStream.ts`, `package.json`, `playwright.config.ts`,
`tests/e2e/shell.spec.ts`, `tests/web/App.test.tsx`, `tests/web/App.interaction.test.tsx`,
`tests/build-css.test.ts`.

## Notlar / kararlar
- Yol karşılaştırmaları `node:path` ile yapılır; yol için elle regex yasak.
- Düzeltme turu 1 (2026-09-05): QA'nın KALDI kararındaki 1 BLOKLAYICI + 4 ÖNEMLİ bulgusu kapatıldı
  (registry yazma hatasında süreç ölmüyor artık, iki katmanlı hata sınırı, izleyici sayacı
  kaldırma çiti, no-delete-guard yazma taraması, dar genişlikte Ayarlar dişlisi, manifest boş
  dizin çiti). Detay: `docs/qa/F-005-2026-09-05.md` (KALDI raporu) + `docs/progress.md`.
