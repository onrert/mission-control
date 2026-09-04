---
id: F-002
title: Olay alma uç noktası + JSONL depo + retention
status: todo
owner: developer
deps: [F-001]
sprint: 1
---
## Açıklama
`POST /events` uç noktası hook olaylarını alır, normalize eder ve `data/events/YYYY-MM-DD.jsonl` dosyasına append-only yazar. Ham payload korunur; bilinmeyen/eksik alan olayı düşürmez. Retention: 30 gün veya 20.000 olay (gün dosyası silinerek).
Kaynak: `docs/02-architecture.md` §5 (veri modeli), §6.1 (API), ADR-003.

## Kabul kriterleri
- [ ] Geçerli olay POST edildiğinde 2xx döner ve satır JSONL dosyasına yazılır.
- [ ] Eksik/bilinmeyen alanlı olay POST edildiğinde 5xx DÖNMEZ; olay "eksik alan" işaretiyle kaydedilir (PRD F1/AC5).
- [ ] Ham payload `raw` alanında saklanır; şema değişikliği veri kaybına yol açmaz.
- [ ] 50 olay/dakika hızındaki yük testinde olayların en az %99'u sırayla kaydedilir (PRD F1/AC4).
- [ ] Sunucu yeniden başlatıldığında son en az 100 olay depodan geri yüklenir (PRD F1/AC6).
- [ ] Retention sınırı aşıldığında yalnızca panelin kendi gün dosyaları silinir; izlenen projelerin hiçbir dosyasına dokunulmaz.
- [ ] Eşzamanlı POST'larda satır bozulması olmadığı testle gösterilir.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/events/server/**`, `src/server/store/**`, `src/shared/types.ts`, ilgili testler.

## Notlar / kararlar
- Hook'lar dosyaya değil HTTP'ye yazar; deponun tek yazarı sunucudur (ADR-003).
