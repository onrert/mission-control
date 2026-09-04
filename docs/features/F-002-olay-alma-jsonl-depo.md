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

## F-001'den taşınan borçlar (bu feature kapsamına alındı — CEO, 2026-09-04)
- **N1 — tema testi kök bileşene kör.** `tests/e2e/shell.spec.ts:69-77` yalnızca `document.body` zeminini `--color-zinc-950` token'ıyla karşılaştırıyor. F-002 ile panel yüzeyleri gelince bu yetmez: assert kök uygulama kabına (`#root` / ana layout kabı) ve en az bir panel yüzeyine genişletilecek, kontrast eşiği korunacak.
- **N4 — dev sunucusu port çakışmasında yabancı sürece proxy'liyor.** Sunucu EADDRINUSE'ta `exit(1)` yapıyor (`src/server/index.ts:119-126`) ama `dev:server` = `tsx watch` bu exit'i yutuyor ve `concurrently` `--kill-others` olmadığı için Vite ayakta kalıyor; `/api` istekleri 7333'teki yabancı sürece gidiyor. F-002 bunu iki katmanda kapatacak: (a) `npm run dev` port doluysa tümüyle ve gürültülü şekilde ölecek, (b) `/api/health` bir örnek kimliği döndürecek ve dev istemcisi/E2E yanlış sunucuya bağlandığını tespit edecek.

## Kapsam sınırı (CEO kararı — sadelik)
- F-002 kapsamı: `POST /api/events`, JSONL depo, seq yönetimi, açılışta ring yükleme, retention, **minimum `GET /api/events`** (yalnızca `since_seq` + `limit`).
- Kapsam DIŞI: SSE (`/api/stream`) → F-003. Tam filtre seti (`type`, `agent`, `q`, `project_id`) → ilgili tüketici feature'ı. Yazma kapısı → F-006.
- Ek kapsam (ADR-008 karar 1): **Host/Origin koruması** F-002'de yazılır — F-001 sözleşmesi satır 39-41'deki taahhüdün koşulu (ilk yazma ucu) gerçekleşti.
- Ek kapsam DIŞI (ADR-008 karar 2): 50 MB gün dosyası rotasyonu (`.1.jsonl`) ertelendi.
- `data/` dizininin ilk kez oluşturulması F-002'nin işidir (F-001 sözleşmesi R10).
