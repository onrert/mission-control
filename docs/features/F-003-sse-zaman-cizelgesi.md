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
- [x] SSE bağlantısı koptuğunda panel bağlantı durumunu gösterir, otomatik yeniden bağlanır ve `Last-Event-ID` ile kaçırılan olayları telafi eder.
  QA düzeltme turu 1 (D15) semantiği netleştirdi: **geçici kopma** (ör. `ECONNREFUSED`) → panel
  "Yeniden bağlanıyor" gösterir (WHATWG `readyState` süresiz `CONNECTING` kalır, hiç `CLOSED`'a
  düşmez); **kalıcı başarısızlık** ("fail the connection" — ilk yanıt 2xx değil/yanlış
  `Content-Type`) → panel "Bağlantı koptu" gösterir ve bir daha denemez. İkisi de ayrı ayrı,
  gerçek tarayıcıda kanıtlanıyor.
  Kanıt: `tests/web/lib/useEventStream.test.ts` 3 durum geçişi + mutasyon 14 kanıtı;
  `tests/integration/sse-stream.test.ts` resync/telafi testleri + mutasyon 2/7/8/9 kanıtı;
  `tests/e2e/timeline.spec.ts` "AC5 - bağlantı kopması ve toparlanma" (gerçek süreç kill/restart,
  gerçek tarayıcı `EventSource`, geçici kopma yolu + kesinti sırasında üretilen bir olayın
  `Last-Event-ID` replay'i ile yapısal olarak geldiğinin kanıtı) ve ayrı
  "AC5 (kalıcı hata) - fail the connection ⇒ Bağlantı koptu" (gerçek tarayıcı ağ katmanında
  kontrollü 2xx-dışı yanıt, kalıcı durumun ulaşılabilirliğinin kanıtı).
- [x] Duraklat açıkken yeni olaylar listeyi kaydırmaz; duraklat kapatılınca birikenler görünür.
  Kaydırma ile oto-dondurma yarısı (liste yukarı kaydırılınca dondurma) QA düzeltme turu 1'de
  (D11+D12) düzeltildi: üretim CSS'inde `src/features/events/web/**` sınıfları hiç
  üretilmiyordu (`overflow-y-auto` dahil), bu yüzden liste hiç kaydırılamıyordu.
  Kanıt: `tests/web/lib/useEventStream.test.ts` + mutasyon 4 kanıtı (duraklat yarısı);
  `tests/e2e/timeline.spec.ts` AC6 (duraklat) + AC6 (kaydırma) — ikincisi gerçek `mouse.wheel`/
  `scrollTop` ile ölçüyor, mutasyon kanıtı `docs/progress.md` F-003 düzeltme turu 1 girişinde.

Tüm 14 mutasyon kanıtı: `docs/qa/F-003-contract.md` sonundaki "## Mutasyon kanıtı" bölümü.
QA düzeltme turu 1'in D11-D15 + NOT-1 mutasyon kanıtları: `docs/progress.md` F-003 düzeltme
turu 1 girişi.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/server/sse/**`, `src/features/events/web/**`, `src/web/lib/useEventStream.ts`, ilgili testler.

## Notlar / kararlar
- Yeniden bağlanma ve telafi davranışı ADR-004'te tanımlı.
- QA düzeltme turu 1 (2026-09-05): görsel doğrulama ekran görüntüsü
  `docs/qa/screens/F-003-fix1-2026-09-05.png` — gerçek sunucu + gerçek olaylarla, filtre
  çipleri/sütunlar/rozet düzgün ayrık, `sr-only` canlı bölge ekranda görünmüyor.

## CEO'dan devralınan taahhüt (F-001 sözleşmesi satır 735, 549)
- F-003 sözleşmesi **gerçek DOM test altyapısı** (`jsdom` + `@testing-library/react`) için bir ADR taslağıyla açılmak zorundadır. F-001/F-002 yalnızca `renderToStaticMarkup` ile test ediyor; ilk etkileşimli ekran burada geliyor.

## F-002'den taşınan not (QA doğrulama turu 2, 2026-09-04)
- **N-1 (hayalet olay):** Depolama arızasında `503 storage_unavailable` dönen olay ring buffer'da kalıyor ve `GET /api/events` onu döndürüyor — diskte karşılığı yokken (`{"seq":0,...,"next_seq":1}`). Veri kaybı değil, yeniden başlatmada kendiliğinden kayboluyor; ama **SSE akışı bu olayı istemciye yayımlarsa zaman çizelgesinde kalıcı hayalet satır oluşur.** F-003 ring'e yazma ile diske yazmanın başarı koşulunu hizalamak zorunda.
