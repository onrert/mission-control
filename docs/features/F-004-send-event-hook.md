---
id: F-004
title: send-event.cjs hook scripti + kurulum scripti + hook smoke testleri
status: done
owner: developer
deps: [F-002]
sprint: 1
---
## Açıklama
İzlenen projelere kurulacak, bağımlılıksız `send-event.cjs` hook scripti ve onu `.claude/settings.json`'a ekleyen kurulum scripti. Script hiçbir koşulda oturumu bloklamaz veya çökertmez.
Kaynak: `docs/02-architecture.md` §8, ADR-006.

## Kabul kriterleri
- [x] `send-event.js` stdin'den hook JSON'unu okur, alanları çıkarır ve `POST /api/events`'e gönderir; `transcript_path` alanı da gönderilir (Faz 2 bunu kullanacak).
- [x] Sunucu kapalıyken script hata basmaz, oturumu bloklamaz, kısa timeout ile sessizce çıkar (çıkış kodu 0).
- [x] Bilinmeyen/eksik alanda çökmez; bilinmeyen alanlar ham olarak iletilir.
- [x] `npm run install-hook -- <proje-yolu>` hedef projeye scripti kopyalar ve `.claude/settings.json` hook satırlarını ekler; mevcut ayarları bozmaz, iki kez çalıştırılınca çift kayıt oluşturmaz.
- [x] Kurulum sonrası gerçek bir Claude Code oturumunda en az bir olayın panele düştüğü elle doğrulanır ve `KURULUM.md`'ye yazılır. **(AC5 — kullanıcı 2026-09-05'te `npm run install-hook -- .` çalıştırdı; CEO doğruladı, kanıt aşağıda.)**
- [x] Smoke test: sahte hook payload'ı ile script çalıştırılır, olayın sunucuya ulaştığı otomatik doğrulanır.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`.claude/hooks/send-event.cjs`, `scripts/install-hook.mjs`, `tests/helpers/emit-hook.ts`, `KURULUM.md`.
Genişletme (gerekçeli, sözleşme §1/§2.2): `tests/integration/send-event-hook.test.ts`,
`tests/scripts/install-hook.test.ts`, `tests/no-external-host.test.ts`, `.gitignore`.

## Notlar / kararlar
- Taşıma biçimi `command` + `async` (ADR-006); `type:"http"` kullanılmayacak.

## CEO kararları (2026-09-04, sözleşme turu 1)
- **Uç nokta `/api/events`** (yukarida düzeltildi). Feature notundaki eski `POST /events` yazımı
  koda ve mimariye aykırıydı (`src/server/index.ts:251`).
- **Dosya uzantısı `.cjs`** — düz `.js` YASAK. İzlenen projenin `package.json`'inda
  `"type": "module"` varsa `.js` ESM sayılır, `require` patlar ve script **sessizce ölür**;
  panel hiç olay almaz, kimse fark etmez. Bu depoda bugun tam olarak bu yaşandı (commit `9ae23bf`).
- **`no-external-host` çiti F-004 kapsamındadır.** Developer "sahiplik disi" diye bırakmıştı;
  hayir: ağdan konuşan scripti ekleyen feature, o scripti çitin içine almak zorundadır. Guard
  `.claude/hooks/**/*.cjs` ve kurulum şablonunu da taramalı. Bu, developer'in kendi bildirdiği
  "en büyük risk" maddesini kapatır.
- **Kurulum scripti dışarı yazar.** `--dry-run` varsayılan KAPALI kalabilir (AC4 gercek yazma
  istiyor), çünkü koruma katmanlari yeterli: ilk çalıştırmada yedek, yalnızca ekleme, dedupe,
  bozuk JSON'da hiç yazmama. **Ancak:** hiçbir agent bu scripti bu deponun dışındaki bir yola
  karşı CEO/kullanıcı onayı olmadan çalıştıramaz. Gerçek projelere kurulum kullanıcı adımıdır.

## AC5 doğrulama kanıtı (CEO, 2026-09-05)
Kullanıcı kurulumu kendi terminalinde yaptı. CEO doğruladı:
- `.claude/hooks/send-event.cjs` yerinde (8246 bayt); `.claude/settings.json` 13 hook olay tipine
  genişletilmiş, **6 orijinal güvenlik hook'unun altısı da yerinde** (session-start, gate-check,
  block-dangerous, asset-guard, post-format, stop-check), JSON geçerli, `settings.json.bak` yedeği alınmış.
- Panel açıldı, gerçek oturumda araç çağrıları yapıldı → olaylar **canlı düştü**: dosya 4 satırdan
  9 satıra çıktı, `GET /api/events` yeni olayları döndürdü.
- Örnek gerçek olay: `hook_event_name: PreToolUse` · `tool_name: Bash` ·
  `session_id: b13e8d3f-…` (bu oturumun gerçek kimliği) · `project_name: mission-control` ·
  **`transcript_path` dolu** (Faz 2 bunu kullanacak) · `client_version: 1` · `flags: []`.
- `.seq` = 4 → kayma yok (F-002'nin Ö1 düzeltmesi gerçek kullanımda da tutuyor).

**Uçtan uca hat çalışıyor:** hook → `send-event.cjs` → `POST /api/events` → normalize → JSONL.
