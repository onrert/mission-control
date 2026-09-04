---
id: F-004
title: send-event.cjs hook scripti + kurulum scripti + hook smoke testleri
status: qa
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
- [ ] Kurulum sonrası gerçek bir Claude Code oturumunda en az bir olayın panele düştüğü elle doğrulanır ve `KURULUM.md`'ye yazılır. **(AC5 — kullanıcı adımı, bu turda yapılmadı; bkz. KURULUM.md "Doğrulama".)**
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
