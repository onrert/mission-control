---
id: F-001
title: İskelet — repo, TS, Vite/React/Tailwind kabuğu, node:http sunucusu, test altyapısı, CI
status: done
owner: developer
deps: []
sprint: 1
---
## Açıklama
Projenin çalışan iskeleti. Boş ama uçtan uca doğrulanabilir bir kabuk: `npm install` → `npm run dev` → tarayıcıda koyu temalı boş panel açılır, `/api/health` cevap verir, `npm run verify` (typecheck + lint + test + build) yeşil geçer, CI aynı komutu koşar. Hiçbir ürün özelliği bu feature'da yapılmaz.

Kaynaklar: `docs/02-architecture.md` §3 (stack), §4 (klasör yapısı), §11 (test stratejisi), §12 (çalıştırma komutları); `docs/03-ux.md` "Ortak kabuk" ve "Tasarım dili" bölümleri.

## Kabul kriterleri
- [ ] `git init` yapılmış, ilk commit atılmış; `.gitignore` en az `node_modules/`, `dist/`, `data/` içeriyor.
- [ ] `npm install` Windows'ta ve macOS'ta native derleme olmadan tamamlanır (better-sqlite3 veya node-gyp gerektiren bağımlılık YOK).
- [ ] `npm run dev` tek komutla hem Vite hem API sunucusunu ayağa kaldırır; panel tarayıcıda açılır ve beyaz ekran vermez.
- [ ] Sunucu `MC_PORT` ortam değişkenini okur, varsayılan 7333'tür ve yalnızca 127.0.0.1 arabirimine bağlanır (başka bir makineden bağlantı kurulamaz — test edilebilir).
- [ ] `GET /api/health` 200 ve JSON döner; F-001'in döndüreceği alan kümesi: `{ ok, version, port, node, uptime_s }` (mimari §6.6 ile aynı adlandırma; zarf dışında, düz JSON).
- [ ] Vitest kurulu; en az 1 sunucu birim testi ve 1 web bileşen testi geçiyor.
- [ ] Playwright kurulu; "panel açılıyor, başlık görünüyor, konsol hatası yok" E2E testi geçiyor.
- [ ] `npm run verify` = typecheck + lint + test + build; tek komutla yeşil.
- [ ] `.github/workflows/ci.yml` push'ta `npm ci && npm run verify` koşar.
- [ ] Koyu tema, tipografi ve renk token'ları `docs/03-ux.md` tasarım diline uygun şekilde girilmiş; boş kabuk (üst sekme çubuğu + içerik alanı) görünüyor. Faz 2 sekmeleri YOK.
- [ ] **Fontlar self-host** (CEO kararı 2026-09-04): Departure Mono + IBM Plex Mono + IBM Plex Sans woff2 olarak `src/web/fonts/` altında, `@font-face` ile bağlı; `--font-display`, `--font-mono`, `--font-sans` token'ları tanımlı. Hiçbir CDN/dış hostname yok. Lisans notu README'de (her ikisi de OFL).
- [ ] `tests/no-external-host.test.ts` guard'ı geçiyor: `src/**` ve `index.html` içinde `127.0.0.1`/`localhost` dışında `http(s)://` literali veya CDN dizgesi yok.
- [ ] README'de kurulum ve çalıştırma adımları var (Windows + macOS).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint`/`prettier` yapılandırmaları, `.gitignore`, `.github/workflows/ci.yml`, `src/server/index.ts`, `src/web/**` (boş kabuk), `tests/**` (iskelet testleri), `README.md`, `tailwind.config.ts`.

## Notlar / kararlar
- Sunucu çerçevesi yok: çıplak `node:http` + küçük router (ADR-002, §3.2).
- Yol işlemlerinde elle regex yasak; `node:path` API'si kullanılacak (Windows ters bölü tuzağı — `docs/02-architecture.md` §1).
- `data/` klasörü repo içinde ve gitignore'lu (G2 kullanıcı kararı 3).

## CEO kararları (2026-09-04, QA sözleşme denetimi sonrası)
- **R1:** `npm run verify` = `typecheck && lint && test && build`. `e2e` dahil değil. Mimari §12 buna göre düzeltildi.
- **B6a:** Health yanıtı `{ ok, version, port, node, uptime_s }` — `uptime` değil `uptime_s`.
- **B13:** Fontlar **self-host** edilecek (CDN yasak; PRD F6/AC4 "hiçbir ağ isteği" ve mimari S1 sınırı). Developer font dosyalarını indirmekte tıkanırsa DUR ve CEO'ya bildir — sistem mono yığınına düşme kararını CEO verir.
- **B2/B10/R4 (CI):** Kullanıcı GitHub'da **private repo + gerçek CI matris koşusu** istiyor (ubuntu/windows/macos). Push kullanıcı onayına bağlıdır ve F-001'in QA turundan ÖNCE alınacaktır; developer kendi başına push ETMEZ, remote EKLEMEZ.
- **Push kararı (kullanıcı, 2026-09-04): ŞİMDİLİK PUSH YOK.** Depo yerel kalıyor; GitHub private repo açılmadı. Sonuç: AC2'nin macOS/Linux ayağı ve AC9'un "CI gerçekten koşuyor" ayağı bu turda KANITLANAMAZ. F-001 en fazla "koşullu GEÇTİ" alabilir; bu iki kriter açık borç olarak `docs/progress.md`'ye yazılır ve push yapıldığı gün kapatılır. qa-evaluator bu iki kriter için KALDI vermeyecek, "ertelendi (kullanıcı kararı)" işaretleyecek.
- **QA kararı (düzeltme turu 1, 2026-09-04): KOŞULLU GEÇTİ** — kapsamdaki 11 kriterin 11'i geçti; AC2'nin macOS/Linux ayağı ve AC9'un gerçek CI koşusu kullanıcı kararıyla ERTELENDİ ve açık borç olarak `docs/progress.md`'ye yazılacak. Ayrıntı: `docs/qa/F-001.md` son bölüm.
