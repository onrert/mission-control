---
id: F-002
title: Olay alma uç noktası + JSONL depo + retention
status: qa
owner: developer
deps: [F-001]
sprint: 1
---
## Açıklama
`POST /events` uç noktası hook olaylarını alır, normalize eder ve `data/events/YYYY-MM-DD.jsonl` dosyasına append-only yazar. Ham payload korunur; bilinmeyen/eksik alan olayı düşürmez. Retention: 30 gün veya 20.000 olay (gün dosyası silinerek).
Kaynak: `docs/02-architecture.md` §5 (veri modeli), §6.1 (API), ADR-003.

## Kabul kriterleri
- [x] Geçerli olay POST edildiğinde 2xx döner ve satır JSONL dosyasına yazılır.
- [x] Eksik/bilinmeyen alanlı olay POST edildiğinde 5xx DÖNMEZ; olay "eksik alan" işaretiyle kaydedilir (PRD F1/AC5).
- [x] Ham payload `raw` alanında saklanır; şema değişikliği veri kaybına yol açmaz.
- [x] 50 olay/dakika hızındaki yük testinde olayların en az %99'u sırayla kaydedilir (PRD F1/AC4).
- [x] Sunucu yeniden başlatıldığında son en az 100 olay depodan geri yüklenir (PRD F1/AC6).
- [x] Retention sınırı aşıldığında yalnızca panelin kendi gün dosyaları silinir; izlenen projelerin hiçbir dosyasına dokunulmaz.
- [x] Eşzamanlı POST'larda satır bozulması olmadığı testle gösterilir.
- [x] (Ek — ADR-008 karar 1) Host/Origin koruması: loopback dışı `Host` veya cross-origin `Origin` `403 forbidden_origin` ile reddedilir.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/events/server/**`, `src/server/store/**`, `src/shared/types.ts`, ilgili testler.

## Notlar / kararlar
- Hook'lar dosyaya değil HTTP'ye yazar; deponun tek yazarı sunucudur (ADR-003).
- Mimari §6.6'nın health şemasında geçen `events_total`/`ring_from`/`ring_to`/`projects`/
  `watchers`/`degraded` alanları bu feature'da **eklenmedi** — hiçbir AC bunu istemiyor ve
  `ring_from` asıl SSE `hello` olayının (F-003) tüketicisi. F-002 yalnızca kendi AC'lerinin
  gerektirdiği `instance_id`/`service`/`corrupt_lines`'ı ekledi. F-003 gerektiğinde ekleyecek.

## F-001'den taşınan borçlar (bu feature kapsamına alındı — CEO, 2026-09-04)
- **N1 — tema testi kök bileşene kör. KAPANDI (kısmen).** `tests/e2e/shell.spec.ts` artık
  `#root > div` (App'in kök kabı) zeminini de `--color-zinc-950` token'ıyla ölçüyor (mutasyonla
  kanıtlandı — App.tsx kök sınıfı bilerek bozulup test kırmızı verdiği görüldü, sonra geri
  alındı). **Panel-yüzeyi yarısı F-003'e devredildi:** F-002'de yeni bir panel/timeline yüzeyi
  yok; F-003 gerçek bir yüzey getirdiğinde üçüncü bir ölçüm noktası eklenecek.
- **N4 — dev sunucusu port çakışmasında yabancı sürece proxy'liyor. KAPANDI.**
  `scripts/check-ports.mjs` artık `predev` olarak çalışıyor; `MC_PORT`/`MC_WEB_PORT` doluysa
  `concurrently`/`tsx`/Vite hiç başlamadan gürültülü Türkçe hatayla `exit(1)` veriyor (gerçek
  bir sahte dinleyiciyle elle doğrulandı — bkz. `docs/progress.md`). `/api/health` artık
  `instance_id` + `service` döndürüyor; `tests/e2e/dev-shell.spec.ts` proxy'li ve doğrudan
  yanıtların `instance_id` **eşitliğini** doğruluyor (alan varlığı değil).

## Kapsam sınırı (CEO kararı — sadelik)
- F-002 kapsamı: `POST /api/events`, JSONL depo, seq yönetimi, açılışta ring yükleme, retention, **minimum `GET /api/events`** (yalnızca `since_seq` + `limit`).
- Kapsam DIŞI: SSE (`/api/stream`) → F-003. Tam filtre seti (`type`, `agent`, `q`, `project_id`) → ilgili tüketici feature'ı. Yazma kapısı → F-006.
- Ek kapsam (ADR-008 karar 1): **Host/Origin koruması** F-002'de yazılır — F-001 sözleşmesi satır 39-41'deki taahhüdün koşulu (ilk yazma ucu) gerçekleşti.
- Ek kapsam DIŞI (ADR-008 karar 2): 50 MB gün dosyası rotasyonu (`.1.jsonl`) ertelendi.
- `data/` dizininin ilk kez oluşturulması F-002'nin işidir (F-001 sözleşmesi R10).
