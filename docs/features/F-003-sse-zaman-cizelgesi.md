---
id: F-003
title: SSE akışı + canlı zaman çizelgesi ekranı + filtreler
status: todo
owner: developer
deps: [F-002]
sprint: 1
---
## Açıklama
Olaylar SSE ile tarayıcıya canlı akar; zaman çizelgesi ekranı olayları gösterir, tip/proje/agent filtreleri ile duraklat/otomatik kaydırma davranışı sunar.
Kaynak: `docs/02-architecture.md` §6 (SSE), ADR-004; `docs/03-ux.md` ekran 1 + "Bilgi yoğunluğu ve gürültü yönetimi".

## Kabul kriterleri
- [ ] POST edilen olay en geç 2 saniye içinde, sayfa yenilenmeden zaman çizelgesinde görünür (PRD F1/AC2).
- [ ] Her satır şunları gösterir: zaman damgası, proje adı, agent tipi/id, araç adı, özet (PRD F1/AC3).
- [ ] TÜM olay tipleri gösterilir; filtre yalnızca görünümü etkiler, kaydı etkilemez (PRD F1/AC9).
- [ ] Tip, proje ve agent filtreleri çoklu seçilebilir; proje filtresi PRD F1/AC7'yi karşılar.
- [ ] SSE bağlantısı koptuğunda panel "bağlantı koptu" durumunu gösterir, otomatik yeniden bağlanır ve `Last-Event-ID` ile kaçırılan olayları telafi eder.
- [ ] Duraklat açıkken yeni olaylar listeyi kaydırmaz; duraklat kapatılınca birikenler görünür.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/server/sse/**`, `src/features/events/web/**`, `src/web/lib/useEventStream.ts`, ilgili testler.

## Notlar / kararlar
- Yeniden bağlanma ve telafi davranışı ADR-004'te tanımlı.
