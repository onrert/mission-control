---
id: F-003
title: SSE akışı + canlı zaman çizelgesi ekranı + filtreler
status: qa
owner: developer
deps: [F-002]
sprint: 1
---
## Açıklama
Olaylar SSE ile tarayıcıya canlı akar; zaman çizelgesi ekranı olayları gösterir, tip/proje/agent filtreleri ile duraklat/otomatik kaydırma davranışı sunar.
Kaynak: `docs/02-architecture.md` §6 (SSE), ADR-004; `docs/03-ux.md` ekran 1 + "Bilgi yoğunluğu ve gürültü yönetimi".

## Kabul kriterleri
- [x] POST edilen olay en geç 2 saniye içinde, sayfa yenilenmeden zaman çizelgesinde görünür (PRD F1/AC2).
  Kanıt: `tests/integration/sse-stream.test.ts` "POST sonrası event çerçevesi 2000 ms içinde gelir";
  `tests/e2e/timeline.spec.ts` AC1 (gerçek tarayıcı, gerçek SSE).
- [x] Her satır şunları gösterir: zaman damgası, proje adı, agent tipi/id, araç adı, özet (PRD F1/AC3).
  Kanıt: `tests/features/events/web/TimelineRow.test.tsx`; `tests/e2e/timeline.spec.ts` AC2.
- [x] TÜM olay tipleri gösterilir; filtre yalnızca görünümü etkiler, kaydı etkilemez (PRD F1/AC9).
  Kanıt: `tests/features/events/web/TimelineScreen.test.tsx` AC3/AC9 + mutasyon 5 kanıtı
  (`docs/qa/F-003-contract.md` §"Mutasyon kanıtı"); `tests/web/lib/useEventStream.test.ts`
  "sahte fetch'in filtre parametresi hiç geçmediği" (CEO kararı F — kayıt sunucu tarafında
  filtrelenmiyor).
- [x] Tip, proje ve agent filtreleri çoklu seçilebilir; proje filtresi PRD F1/AC7'yi karşılar.
  Kanıt: `tests/features/events/web/TimelineScreen.test.tsx` AC4; `tests/e2e/timeline.spec.ts` AC4.
- [x] SSE bağlantısı koptuğunda panel "bağlantı koptu" durumunu gösterir, otomatik yeniden bağlanır ve `Last-Event-ID` ile kaçırılan olayları telafi eder.
  Kanıt: `tests/web/lib/useEventStream.test.ts` 3 durum geçişi + mutasyon 14 kanıtı;
  `tests/integration/sse-stream.test.ts` resync/telafi testleri + mutasyon 2/7/8/9 kanıtı;
  `tests/e2e/timeline.spec.ts` AC5 (gerçek süreç kill/restart, gerçek tarayıcı `EventSource`).
- [x] Duraklat açıkken yeni olaylar listeyi kaydırmaz; duraklat kapatılınca birikenler görünür.
  Kanıt: `tests/web/lib/useEventStream.test.ts` + mutasyon 4 kanıtı; `tests/e2e/timeline.spec.ts` AC6.

Tüm 14 mutasyon kanıtı: `docs/qa/F-003-contract.md` sonundaki "## Mutasyon kanıtı" bölümü.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/server/sse/**`, `src/features/events/web/**`, `src/web/lib/useEventStream.ts`, ilgili testler.

## Notlar / kararlar
- Yeniden bağlanma ve telafi davranışı ADR-004'te tanımlı.

## CEO'dan devralınan taahhüt (F-001 sözleşmesi satır 735, 549)
- F-003 sözleşmesi **gerçek DOM test altyapısı** (`jsdom` + `@testing-library/react`) için bir ADR taslağıyla açılmak zorundadır. F-001/F-002 yalnızca `renderToStaticMarkup` ile test ediyor; ilk etkileşimli ekran burada geliyor.

## F-002'den taşınan not (QA doğrulama turu 2, 2026-09-04)
- **N-1 (hayalet olay):** Depolama arızasında `503 storage_unavailable` dönen olay ring buffer'da kalıyor ve `GET /api/events` onu döndürüyor — diskte karşılığı yokken (`{"seq":0,...,"next_seq":1}`). Veri kaybı değil, yeniden başlatmada kendiliğinden kayboluyor; ama **SSE akışı bu olayı istemciye yayımlarsa zaman çizelgesinde kalıcı hayalet satır oluşur.** F-003 ring'e yazma ile diske yazmanın başarı koşulunu hizalamak zorunda.
