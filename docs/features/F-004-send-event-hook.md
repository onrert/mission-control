---
id: F-004
title: send-event.js hook scripti + kurulum scripti + hook smoke testleri
status: todo
owner: developer
deps: [F-002]
sprint: 1
---
## Açıklama
İzlenen projelere kurulacak, bağımlılıksız `send-event.js` hook scripti ve onu `.claude/settings.json`'a ekleyen kurulum scripti. Script hiçbir koşulda oturumu bloklamaz veya çökertmez.
Kaynak: `docs/02-architecture.md` §8, ADR-006.

## Kabul kriterleri
- [ ] `send-event.js` stdin'den hook JSON'unu okur, alanları çıkarır ve `POST /events`'e gönderir; `transcript_path` alanı da gönderilir (Faz 2 bunu kullanacak).
- [ ] Sunucu kapalıyken script hata basmaz, oturumu bloklamaz, kısa timeout ile sessizce çıkar (çıkış kodu 0).
- [ ] Bilinmeyen/eksik alanda çökmez; bilinmeyen alanlar ham olarak iletilir.
- [ ] `npm run install-hook -- <proje-yolu>` hedef projeye scripti kopyalar ve `.claude/settings.json` hook satırlarını ekler; mevcut ayarları bozmaz, iki kez çalıştırılınca çift kayıt oluşturmaz.
- [ ] Kurulum sonrası gerçek bir Claude Code oturumunda en az bir olayın panele düştüğü elle doğrulanır ve `KURULUM.md`'ye yazılır.
- [ ] Smoke test: sahte hook payload'ı ile script çalıştırılır, olayın sunucuya ulaştığı otomatik doğrulanır.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`.claude/hooks/send-event.js`, `scripts/install-hook.mjs`, `tests/helpers/emit-hook.ts`, `KURULUM.md`.

## Notlar / kararlar
- Taşıma biçimi `command` + `async` (ADR-006); `type:"http"` kullanılmayacak.
