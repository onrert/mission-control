---
feature: F-001
title: İskelet — repo, TS, Vite/React/Tailwind kabuğu, node:http sunucusu, test altyapısı, CI
author: developer
status: approved
date: 2026-09-04
---

# F-001 Sözleşmesi — İskelet

Bu belge, kod yazılmadan önce "ne yapılacağı + nasıl doğrulanacağı" sözleşmesidir
(`docs/PROCESS.md` §5). qa-evaluator bu belgeyi inceleyip onaylar/düzeltir; anlaşınca kod
başlar. Kaynaklar: `docs/features/F-001-iskelet.md`, `docs/02-architecture.md` (§3, §4, §11,
§12), `docs/03-ux.md` ("Ortak kabuk", "Tasarım dili"), `docs/approvals/G2.ok`.

---

## 1. Kapsam

**Bu feature'da yapılacak:** Boş ama uçtan uca çalışan bir proje iskeleti. `git` deposu,
TypeScript + Vite + React + Tailwind web kabuğu, çıplak `node:http` API sunucusu (yalnızca
`/api/health`), Vitest + Playwright test altyapısı, ESLint/Prettier, GitHub Actions CI,
`npm run verify` tek komutu, README kurulum adımları.

**Bu feature'da KESİNLİKLE yapılmayacak** (ürün özelliği yok):
- Olay alma/JSONL depo (`POST /api/events`, `GET /api/events`) — F-002.
- SSE akışı, zaman çizelgesi ekranı — F-003.
- `send-event.js` hook scripti, `install-hook` — F-004.
- Proje kayıt defteri, chokidar dosya izleme, Ayarlar ekranı — F-005.
- Yazma kapısı (`write-gate.ts`) — F-006.
- Kanban panosu, sürükle-bırak, frontmatter yazımı — F-007.
- Kapılar paneli, Thread, Token Kullanımı ekranları (Faz 2) — F-008/F-009/F-010/F-011.
- `chokidar`, `yaml`, `@dnd-kit/core` paketleri bu feature'da **kurulmayacak** — kapalı
  bağımlılık listesinde (§3.4) onaylı olsalar da henüz kullanılmıyorlar; ilk ihtiyaç
  duyulduğu feature'da (F-002/F-005/F-007) eklenecekler. Kullanılmayan bağımlılık kurmak
  gereksiz soyutlamadır.
- Hash tabanlı router (`location.hash`), global state — hiçbiri bu feature'da gerekmiyor
  (henüz yönlendirilecek ikinci bir ekran yok).
- **Host/Origin beyaz listesi (DNS rebinding koruması, mimari §10).** F-001'de yalnızca
  `/api/health` vardır ve bu uç herhangi bir yazma/hassas veri döndürmez; Host/Origin
  kontrolü ilk yazma ucuyla birlikte **F-002**'de eklenecek. Bu bilinçli bir erteleme,
  atlanmış bir mimari zorunluluk değil (QA denetimi E-yorum, kod başlamadan CEO'ya
  hatırlatmak için burada not edilmiştir).
- **`data/` klasörünün oluşturulması (`mkdir`).** F-001 sunucusu `data/`'yı hiç okumaz/yazmaz;
  taze bir klonda bu klasör `.gitignore` yüzünden fiziksel olarak yoktur. İlk oluşturma işi
  **F-002**'nindir (`MC_DATA_DIR` altını `mkdir -p` etmek F-002'nin ilk adımı olacak).

**Ortak kabuk kararı (AC10 netleştirmesi):** `docs/03-ux.md` "Ortak kabuk" bölümündeki üst
çubuk taslağı 5 ekran sekmesi + bağlantı göstergesi + ayarlar ikonu gösterir; ama bunların
hiçbiri (Zaman Çizelgesi, Kanban, Ayarlar dahil) bu feature'da inşa edilmiyor. Bu yüzden
iskelette üst çubuk yalnızca **statik/tıklanamaz** öğeler içerir: uygulama başlığı
("MISSION CONTROL", Departure Mono) + Faz 1 ekran adlarının salt-görsel etiketleri (Zaman
Çizelgesi, Kanban, Ayarlar — tasarım token'larıyla, `<button>` değil `<span>`/`<div>`,
`aria-disabled` ile) + Faz 2 ekranları (Kapılar, Thread, Token) **hiç gösterilmez** (AC10
metniyle birebir). İçerik alanı boş, nötr bir yer tutucu gösterir ("İskelet hazır" gibi bir
Türkçe metin). Tıklanamaz statik etiket kullanma nedeni: fabrika kuralı "buton var ama iş
yapmıyorsa bitmemiştir" — gerçek `<button>` koyup hiçbir şey yapmamak stub sayılır; salt
görsel etiket bu riski taşımaz çünkü tıklanabilirlik vaat etmez. qa-evaluator bu yorumu
reddederse (ör. "sekmeler hiç görünmesin" bekliyorsa) fix turunda daraltılabilir.

---

## 2. Oluşturulacak / değiştirilecek dosyaların tam listesi

Feature notunun dosya sahipliği listesiyle birebir sınırlı (`docs/features/F-001-iskelet.md`
"Dosya sahipliği" bölümü). `src/features/**` bu feature'da açılmıyor (henüz dikey dilim yok).

| Dosya | Amaç |
|---|---|
| `package.json` | Bağımlılıklar, scripts, `engines.node` |
| `package-lock.json` | `npm install` çıktısı; commit edilir |
| `tsconfig.json` | Tek TS konfigürasyonu (server + web + test + `vite.config.ts` kapsar); ayrı `tsconfig.server.json` **yok** (bkz. §3 "type ve tsconfig kararı") |
| `vite.config.ts` | Web build/dev sunucusu; `root: 'src/web'`, `/api` proxy → `MC_PORT` |
| `vitest.config.ts` | Vitest konfigürasyonu (node ortamı; jsdom **yok**, bkz. §3 gerekçe) |
| `playwright.config.ts` | E2E konfigürasyonu (prod modu); tek proje `chromium`; üst düzey `webServer: { command: 'npm run build && npm start', url: 'http://127.0.0.1:7333/api/health', reuseExistingServer: false, timeout: 120_000 }` (tek tanım, bkz. §5 AC7); AC3'ün dev kanıtı bu dosyada **değil**, ayrı `playwright.dev.config.ts`'tedir (Y1 — tur 2 QA revizyonu) |
| `playwright.dev.config.ts` | E2E konfigürasyonu (dev modu, AC3 kanıtı — Y1); tek proje `chromium`; üst düzey `webServer: { command: 'npm run dev', url: 'http://127.0.0.1:7334', reuseExistingServer: false, timeout: 60_000 }`; **prod `webServer`'ı bu dosyada hiç tanımlanmaz** — bu koşuda 7333'ü yanıtlayan sürecin `npm run dev`'in kendi API süreci olduğu bu yüzden garantidir |
| `eslint.config.js` | ESLint flat config (typescript-eslint + react hooks kuralı yok — henüz gerekmiyor) |
| `.prettierrc.json` | Prettier biçim kuralları |
| `.prettierignore` | `node_modules/`, `dist/`, `data/` (Prettier `node_modules`'ı varsayılan yok saymayabilir) |
| `.gitignore` | `node_modules/`, `dist/`, `data/`, `test-results/`, `playwright-report/`, `.env*`, `*.local` (B12 — Playwright çıktıları eklendi) |
| `.gitattributes` | `* text=auto eol=lf` (B/E2 kararı — bkz. §3, ekleniyor) |
| `.github/workflows/ci.yml` | Push'ta üç OS matrisinde (`ubuntu-latest`, `windows-latest`, `macos-latest`) `npm ci && npm run verify` (B2/B11) |
| `src/server/index.ts` | Bootstrap: Node sürüm kontrolü → `MC_PORT` oku (`resolvePort()`) → `/api/health` → `listen(port, '127.0.0.1')`; prod modda `dist/web` statik servis (MIME + `/`→`index.html` + bilinmeyen yol 404, bkz. §5 AC7) |
| `src/web/index.html` | Vite HTML girişi (root = `src/web`); `favicon.svg` link'i (B9) |
| `src/web/main.tsx` | React mount noktası; CSS girişi (`import './index.css'`) burada — `App.tsx` CSS import **etmez** (B7) |
| `src/web/App.tsx` | Ortak kabuk: üst çubuk (statik, tıklanamaz) + boş içerik alanı; hiçbir `useState`/`useEffect`/`onClick` yok (R2 koşulu) |
| `src/web/index.css` | Tailwind girişi + `@theme` token'ları: renk (§3.1) + `--font-display`/`--font-mono`/`--font-sans` (B13) + üç `@font-face` kuralı |
| `src/web/favicon.svg` | Statik favicon; tarayıcının otomatik `/favicon.ico` isteğinin konsola 404 hatası düşürmesini engeller (B9) |
| `src/web/fonts/DepartureMono-Regular.woff2` | Başlık/görüntü fontu (§3, B13) |
| `src/web/fonts/IBMPlexMono-Regular.woff2` | Gövde/arayüz fontu, regular ağırlık (§3, B13) |
| `src/web/fonts/IBMPlexMono-Medium.woff2` | Gövde/arayüz fontu, buton/rozet metinleri için medium ağırlık (§3, B13) |
| `src/web/fonts/IBMPlexSans-Regular.woff2` | Okuma fontu (Thread ekranı F-003'te kullanılacak; token F-001'de tanımlanır) (§3, B13) |
| `src/web/fonts/LICENSE-DepartureMono.txt` | Departure Mono lisans metni (OFL) |
| `src/web/fonts/LICENSE-IBMPlex.txt` | IBM Plex lisans metni (OFL) |
| `tailwind.config.ts` | **Oluşturulmuyor** (B15) — Tailwind v4 + `@tailwindcss/vite` kurulumunda tema `index.css`'teki `@theme` bloğuyla CSS-first tanımlanır; ayrı bir `tailwind.config.ts` `@config` ile açıkça yüklenmedikçe etkisizdir (ölü kod). AC10'daki "Tailwind config'e girilmiş" ifadesi v4'te `@theme` bloğu anlamına gelir. |
| `tests/server/health.test.ts` | Sunucu birim/entegrasyon testi: `/api/health` alanları (AC5), `isSupportedNodeVersion` (ek AC), `resolvePort()` birim testleri + `server.address()` assert'i (AC4) |
| `tests/deps.test.ts` | `package-lock.json` beyaz liste + native derleme negatif taraması (AC2, B1) |
| `tests/no-external-host.test.ts` | `src/web/**/*.{ts,tsx,css,html}`, `src/server/**/*.ts`, `index.html` içinde `127.0.0.1`/`localhost` dışı `http(s)://` veya CDN dizgesi yok; **kapsam kod/işaretleme uzantılarıyla sınırlıdır**, `src/web/fonts/LICENSE-*.txt`/`*.woff2` taranmaz (yeni AC — self-host font guard, B13, kapsam daraltması Y3 — tur 2 QA) |
| `tests/ci-workflow.test.ts` | `ci.yml` içinde `on:`/`push`, `npm ci`, `npm run verify`, üç OS'lik matris dizgelerinin varlığı (AC9, B11 — kalıcı, geçici script YOK) |
| `tests/web/App.test.tsx` | Web bileşen testi (AC6): `renderToStaticMarkup` ile başlık metni + kabuk yapısı |
| `tests/web/theme.test.ts` | `index.css` içinde renk + üç `--font-*` token'ının statik dizge doğrulaması (AC10 tipografi yarısı, B13) |
| `tests/e2e/shell.spec.ts` | Playwright (prod modu): panel açılır, başlık görünür, konsol/`pageerror` hatası yok, üst çubukta tıklanabilir öğe yok, renk/koyuluk assert'i (AC3 kısmen, AC7, AC10, R2 koşulu, B4/B9/B14) |
| `tests/e2e/dev-shell.spec.ts` | Playwright (`playwright.dev.config.ts`, komut `npm run e2e:dev`): `npm run dev` başlığı gösterir + `/api` proxy (7334→7333) + doğrudan 7333 200 döner — bu süreç garanti olarak dev API'sidir çünkü bu configde prod `webServer` hiç yok (AC3 asıl kanıtı, B3/Y1 — tur 2 QA) |
| `README.md` | Kurulum + çalıştırma adımları (Windows + macOS) + font lisans notu + `npx playwright install chromium` + Node ≥20.11 + `data/` gitignore notu + `npm run e2e`'nin `verify`'a dahil olmadığı notu (AC11, B16) |

**Not:** `src/server/http/**`, `src/server/sse/**`, `src/server/store/**`,
`src/server/watch/**`, `src/server/write-gate.ts`, `src/shared/**` bu feature'da **açılmaz** —
mimarideki §4 klasör ağacı hedef durumdur, F-001 yalnızca `index.ts` ile başlar.
`/api/health` router'ı ayrı bir `http/router.ts` gerektirmeyecek kadar küçüktür (~1 route);
sonraki feature'lar router'ı ayrı dosyaya çıkarabilir.

---

## 3. Bağımlılık listesi

Kapalı liste `docs/02-architecture.md` §3.4'ün bir **alt kümesidir** (bu feature'ın gerçekten
kullandığı paketler). Sürüm aralıkları caret (`^`) ile verilmiştir; `npm install` anında
çözülen tam sürüm `package-lock.json`'a sabitlenir — burada verilen numaralar üst sınır
niyeti göstermez, yalnızca "şu anki kararlı majör" beklentisidir.

**Runtime (`dependencies`)**

| Paket | Aralık | Gerekçe |
|---|---|---|
| `react` | `^19` | Onaylı UI stack'i (§3.1). |
| `react-dom` | `^19` | Onaylı UI stack'i (§3.1). |

**Geliştirme (`devDependencies`)**

| Paket | Aralık | Gerekçe |
|---|---|---|
| `vite` | `^6` | Web build ve dev sunucusu (§3.1, §12). |
| `@vitejs/plugin-react` | `^4` | JSX/Fast Refresh desteği. |
| `typescript` | `^5.6` | Tip kontrolü (`tsc --noEmit`). |
| `tsx` | `^4` | Sunucuyu build'siz TS olarak çalıştırmak (§3.2). |
| `tailwindcss` | `^4` | Stil; v4 onaylı (§3.1, ADR notu). |
| `@tailwindcss/vite` | `^4` | Ayrı PostCSS zincirini gereksiz kılar (§3.1). |
| `vitest` | `^2` | Birim + entegrasyon testleri; Vite config'ini paylaşır. |
| `@playwright/test` | `^1.47` | E2E; PRD kabul kriterlerinin çoğu yalnızca gerçek tarayıcıda doğrulanır. |
| `concurrently` | `^9` | `npm run dev` tek komutta iki süreç başlatır (§12). |
| `eslint` | `^9` | Fabrika `lint` komutu. |
| `@eslint/js` | `^9` | ESLint önerilen kurallar. |
| `typescript-eslint` | `^8` | TS için lint kuralları. |
| `prettier` | `^3` | Biçimlendirme. |
| `@types/react` | `^19` | Tip tanımları. |
| `@types/react-dom` | `^19` | Tip tanımları. |
| `@types/node` | `^22` | Sunucu kodu (`node:http`, `node:path`) için tip tanımları; ayrıca Node ≥20.11 hedefiyle uyumlu. |

**Kasıtlı olarak eklenmeyenler (bu feature'da):** `chokidar`, `yaml`, `@dnd-kit/core` (henüz
kullanılmıyor — §1), `jsdom`/`@testing-library/react` (bkz. aşağıdaki not), `cross-env`
(env değişkeni script içinde set edilmiyor, README'de platform bazlı anlatılıyor).

**Web bileşen testi neden jsdom/@testing-library kullanmıyor:** §3.4 kapalı listesine yeni
paket eklemek ADR gerektirir (`docs/02-architecture.md` §3.4 son satırı). `jsdom` ve
`@testing-library/react` bu listede yok. AC6'yı ADR'siz karşılamak için `App` bileşeni
`react-dom/server`'ın `renderToStaticMarkup`'ı ile Node ortamında (DOM'suz) statik HTML'e
render edilir ve çıktı dizgesinde beklenen metin/rol aranır (ör. "MISSION CONTROL" başlığı,
içerik alanının varlığı). Bu, gerçek DOM etkileşimini test etmez — onu zaten
`tests/e2e/shell.spec.ts` (Playwright, gerçek tarayıcı) karşılıyor. Bu bir geçici çözüm
değil, kapalı bağımlılık listesiyle uyumlu bilinçli bir sınırdır; qa-evaluator yetersiz
bulursa ADR ile `@testing-library/react` + `jsdom` eklenmesi gerekir (bu sözleşme o kararı
**almaz**, yalnızca riski işaretler — bkz. §7).

**Yasaklı (§3.4, S2):** `better-sqlite3`, `node-gyp` gerektiren her paket.

**Font varlıkları (B13 — CEO kararı: self-host, CDN yasak).** Yeni bir npm bağımlılığı
**değildir** — statik dosya olarak `src/web/fonts/` altına eklenir, dosya sahipliği
`src/web/**` kapsamındadır, G2 kapalı listesini büyütmez, ADR gerekmez.

| Dosya | Font | Ağırlık | Format | Kaynak |
|---|---|---|---|---|
| `DepartureMono-Regular.woff2` | Departure Mono | Regular | woff2 | `departuremono.com` (resmi proje sitesi, ücretsiz lisans — OFL) |
| `IBMPlexMono-Regular.woff2` | IBM Plex Mono | Regular | woff2 | `github.com/IBM/plex` resmi deposu (OFL-1.1) |
| `IBMPlexMono-Medium.woff2` | IBM Plex Mono | Medium (500) | woff2 | `github.com/IBM/plex` resmi deposu (OFL-1.1) |
| `IBMPlexSans-Regular.woff2` | IBM Plex Sans | Regular | woff2 | `github.com/IBM/plex` resmi deposu (OFL-1.1) |

Yukarıdaki kaynak URL'leri **yalnızca kod turunda bir kerelik indirme adımıdır** — üründe
hiçbir zaman bu hostlara istek atılmaz; dosyalar indirilip repoya commit edilir ve
`@font-face` ile yerelden servis edilir. Doğrulama:
1. `src/web/index.css` içinde üç `@font-face` kuralı, `src: url('./fonts/<dosya>') format('woff2')`
   biçiminde, **göreli** yol kullanır (mutlak URL/hostname yok).
2. `--font-display: 'Departure Mono', ui-monospace, monospace`, `--font-mono: 'IBM Plex Mono',
   ui-monospace, monospace`, `--font-sans: 'IBM Plex Sans', system-ui, sans-serif` `@theme`
   token'ları tanımlı (sistem fontu **fallback** olarak kalır, birincil değil).
3. `tests/web/theme.test.ts` bu üç token'ın ve üç `@font-face` bloğunun `index.css` içinde
   dizge olarak var olduğunu doğrular (statik).
4. `tests/e2e/shell.spec.ts` içinde çalışma zamanı kanıtı iki parçadır (Y2 — tur 2 QA):
   (a) **yükleme kanıtı** — `await document.fonts.ready` sonrası
   `document.fonts.check('16px "Departure Mono"') === true` (woff2 404 verirse bu `false`
   döner, test kırılır); (b) **uygulanma kanıtı** — başlık elemanının
   (`[data-testid="app-title"]`) hesaplanan `fontFamily`'sinin `Departure Mono` içermesi.
   `getComputedStyle(...).fontFamily` tek başına yükleme kanıtı **değildir** (yalnızca CSS
   bildirimini okur, 404 olsa da aynı değeri döner); bu yüzden (a) birincil, (b) ikincil
   kanıttır.
5. `tests/no-external-host.test.ts` (aşağıda) bu dört dosyanın dışında hiçbir ağ isteğinin
   koda sızmadığını garanti eder.

**Lisans notu:** README'ye "Fontlar: Departure Mono ve IBM Plex ailesi, SIL Open Font License
1.1 ile lisanslıdır; lisans metinleri `src/web/fonts/LICENSE-*.txt` içindedir" cümlesi eklenir.

**Kod turunda tıkanma durumu (CEO kararı, tekrar):** Font dosyaları bu ortamda indirilemezse
(ağ erişimi yok, kaynak site erişilemez, lisans belirsizliği vb.) developer **DURUR** ve
`docs/blockers.md`'ye yazar. Sistem mono yığınına (`ui-monospace, SFMono-Regular, Consolas,
monospace`) düşme kararı yalnızca CEO'nundur; developer kendi başına bu kararı veremez ve
"geçici olarak sistem fontu kullandım" diyerek AC'yi kapatamaz.

**`hasInstallScript` beyaz listesi (B1 — AC2 kanıtının kendi kendine çelişmesini çözer):**
`tsx`/`vite` (→ `esbuild`) ve `@playwright/test` (→ `playwright`) önceden derlenmiş ikili
**indiren** postinstall script'i taşır; bu G2/S2'nin yasakladığı **derleme** değildir (mimari
§3.2 bunu açıkça kabul eder). `tests/deps.test.ts` bu paketleri bilinen/derlemesiz beyaz
listeye (`esbuild`, `@esbuild/*`, `playwright`, `@playwright/test`) karşı doğrular; listede
olmayan bir `hasInstallScript: true` paketi test kırar. Ayrıca aynı testte `node-gyp`,
`prebuild-install`, `node-addon-api`, `nan`, `better-sqlite3` dizgelerinin `package-lock.json`
içinde **hiç geçmediği** ayrıca assert edilir.

**`vite`/`vitest` sürüm uyumu (bağımlılık denetimi notu):** `npm install` sırasında peer
uyarısı çıkarsa (`vitest@^2` ile `vite@^6` arasında), sözleşme kuralı: uyumlu tek bir çift
seçilir (gerekirse `vitest` majörü `vite@^6`'yı destekleyen sürüme yükseltilir — bu kapalı
listeyi büyütmez, yalnızca aralık seçimidir, ADR gerekmez). Kod turunda `npm install`
çalıştırıldığında bu ilk kontrol edilir; çakışma varsa `package.json`'daki `^` aralığı buna
göre daraltılır.

**`package.json` `"type"` kararı (E3):** `"type": "module"` **kullanılır** — proje ESM'dir.
Gerekçe: `vite.config.ts`/`playwright.config.ts`/`eslint.config.js` modern araç zincirinde
varsayılan olarak ESM beklenir ve `tsx` ESM'i sorunsuz çalıştırır; CJS ile karışık kullanmak
`require`/`import` uyuşmazlığı riskini kod turunun ilk saatinde yaşatır. Bu, iskelet
turlarında en çok zaman kaybettirilen karardır ve burada **açıkça** sabitlenmiştir.

**Tek `tsconfig.json` kararı (E3):** Ayrı bir `tsconfig.server.json` **oluşturulmaz**. Tek
config `lib: ["ES2022", "DOM"]` içerir (web tarafı JSX/DOM tipleri için gerekli); bu, sunucu
kodunda `document`/`window` gibi DOM API'lerinin **typecheck'ten geçebileceği** anlamına
gelir (sessiz bir tuzak, ama S1/S4 açısından zararsız — sunucu kodu zaten bu API'leri
kullanmaz ve code review bunu yakalar). İki ayrı config + `references` karmaşasına girmek bu
ölçekteki bir iskelet için orantısız soyutlamadır (Karpathy 2). Test/derleme davranışı bu
kararla değişmez.

**`.gitattributes` kararı (E2):** **Ekleniyor.** İçerik: `* text=auto eol=lf`. Gerekçe: Windows
`core.autocrlf` açıkken çalışma kopyası CRLF olabilir; bugün `verify` biçim kontrolü
içermediği için bu zararsızdır, ama ileride `prettier --check` `verify`'a eklenirse (bu
feature'da eklenmiyor) platforma göre farklı sonuç üretebilir. Tek satırlık dosya, dosya
sahipliğine küçük bir ekleme olarak eklenir (feature notunun listesinde açıkça yok ama
"config dosyaları" kapsamına girer — kapsam sızması sayılmaz).

**Linux CI import yolu duyarlılığı (E2, risk notu — bkz. §7):** `ubuntu-latest`'te dosya
sistemi büyük/küçük harf duyarlıdır; Windows'ta çalışan bir `import './app'` (gerçek dosya
`App.tsx`) yerelde sessizce geçer ama CI'da patlar. Kod turunda tüm importlar dosya adıyla
**birebir** (büyük/küçük harf dahil) yazılır; bu bir test maddesi değil, kod inceleme
disiplinidir (statik testle ölçmek orantısız).

---

## 4. Komutlar (`package.json` scripts)

Kaynak: `docs/02-architecture.md` §12, `docs/features/F-001-iskelet.md` AC8 (verify tanımı).
**Not (R1 — ÇÖZÜLDÜ):** QA sözleşme denetimi R1 kararı ve CEO onayıyla `docs/02-architecture.md`
§12'deki `npm run verify` satırı `typecheck && lint && test && build` olarak düzeltildi
(dosyada bugünün tarihiyle bir CEO notu var). Artık iki belge arasında çelişki **yok**;
`build` `verify`'a dahildir, `e2e` dahil değildir. Bu bölümdeki tablo bu nihai tanımı
yansıtır.

| Script | Komut | Ne yapar |
|---|---|---|
| `dev` | `concurrently "npm:dev:server" "npm:dev:web"` | Sunucu + Vite'ı tek komutla başlatır |
| `dev:server` | `tsx watch src/server/index.ts` | API sunucusu, 127.0.0.1:`MC_PORT` (vars. 7333), değişiklikte yeniden başlar |
| `dev:web` | `vite` | Web dev sunucusu, `MC_WEB_PORT` (vars. 7334), `/api` → `MC_PORT` proxy |
| `build` | `vite build` | `dist/web/` üretir |
| `start` | `tsx src/server/index.ts` | Tek süreç, tek port; `dist/web` statik servis edilir |
| `test` | `vitest run` | Birim + entegrasyon testleri, tek seferlik |
| `test:watch` | `vitest` | Testleri izleme modunda çalıştırır |
| `e2e` | `playwright test` | Playwright E2E prod modu (`playwright.config.ts`, `webServer` build+start'ı kendisi tetikler) |
| `e2e:dev` | `playwright test -c playwright.dev.config.ts` | Playwright E2E dev modu (AC3 kanıtı) — ayrı config, prod `webServer` bu koşuda hiç başlamaz (Y1 — tur 2 QA) |
| `test:e2e` | `npm run e2e` | Görev brifindeki isimle uyum için takma ad (aynı komut) |
| `typecheck` | `tsc --noEmit` | Tip kontrolü |
| `lint` | `eslint .` | Lint |
| `format` | `prettier --write .` | Biçimlendirme (verify'a dahil değil) |
| `verify` | `npm run typecheck && npm run lint && npm run test && npm run build` | Feature bitiş kapısı (AC8) — e2e **dahil değil**, ayrı çalıştırılır |

---

## 5. Doğrulama planı — 13 kabul kriterinin her biri

Tüm komutlar proje kökünden (`C:\dev\apps\mission-control`) çalıştırılır. `MC_PORT`/`MC_WEB_PORT`
belirtilmeyen testlerde varsayılan değerler kullanılır. Numaralandırma
`docs/features/F-001-iskelet.md`'nin güncel kabul kriteri listesindeki sırayı izler (13 madde;
eskiden 11'di, font self-host ve no-external-host guard eklendi).

**AC1 — `git init` + ilk commit; `.gitignore` genişletilmiş (B12)**
- Komut: `git log --oneline -1` boş dönmemeli.
- Komut: `git status --porcelain` **boş** dönmeli (yalnızca `git log`/`git status` — silme
  gerektiren komut değil). Bu, eskisinden farklı olarak `npm run e2e` çalıştırıldıktan **sonra**
  da geçerli olmalı; yani `.gitignore` Playwright çıktılarını da kapsamalı.
- `.gitignore` içeriği: `node_modules/`, `dist/`, `data/`, `test-results/`,
  `playwright-report/`, `.env*`, `*.local` — her biri için ayrı `findstr /C:"<desen>" .gitignore`
  (Windows) / `grep -F "<desen>" .gitignore` (macOS/Linux), 7 ayrı çağrı.
- İlk commit kapsamı: **tüm depo, `docs/` dahil, yalnızca `.gitignore`'daki desenler hariç.**
  Kanıt: `git ls-files docs/features/F-001-iskelet.md` dolu dönmeli (yani `docs/` versiyonlanmış).
- Kanıt: commit hash + `.gitignore` içeriği + `git ls-files` çıktısı.

**AC2 — `npm install` native derleme olmadan tamamlanır (Windows + macOS)**
- Komut: `npm install` (temiz `node_modules` üzerinde, yerelde Windows'ta). Beklenen: sıfır
  çıkış kodu, çıktıda `node-gyp`, `gyp ERR`, `MSBUILD`, `Visual Studio` dizgeleri **geçmez**
  (`npm install 2>&1 | findstr /I "gyp MSBUILD"` boş dönmeli).
- Kalıcı kanıt (B1 — `hasInstallScript` beyaz listesi): `tests/deps.test.ts` `package-lock.json`
  okur; `hasInstallScript: true` olan paket adlarını toplar ve `{'esbuild','@esbuild/*',
  'playwright','@playwright/test'}` kümesine karşı assert eder (küme dışı ad → test kırılır);
  ayrıca `node-gyp`, `prebuild-install`, `node-addon-api`, `nan`, `better-sqlite3`
  dizgelerinin lock dosyasında **hiç geçmediğini** ayrıca assert eder. Bu test `npm test`
  içinde her kod turunda otomatik çalışır (kalıcı, `npm install`'a bağımlı değil).
- **macOS + Linux ayağı (B2 — CI matrisiyle gerçek kanıt):** yerelde macOS makinesi yok; bu
  ayak `ci.yml`'in `strategy.matrix.os: [ubuntu-latest, windows-latest, macos-latest]`
  matrisiyle her push'ta gerçek `npm ci` çalıştırarak kanıtlanır (AC9 ile aynı koşu). **AC2'nin
  macOS/Linux yarısı, macos-latest ve ubuntu-latest job'ları yeşil bitene kadar açıkça yarım
  sayılır** — push öncesi F-001 bu iki alt-kriter için GEÇTİ ilan edilemez (bkz. §8).

**AC3 — `npm run dev` tek komutla hem Vite hem API'yi kaldırır; panel beyaz ekran vermez**
- **Otomatik kanıt (B3 → Y1 düzeltmesi, tur 2 QA — ayrı config, tek uygulanabilir mekanizma):**
  `webServer` Playwright'ta bir `TestConfig` alanıdır, `TestProject` alanı **değildir** — proje
  içine gömülemez (gömülürse `npm run typecheck` kırılır, Y1). Bu yüzden dev kanıtı **ayrı bir
  konfigürasyon dosyasında** (`playwright.dev.config.ts`) tanımlanır: tek proje `chromium`, üst
  düzey `webServer: { command: 'npm run dev', url: 'http://127.0.0.1:7334',
  reuseExistingServer: false, timeout: 60_000 }`. Bu dosyada **prod `webServer`'ı (build+start)
  hiç tanımlanmaz** — dolayısıyla bu koşuda 7333'ü yanıtlayan sürecin `npm run dev`'in kendi API
  süreci (`dev:server`) olduğu **garantidir**; prod sunucusu bu koşuda hiç ayağa kalkmaz, port
  çakışması ve "yanlış yeşil" riski (Y1'in asıl endişesi) yapısal olarak elenir.
  Komut: `npm run e2e:dev` (= `playwright test -c playwright.dev.config.ts`).
  `tests/e2e/dev-shell.spec.ts` dört assert: (1) `page.goto('/')` sonrası başlık görünür; (2)
  `page.locator('body')` metni boş değil; (3) `(await page.request.get('/api/health')).status()
  === 200` — **Vite `/api` proxy'sinin kanıtı** (7334 üzerinden `MC_PORT`'a, vars. 7333); (4)
  `(await page.request.get('http://127.0.0.1:7333/api/health')).status() === 200` — **dev API
  sürecinin doğrudan ayakta olduğunun kanıtı**, ve bu yanıt yalnızca dev sürecinden gelebilir
  çünkü prod `webServer` bu configde hiç yok. Playwright kendi süreç ağacını kapatır
  (Windows'ta manuel `taskkill` gerekmez).
- "Beyaz ekran vermez" aynı testte: `body` metninin boş olmadığı ve `#root` altında en az bir
  çocuk eleman bulunduğu assert edilir.
- Bu test `verify`'a dahil değildir (E2E, `npm run e2e:dev` altında); AC3'ün kanıtı bu komutun
  çıktısıdır — elle gözlem **gerekmez**. `npm run e2e` (prod config) AC3'ü kanıtlamaz, yalnızca
  AC7'yi kanıtlar — ikisi ayrı komutlar, ayrı config dosyaları, ayrı kanıtlardır (bkz. §8).

**AC4 — `MC_PORT` okunur, varsayılan 7333, yalnızca 127.0.0.1'e bağlanır (B4/B5)**
- **Katman 1 — zorunlu, ağ gerektirmez, atlanamaz:** `src/server/index.ts` bir
  `createServer(port: number): http.Server` fabrika fonksiyonu dışa aktarır; bu fonksiyon
  `listen(port, '127.0.0.1')`'i **kendisi çağırır** (Y4 — tur 2 QA: `listen` asenkrondur,
  `address()` `listening` olayından önce `null` döner). Test (efemeral port `0` ile):
  ```
  const server = createServer(0);
  await once(server, 'listening'); // node:events
  expect(server.address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
  server.close();
  ```
  Bu, `listen`'in **etkin** bind adresini ölçer; hiçbir koşulda `skip` edilmez; assert'in
  kendisi bu düzeltmeyle zayıflatılmamıştır (B4 kararı aynen geçerli).
- **Katman 2 — zorunlu, statik guard:** `src/**/*.ts(x)` (glob ile, tek dosya değil) taranır;
  `0.0.0.0`, `MC_HOST`, `'::'` bind literali veya `127.0.0.1` dışı bir host geçen `http://`
  literali **hiç bulunmamalı**. Bulunursa test kırılır. Bu, `tests/no-external-host.test.ts`
  ile aynı tarama altyapısını paylaşabilir.
- **Katman 3 — opsiyonel, ek kanıt:** `os.networkInterfaces()` ile loopback-dışı bir IPv4
  bulunursa `net.connect({host, port, timeout: 500})` denenir, beklenen `ECONNREFUSED`/timeout.
  Bulunamazsa `test.skip` ile atlanır. **Sözleşme açıkça yazar: bu katman atlanırsa AC4'ün
  GEÇTİ kararına hiçbir katkı sağlamaz — yalnızca katman 1 ve 2 birincil kanıttır.**
- **Port çözümleme — saf fonksiyon (B5):** `resolvePort(env: NodeJS.ProcessEnv): number`
  dışa aktarılır ve birim testle 4 vakayla doğrulanır: `{}` → `7333` · `{MC_PORT:'18333'}` →
  `18333` · `{MC_PORT:'abc'}` → **varsayılana düşer** (7333) ve stderr'e Türkçe okunabilir bir
  uyarı basar — bu davranış burada seçilmiştir, "hata verip çıkma" değil, çünkü geçersiz bir
  env değeri iskelet turunda sunucuyu tamamen durdurmamalıdır · `{MC_PORT:'0'}` → `0`
  (efemeral port, testler için kullanılır, üründe fiilen kullanılmaz). Entegrasyon testi
  **sabit 7333'e hiç bağlanmaz** — tüm testler `resolvePort`/`createServer(0)` ile efemeral
  port kullanır. "7333 reddeder" iddiası tamamen kaldırılmıştır.

**AC5 — `GET /api/health` 200 + JSON `{ ok, version, port, node, uptime_s }` (B6)**
- **Tek çakışma-çözme kuralı (B6a, sözleşme genelinde geçerli):** alan adları ve API sözleşmesi
  konularında **mimari** (`docs/02-architecture.md`) esas alınır; kapsam ve bitiş kriteri
  konularında **feature notu** esas alınır. Bu ikisi artık çelişmiyor: CEO
  `docs/features/F-001-iskelet.md` AC5 metnini `uptime_s` olarak güncelledi (bkz. dosyanın
  15. satırı) — sözleşmedeki eski "tek taraflı çözüm" notu artık gereksiz, kaldırıldı.
- **Zarf:** health yanıtı **zarfsız düz JSON**'dur (`ApiResponse<T>` sarmalayıcısı yok).
  Gerekçe: mimari §6.6 health'i açıkça düz obje olarak gösterir ve bu uç bir readiness
  probe'udur, veri ucu değildir.
- **Alan kümesi (F-001 sabit):** `{ ok: boolean, version: string, port: number, node: string,
  uptime_s: number }`. Mimari §6.6'nın kalan alanları (varsa) ilgili feature'da eklenecek.
- **`version` kaynağı:** `package.json`'dan okunur — `import pkg from '../../package.json' with
  { type: 'json' }` (Node 22 + `"type":"module"` ile uyumlu import attribute sözdizimi) veya
  eşdeğer `readFileSync` + `JSON.parse`; `tsconfig.json`'da `resolveJsonModule: true` bu
  seçimle birlikte eklenir.
- Komut (test içinde): `const res = await fetch('http://127.0.0.1:' + port + '/api/health')`
  → `res.status === 200`, `content-type` `application/json` içerir,
  `body.ok === true`, `typeof body.version === 'string'`, `typeof body.port === 'number'`,
  `typeof body.node === 'string'`, `typeof body.uptime_s === 'number'` — beş alan da zorunlu.

**AC6 — Vitest kurulu; ≥1 sunucu birim testi + ≥1 web bileşen testi geçiyor (koşullu — B7/R2)**
- Komut: `npm test` → `tests/server/health.test.ts` + `tests/web/App.test.tsx` yeşil.
- **R2 kararı (kabul, üç koşulla):** `renderToStaticMarkup` (react-dom/server) ile Node
  ortamında (DOM'suz) statik HTML üretilip metin/rol aranması F-001 için **yeterlidir**,
  şu üç koşulla:
  1. F-001'in web kabuğunda hiçbir `useState`/`useEffect`/`onClick` **bulunmaz**; biri bile
     gerekirse bu karar geçersizdir ve önce ADR gerekir.
  2. `tests/e2e/shell.spec.ts` üst çubukta tıklanabilir öğe olmadığını assert eder (bkz. AC10).
  3. **Gerçek DOM test altyapısı (`jsdom` + `@testing-library/react`) en geç F-003'te ADR ile
     gelir** — bu bir risk değil, **planlı iştir** (bkz. §7 "Planlı iş").
- Teknik koşullar: `App.tsx` CSS import **etmez** (CSS girişi `main.tsx`'te); `vitest.config.ts`
  `environment: 'node'` altında JSX/TSX derlemesinin React 19 `react-jsx` dönüşümüyle çalıştığı
  ilk testte ampirik doğrulanır.
- Kanıt: `vitest run` çıktısında toplam ≥6 test dosyası (`health.test.ts`, `deps.test.ts`,
  `no-external-host.test.ts`, `App.test.tsx`, `theme.test.ts`, `ci-workflow.test.ts` — bkz. §2;
  sayı Y5 — tur 2 QA ile ≥4'ten ≥6'ya düzeltildi, listedeki 6 dosyayla artık tutarlı), 0 fail.

**AC7 — Playwright kurulu; "panel açılıyor, başlık görünüyor, konsol hatası yok" E2E'si geçiyor (B8/B9)**
- **Tek `webServer` tanımı, yalnızca `playwright.config.ts` (prod modu) kapsamında (B8 — üç
  farklı yazım birleştirildi; Y1 — tur 2 QA: dev modunun kanıtı artık ayrı
  `playwright.dev.config.ts`'te, bu dosyada tanımlı **değildir**, bkz. AC3 — böylece "tek
  webServer" ifadesi ile AC3'ün ayrı config'i arasındaki çelişki ortadan kalkar):**
  `webServer: { command: 'npm run build && npm start', url: 'http://127.0.0.1:7333/api/health',
  reuseExistingServer: false, timeout: 120_000 }`. Readiness URL'i `/api/health` (mimari §6.6
  bunu readiness sinyali ilan ediyor) — statik dosyaların değil, sunucunun hazır olduğunun
  kanıtı.
- **Tek tarayıcı projesi (B9a):** `playwright.config.ts` `projects: [{ name: 'chromium', use: {
  ...devices['Desktop Chrome'] } }]`. `playwright.dev.config.ts` de aynı şekilde tek proje
  `chromium` tanımlar (AC3). Firefox/webkit hiçbir configde tanımlanmaz, kurulmaz.
- **Statik servis sözleşmesi (B9b):** `src/server/index.ts` prod modda `dist/web`'i servis
  eder: bilinen uzantılar için doğru MIME (`.html`→`text/html`, `.js`→`text/javascript`,
  `.css`→`text/css`, `.svg`→`image/svg+xml`, `.woff2`→`font/woff2`); `/` → `index.html`;
  **bilinmeyen yol → 404** (SPA fallback F-003'te router gelince eklenecek, şimdi yok).
  `src/web/favicon.svg` ship edilir ve `index.html` `<link rel="icon">` ile bağlar — tarayıcının
  otomatik `/favicon.ico` isteğinin 404 konsol hatası üretmesini engeller.
- `tests/e2e/shell.spec.ts` altı assert (Y2 — tur 2 QA ile beşten altıya çıktı): (1) `page.goto('/')` sonrası başlık görünür (`[data-testid="app-title"]` metninde "MISSION CONTROL"); (2) `body` metni boş değil; (3) `page.on('console')` **`goto`'dan önce** bağlanır ve toplanan hata listesi boş (`expect(consoleErrors).toEqual([])`) — `page.on('pageerror', ...)` de aynı listeye eklenir (yakalanmamış JS istisnaları için); (4) üst çubukta tıklanabilir öğe yok: `expect(await page.locator('header button, header a, header [role=button]').count()).toBe(0)` (R2 koşul 2, R5'in de otomatik kanıtı); (5) `await document.fonts.ready` sonrası `document.fonts.check('16px "Departure Mono"') === true` (AC11'in birincil, **yükleme** kanıtı); (6) hesaplanan `fontFamily` `Departure Mono` içerir (AC11'in ikincil, **uygulanma** kanıtı).
- Komut: `npm run e2e` (varsayılan proje `chromium`).

**AC8 — `npm run verify` = typecheck + lint + test + build; tek komut yeşil**
- Komut: `npm run verify` → çıkış kodu 0. Alt adımlar ayrı ayrı da doğrulanabilir. R1 artık
  çözüldü (bkz. §4) — `build` dahil, `e2e` dahil değil.

**AC9 — `.github/workflows/ci.yml` push'ta üç OS'te `npm ci && npm run verify` koşar (B10/B11)**
- **Yerelde zorunlu adım (B10 — `npm ci`'nin gerçekten çalıştığı kanıtlanır):** temiz bir
  klonda (`node_modules` silinip) `npm ci` → çıkış kodu 0 → ardından `npm run verify` → çıkış
  kodu 0. Bu, `package.json`/`package-lock.json` senkronunun bozuk olmadığının **tek** yerel
  kanıtıdır (AC2'nin `npm install` denemesi bunu kapsamaz).
- **`ci.yml` içeriği (B11 — tam tanım, geçici script yok):**
  `on: [push]` · `strategy.matrix.os: [ubuntu-latest, windows-latest, macos-latest]` ·
  `actions/setup-node@v4` ile `node-version: '22'` · adımlar: `npm ci` → `npm run verify`.
  Playwright tarayıcısı CI'a **kurulmaz** (`verify` `e2e` içermez) — bu bilinçli kapsam sınırı
  `ci.yml` içinde bir yorum satırıyla da belirtilir ki ileride "eksik" sanılmasın.
- **Kalıcı doğrulama testi:** `tests/ci-workflow.test.ts` `ci.yml`'i okuyup `on:`, `push`,
  `npm ci`, `npm run verify`, `ubuntu-latest`, `windows-latest`, `macos-latest` dizgelerinin
  literal olarak var olduğunu dizge aramasıyla assert eder. **Geçici/tek kullanımlık YAML
  parse scripti fikri tamamen kaldırılmıştır** (Karpathy kural 2/3 ihlaliydi).
- **Gerçek CI koşusu:** commit push edildikten sonra GitHub Actions'ta üç job'ın da (ubuntu/
  windows/macos) yeşil bittiği gözlemlenir. Push, kullanıcı onayı gerektirir ve **F-001'in
  QA turundan önce** planlanmalıdır (CEO kararı, bkz. dosyanın "CEO kararları" bölümü);
  developer kendi başına remote eklemez, push etmez. **F-001'in GEÇTİ kararı bu gerçek koşuya
  bağlıdır** (bkz. §8).

**AC10 — Koyu tema + tipografi + renk token'ları; boş kabuk; Faz 2 sekmesi yok (B14/B15)**
- **Renk assert'i (B14 — serileştirmeden bağımsız):** sabit bir RGB dizgesine **bağlanmaz**.
  `tests/e2e/shell.spec.ts` içinde:
  ```
  const [bg, token] = await page.evaluate(() => [
    getComputedStyle(document.body).backgroundColor,
    getComputedStyle(document.documentElement).getPropertyValue('--color-zinc-950').trim(),
  ]);
  ```
  `expect(bg).not.toBe('')` + `bg`'nin `token`'la aynı rengi temsil ettiği (aynı normalize
  edilmiş dizge ya da her ikisi parse edilip RGB bileşenleri karşılaştırılarak) doğrulanır.
  Ek güvenlik ağı: hesaplanan rengin **koyu** olduğu (parse edilmiş relative luminance < 0.1)
  ayrıca assert edilir — bu, AC3'ün "beyaz ekran vermez" iddiasını da fiilen kanıtlar.
- Aynı testte: sayfa metninde "Kapılar", "Thread", "Token" dizgeleri **bulunmaz**.
- **`tailwind.config.ts` oluşturulmaz (B15):** Tailwind v4 + `@tailwindcss/vite`'ta tema
  `index.css`'teki `@theme` bloğuyla tanımlanır; ayrı bir config dosyası `@config` ile
  yüklenmedikçe etkisizdir. AC10'daki "Tailwind config'e girilmiş" ifadesi bu sözleşmede
  `@theme` bloğu olarak yorumlanır. `tests/web/theme.test.ts` `index.css` içinde zemin
  (`zinc-950`/`zinc-900`), metin (`zinc-100`/`zinc-400`), vurgu (`amber-400`/`amber-500`)
  token'larının ve üç `--font-*` token'ının statik dizge aramasıyla varlığını doğrular.

**AC11 — Fontlar self-host (YENİ — B13, CEO kararı; çalışma zamanı kanıtı Y2 — tur 2 QA ile düzeltildi)**
- Detaylı plan §3 "Font varlıkları" bölümünde. Doğrulama özeti: `tests/web/theme.test.ts`
  üç `@font-face` kuralının ve üç `--font-*` token'ının `index.css`'te var olduğunu statik
  doğrular. Çalışma zamanı kanıtı iki parçadır (`getComputedStyle(...).fontFamily` tek başına
  yeterli **değildir** — yalnızca CSS bildirimini okur, woff2 404 verse de aynı değeri döner):
  1. **Yükleme kanıtı (birincil):** `tests/e2e/shell.spec.ts` içinde
     `await page.evaluate(async () => { await document.fonts.ready; return
     document.fonts.check('16px "Departure Mono"'); })` → `true` beklenir. `document.fonts.ready`
     tüm `@font-face` isteklerinin (başarılı ya da başarısız) sonuçlanmasını bekler;
     `document.fonts.check()` yalnızca gerçekten **yüklenmiş** bir yüz için `true` döner.
  2. **Uygulanma kanıtı (ikincil, korunuyor):** başlık elemanının hesaplanan `fontFamily`'sinin
     `Departure Mono` içerdiği ayrıca assert edilir — token'ın CSS'e uygulandığını gösterir,
     ama tek başına yükleme kanıtı sayılmaz.
  README lisans notu içerir.

**AC12 — `tests/no-external-host.test.ts` guard'ı geçiyor (YENİ — B13; kapsam Y3 — tur 2 QA ile daraltıldı)**
- Taranan dosyalar **uzantıyla sınırlıdır**: `src/web/**/*.{ts,tsx,css,html}`,
  `src/server/**/*.ts`, `index.html` (glob + `readFileSync`). `src/web/fonts/LICENSE-*.txt` ve
  `*.woff2` dosyaları **taranmaz** — bunlar kod/işaretleme değildir; OFL lisans metni gövdesinde
  harici URL barındırır ve taranırsa guard her koşuda yanlış kırmızı verir. Bu istisna yalnızca
  lisans/ikili varlık dosyalarına özeldir; `.ts`/`.tsx`/`.css`/`.html` kapsamı
  **daraltılmamıştır** — S1'in koruduğu yüzey aynı kalır.
- `127.0.0.1`/`localhost` dışında bir `http://`/`https://` literali veya `fonts.googleapis.com`/
  `fonts.gstatic.com`/`cdn.` alt-dizgesi bulunursa test kırılır. Bu test kalıcıdır ve S1'in
  ("kodda hiçbir dış hostname yok") F-001 kapsamındaki otomatik kanıtıdır.

**AC13 — README'de Windows + macOS kurulum/çalıştırma adımları var (B16)**
- Statik doğrulama: `README.md` içinde platform bazlı bölümler + en az şu komutlar geçer:
  `npm install`, `npm run dev`, `npm start`, `npm run verify`, `MC_PORT` set etme örneği
  (Windows/macOS), `npx playwright install chromium` (B16 eklentisi), Node ≥ 20.11 gereksinimi
  (B16), `data/` klasörünün `.gitignore`'lu olduğu notu (B16), `npm run e2e`'nin `verify`'a
  dahil **olmadığı** ve commit öncesi elle çalıştırılması gerektiği notu (B16/E4), font lisans
  notu (OFL, §3).
- Kanıt: dizge araması ile tüm maddelerin README içinde geçtiği gösterilir.

**Ek (AC listesinde yok ama mimari zorunlu — risk y3, `docs/02-architecture.md` §15):**
`src/server/index.ts` açılışta `process.version`'ı kontrol eder; Node < 20.11 ise stderr'e
Türkçe okunabilir hata basıp `process.exit(1)` yapar. Test: `tests/server/health.test.ts`
içinde bu kontrolü yapan saf fonksiyon (`isSupportedNodeVersion(version: string): boolean`)
birim testiyle (≥4 vaka: `20.11.0` ✓, `20.10.9` ✗, `22.0.0` ✓, `18.19.0` ✗) doğrulanır —
gerçek süreci öldürüp yeniden başlatmak yerine mantığı saf fonksiyona çıkarmak test edilebilir
kılar.

---

## 6. Ortam gereksinimleri

- **Node sürümü:** ≥ 20.11 (mimari risk y3). `package.json` `engines.node: ">=20.11"`. CI
  `actions/setup-node@v4` ile Node 22 kurar (AC9).
- **İşletim sistemi:** Geliştirme ve bu sözleşmenin yerel doğrulaması **Windows**'ta yapılır
  (bu oturumun makinesi). macOS ve Linux'un **gerçek** doğrulaması artık dolaylı değil — CI
  matrisinin (`ubuntu-latest`, `windows-latest`, `macos-latest`) her push'ta `npm ci && npm run
  verify` çalıştırması ile sağlanır (B2). Push öncesi bu iki platform **doğrulanmamış** sayılır.
- **Playwright tarayıcı kurulumu:** `npx playwright install chromium` yalnızca Chromium. Bu
  adım `npm install`'a dahil değildir; README'de ayrı bir adım olarak belirtilir (AC13). CI'da
  yalnızca `npm run verify` çalıştığı için (AC9, e2e dahil değil) CI'ın Playwright tarayıcısı
  **indirmesine gerek yoktur**.

---

## 7. Riskler, bilinmeyenler ve planlı iş

| # | Risk / iş | Durum |
|---|---|---|
| R1 | `verify` tanımı çelişkisi | **ÇÖZÜLDÜ.** Mimari §12 düzeltildi (CEO); `build` dahil, `e2e` dahil değil. |
| R2 | AC6 web bileşen testi `renderToStaticMarkup` ile, gerçek DOM etkileşimi test etmiyor | **KABUL, koşullu** (bkz. §5 AC6). Gerçek DOM altyapısı **planlı iş** olarak F-003'e taşındı (aşağıda). |
| R3 | macOS gerçek doğrulaması bu Windows ortamında yapılamıyor | **Kısmen azaltıldı.** CI matrisi (B2) macOS/Linux'u push sonrası gerçek şekilde doğrular; push öncesi hâlâ doğrulanmamış (bkz. §8). |
| R4 | `npm ci && npm run verify`'ın gerçek CI koşusu push'a bağlı; push kullanıcı onayı gerektirir | Push, CEO/kullanıcı onayıyla **F-001 QA turundan önce** planlanır (CEO kararı). Onay gelmeden F-001 GEÇTİ alamaz (bkz. §8). |
| R5 | Ortak kabukta Faz 1 sekme etiketlerinin "statik/tıklanamaz" gösterimi yorum farkına açık | AC7'nin "tıklanabilir öğe = 0" assert'i bu kararı otomatik kanıtlıyor artık; qa-evaluator farklı isterse fix turunda `App.tsx`'ten kaldırılır. |
| R6 | `esbuild` önceden derlenmiş ikili indirir; kısıtlı ağlarda indirme başarısız olabilir | S2 ihlali değil (derleme yok). README'ye "ilk kurulum internet gerektirir" notu eklenir. |
| R7 | Playwright Chromium indirmesi büyük (~300 MB), yavaş bağlantıda zaman aşımı riski | 3 denemeden sonra tıkanırsa `docs/blockers.md`'ye yazılır, kod turunda durulur. |
| R8 (E1) | Windows'ta `concurrently`+`tsx watch` süreç ağacı Ctrl+C'de yetim kalabilir, port tutulu kalabilir | B5'in efemeral port kararı testleri korur; README'ye sorun giderme satırı eklenir (`netstat -ano | findstr 7333` → `taskkill /PID <pid> /F`). Bootstrap `EADDRINUSE` için Türkçe mesaj basar (mimari §15), kod incelemesiyle kanıtlanır. |
| R9 (E4) | `npm run e2e` hiçbir zaman CI'da koşmuyor → zamanla çürüyebilir | Bilinçli karar (§6). Kural: her feature'ın bitiş kanıtına `npm run e2e` çıktısı **yerelde, QA turunda** dahildir (AC13 README notu bunu hatırlatır). |
| R10 (E5) | `data/` klasörü taze klonda hiç oluşmaz | F-001 hatası değil (sunucu `data/`'yı kullanmıyor); F-002'nin ilk işi olarak §1'e not düşüldü. |

**Planlı iş (risk değil — R2'nin karşılığı, §7 kaydı):** F-003 (SSE zaman çizelgesi, ilk
etkileşimli ekran) sözleşmesi `jsdom` + `@testing-library/react` için bir **ADR taslağıyla**
açılmak zorundadır. F-002 tamamlandığında CEO bu taahhüdü F-003 brief'ine ekler.

---

## 8. Bitti tanımı

Yerelde: `npm run verify` (typecheck + lint + test + build) sıfır hatayla biter; `npm run e2e`
(prod config, `chromium` projesi) **ve** `npm run e2e:dev` (dev config, ayrı dosya — Y1, tur 2
QA) ikisi de sıfır hatayla biter; temiz bir klonda `npm ci` → çıkış 0 → `npm run verify` →
çıkış 0 (B10); 13 kabul kriterinin tamamı §5'teki somut komutlarla yeşil; `git log` ilk
commit'i, `git status --porcelain` boş çıktıyı gösterir.

**Push sonrası (ayrı, kullanıcı onaylı adım — B2/B10/R4):** GitHub Actions'ta üç OS'lik
matrisin (`ubuntu-latest`, `windows-latest`, `macos-latest`) tamamı yeşil biter. **F-001'in
nihai GEÇTİ kararı bu gerçek CI koşusuna bağlıdır** — yerel `verify`/`ci`/`e2e` yeşil olsa
bile push ve CI koşusu tamamlanmadan F-001 GEÇTİ ilan edilemez; bu durumda feature notu en
fazla "yerel doğrulama tamam, CI koşusu bekleniyor" ara durumunda tutulur.

Onay kaydı: bu dosyanın "QA sözleşme denetimi — tur 3" bölümü.

---

## 9. Dosya sahipliği

§2'deki liste — `docs/features/F-001-iskelet.md` "Dosya sahipliği" bölümüyle aynı küme, artı
üç küçük config dosyası (`.gitattributes`, font varlık dosyaları `src/web/fonts/**`,
`playwright.dev.config.ts` — Y1, tur 2 QA revizyonu) ki üçü de mevcut kapsamların (config
dosyaları / `src/web/**` / E2E config) doğal bir parçasıdır, kapsam sızması sayılmaz (bkz. QA
denetimi "Kapsam sızması: YOK" bulgusu). Bunun dışına (ör. `src/features/**`,
`src/server/http/**`, `src/server/write-gate.ts`) bu feature'da çıkılmaz.

---

## QA sözleşme denetimi — 2026-09-04

Denetleyen: `qa-evaluator` · Denetlenen sürüm: bu dosyanın 1–339. satırları (developer, `status: draft`).
Bu bir **kod QA'si değildir**: kod yok, uygulama çalıştırılmadı, Playwright çalıştırılmadı.
Yalnızca sözleşme metni ile `docs/features/F-001-iskelet.md`, `docs/02-architecture.md`,
`docs/approvals/G2.ok`, `docs/03-ux.md` ve `C:\dev\app-factory\docs\PROCESS.md` §5 karşılaştırıldı.

### Karar: DÜZELTME İSTENİYOR

Gerekçe özeti: sözleşme kapsam ve dışlama tarafında güçlü (§1 ve §2 örnek niteliğinde), ama
**doğrulama planı (§5) üç yerde ölçülemez, üç yerde de büyük olasılıkla yanlış ölçüyor.** AC3
açıkça "developer elle bir kere doğrular" diyor (PROCESS §5'in "nasıl doğrulanır" şartını
karşılamaz), AC4'ün tek gerçek kanıtı `test.skip`'e düşebiliyor, AC10'un "tipografi" yarısı
hiç doğrulanmıyor ve renk iddiası Tailwind v4'te muhtemelen hiç eşleşmeyecek bir dizgeye
bağlanmış. Ayrıca AC2'nin kanıtı (`hasInstallScript` boş dönmeli) kendi bağımlılık listesiyle
çelişiyor. Bunlar kod yazıldıktan sonra fark edilirse en az bir tam QA turu kaybettirir —
sözleşme turunun varlık sebebi tam olarak budur.

Sözleşmeyi ben yeniden yazmadım. Aşağıdaki B1–B16 düzeltilip `status: draft` → yeniden QA'ye
gönderildiğinde onaylanacaktır. Kod, bu düzeltmeler yapılmadan **başlamamalıdır**.

---

### AC eşleştirme tablosu

| AC | Sözleşmedeki doğrulama (satır) | Yeterli mi |
|---|---|---|
| AC1 — `git init` + ilk commit + `.gitignore` 3 desen | §5 satır 177-181: `git log --oneline -1`, `git status`, 3× `findstr` | **Kısmen** — komutlar somut; ilk commit'in **içeriği** tanımsız, `.gitignore` Playwright çıktılarını kapsamıyor → B12 |
| AC2 — `npm install` native derlemesiz (Win + macOS) | §5 satır 183-193: exit 0 + `findstr /I "gyp MSBUILD"` boş + `hasInstallScript` boş | **HAYIR** — `hasInstallScript` kontrolü kendi listesiyle çelişiyor (esbuild/playwright) → B1; macOS ayağı hiç doğrulanamıyor → B2 |
| AC3 — `npm run dev` iki süreci kaldırır, beyaz ekran yok | §5 satır 195-206: E2E prod modunu kullanıyor, `dev` **elle** doğrulanıyor | **HAYIR** — kriterin kendisi (dev modu) hiç otomatik test edilmiyor; `/api` proxy'si hiç doğrulanmıyor → B3 |
| AC4 — `MC_PORT` okunur, vars. 7333, yalnızca 127.0.0.1 | §5 satır 208-224: sabit 7333'e bind, 18333 ile ikinci örnek, `os.networkInterfaces()` + `test.skip`, kaynak dizge taraması | **HAYIR** — `skip` "geçti" sayılamaz; sabit 7333'e bind eden test kırılgan; "7333 reddeder" iddiası mantıksız → B4, B5 |
| AC5 — `/api/health` 200 + JSON (`ok`, `version`, `uptime`) | §5 satır 226-232: status/content-type/3 alan tip kontrolü | **Kısmen** — komut somut ve iyi; `uptime` → `uptime_s` sapması tek taraflı çözülmüş, zarf (`ApiResponse`) belirsiz, `version` kaynağı tanımsız → B6 |
| AC6 — Vitest + ≥1 sunucu + ≥1 web bileşen testi | §5 satır 234-238: `npm test`, ≥2 dosya, 0 fail | **Evet, koşullu** — `renderToStaticMarkup` F-001 için yeterli (bkz. R2 kararı), ama koşul yazılmalı → B7 |
| AC7 — Playwright E2E: panel açılır, başlık, konsol hatası yok | §5 satır 240-246: 3 assert + `webServer` | **Kısmen** — üç assert doğru kurgulanmış; `webServer` tanımı sözleşme içinde 3 farklı yerde 2 farklı şekilde yazılmış; statik servis 404 davranışı ve tarayıcı projesi tanımsız → B8, B9 |
| AC8 — `npm run verify` = typecheck+lint+test+build | §5 satır 248-250: `npm run verify` exit 0 + alt adımlar | **Evet** — komut somut. Ancak R1 çelişkisi belgede bırakılmış, karara bağlanmamış → R1 kararı aşağıda |
| AC9 — CI push'ta `npm ci && npm run verify` | §5 satır 252-263: geçici YAML parse scripti + dizge araması + gerçek koşu push'a bağlı | **HAYIR** — `npm ci` **hiçbir yerde çalıştırılmıyor** (AC'nin komutunun yarısı hiç denenmiyor); geçici script gereksiz karmaşıklık; Node sürümü/matris tanımsız → B10, B11 |
| AC10 — koyu tema + **tipografi** + renk token'ları; boş kabuk; Faz 2 sekmesi yok | §5 satır 265-277: `backgroundColor === rgb(9,9,11)`, "Kapılar/Thread/Token" yok, `index.css` dizge araması | **HAYIR** — tipografi hiç doğrulanmıyor ve font kaynağı hiç planlanmamış (S1 ihlali riski) → B13; renk iddiası Tailwind v4'te muhtemelen eşleşmez → B14; `tailwind.config.ts` v4'te ölü konfigürasyon → B15 |
| AC11 — README Windows + macOS | §5 satır 279-284: 5 komut için dizge araması | **Evet** — somut ve tekrar üretilebilir. Küçük ekleme önerisi B16 |

Sonuç: 11 kriterden **3'ü yeterli**, 3'ü kısmen, **5'i yetersiz**.

---

### Bulgular

Şiddet: **K** = kritik (kod başlamadan düzeltilmeli) · **O** = orta (düzeltilmeli, tartışılabilir) · **D** = düşük (not).

**B1 (K) — AC2'nin `hasInstallScript` kanıtı kendi bağımlılık listesiyle çelişiyor.**
· Sorun: §5 satır 187-189 `findstr /C:"hasInstallScript" package-lock.json` çıktısının **boş** dönmesini şart koşuyor. §3'teki liste `tsx` (→ `esbuild`), `vite` (→ `esbuild`) ve `@playwright/test` (→ `playwright`) içeriyor; bu paketlerin npm dağıtımları önceden derlenmiş ikiliyi yerleştirmek için install/postinstall script'i taşır (? INFERRED — `npm install` sonrası doğrulanmalı, ama mimari §3.2 zaten "esbuild önceden derlenmiş ikili indirir" diyerek bunu kabul ediyor).
· Neden önemli: kanıt olduğu gibi çalıştırılırsa AC2 **yanlış nedenle kırmızı** verir; developer kod turunda bu kanıtı gevşetmek zorunda kalır ve S2 sınırı ölçüsüz hale gelir. G2'nin yasağı **derleme**dir, ikili indirme değildir (§3.2 açık).
· İstenen düzeltme: kanıt "hiç install script'i olmasın" değil, "install script'i olan paketler **bilinen ve derleme yapmayan** kümede olsun" biçiminde yazılsın. Somut: `tests/deps.test.ts` içinde `package-lock.json` okunup `hasInstallScript: true` olan paket adları toplanır ve `new Set(['esbuild','@esbuild/*','playwright','@playwright/test'])` beyaz listesine karşı assert edilir; liste dışı bir ad çıkarsa test kırılır. Ayrıca gerçek native göstergesi ayrı assert edilsin: lock içinde `node-gyp`, `prebuild-install`, `node-addon-api`, `nan` **hiç geçmemeli** ve `better-sqlite3` **hiç geçmemeli**. Bu, mimari §11.4c'nin (bağımlılık beyaz liste testi) F-001'e uyarlanmış hâlidir ve zaten kalıcı test olarak `tests/` altında kalmalıdır.

**B2 (O) — AC2'nin macOS ayağı için "dolaylı kanıt" yeterli değil; ucuz bir gerçek kanıt var.**
· Sorun: §5 satır 190-193 ve R3 (satır 319) macOS'u "bu turda doğrulanamaz" ilan ediyor; kanıt olarak README'deki bir cümle ve Linux CI öneriliyor.
· Neden önemli: AC2 metni Windows **ve** macOS diyor. "README'de yazıyor" bir kanıt değildir; bir iddiadır. Kabul kriterini yazının kendisiyle kapatmak, ölçülemeyen kriteri kabul etmektir.
· İstenen düzeltme: `ci.yml` bir matris kullansın: `strategy.matrix.os: [ubuntu-latest, windows-latest, macos-latest]`, her birinde `npm ci && npm run verify`. Bu AC9'u ihlal etmez (komut aynı), macOS'ta `npm install`/`npm ci`'nin derlemesiz tamamlandığının **gerçek** kanıtını üretir ve maliyeti sıfırdır. Sözleşme şunu yazsın: "AC2'nin macOS ayağı, CI'ın macos-latest job'ı yeşil olduğunda kanıtlanmış sayılır; push öncesinde AC2 **açıkça yarım** işaretlenir ve F-001 bu hâliyle GEÇTİ ilan edilemez." Bu, R4 ile birlikte tek bir kullanıcı onayına (push) bağlanır.

**B3 (K) — AC3 elle doğrulanıyor; kriterin kendisi hiç otomatik test edilmiyor.**
· Sorun: §5 satır 197-203 E2E'nin `dev` yerine prod modunu kullanacağını söylüyor ve `npm run dev`'in doğrulamasını "developer kod turunda logda banner görür" cümlesine bırakıyor. Satır 203'te "elle bakılmaz" deniyor ama tarif edilen şey tam olarak elle bakmaktır: gözlemi yapan kişi, sonucu rapor eden kişiyle aynı ve tekrar üretilebilir bir komut yok.
· Neden önemli: PROCESS §5 sözleşmeden "nasıl doğrulanır"ı ister; QA turunda bu maddeyi ben tekrar çalıştıramam. Ayrıca AC3 iki süreçli modun **entegrasyonunu** (Vite'ın `/api` proxy'si) test eden tek kriterdir ve sözleşme proxy'yi hiç doğrulamıyor — oysa `vite.config.ts` proxy'si §2'de dosya amacı olarak yazılı.
· İstenen düzeltme (iki seçenekten biri, developer seçsin):
  (a) Playwright'a ikinci bir proje: `playwright.config.ts` içinde `projects: [{name:'prod',...}, {name:'dev', use:{baseURL:'http://127.0.0.1:7334'}}]` ve dev projesi için `webServer: { command: 'npm run dev', url: 'http://127.0.0.1:7334', reuseExistingServer: false }`. `tests/e2e/dev-shell.spec.ts`: (1) `page.goto('/')` → başlık görünür, (2) `body` metni boş değil, (3) `expect((await request.get('http://127.0.0.1:7334/api/health')).status()).toBe(200)` — **proxy'nin kanıtı**, (4) `http://127.0.0.1:7333/api/health` doğrudan 200 — **API sürecinin kanıtı**. Playwright süreç ağacını kendisi kapatır (Windows'ta bu önemli, bkz. B12/R-yeni).
  (b) `tests/dev-smoke.test.ts` (vitest, `testTimeout: 60_000`): `spawn('npm', ['run','dev'], {shell:true})` → 30 s içinde 7334 ve 7333'ten 200 alınana kadar poll → `tree-kill` yerine `child.kill()` + port serbest kalana kadar bekleme. Bu seçenek Windows'ta süreç ağacı temizliği yüzünden daha kırılgandır; (a) tercih edilmelidir.
· Ayrıca: bu test `verify` içinde değil `e2e` içinde koştuğu için CI'ı yavaşlatmaz; sözleşme AC3'ün kanıtının `npm run e2e` çıktısı olduğunu yazsın.

**B4 (K) — AC4'ün "yalnızca 127.0.0.1" kanıtı `skip`'e düşebiliyor; `skip` geçti sayılamaz.**
· Sorun: §5 satır 216-221: uygun LAN arayüzü yoksa alt-test `test.skip` ile atlanıyor. Bu makinede (tek geliştirici Windows'u, VPN/kapalı adaptör senaryoları) atlanma gerçek bir olasılıktır.
· Neden önemli: AC4 bu projenin **birinci güvenlik sınırıdır** (S1, mimari §1 ve §10). Atlanan bir test, kriteri kanıtlamaz; "yeşil" görünen bir çıktı üretir. Bu tam olarak fabrika kuralının "görüntü olan özellik" tanımıdır.
· İstenen düzeltme: kanıt üç katmanlı ve **birinci katmanı deterministik** olsun:
  1. **Zorunlu, ağ gerektirmez:** sunucu bir fabrika fonksiyonundan (`createServer()` / `startServer(port)`) dönsün ve test `server.address()` sonucunu doğrudan assert etsin: `expect(server.address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' })`. Bu, `listen`'in **etkin** bind adresini ölçer; dizge araması ölçemez (`listen(port)` tek argümanlı çağrı da dizge aramasından geçer ama `0.0.0.0`'a bağlanır).
  2. **Zorunlu, statik guard:** mimari §11.4b'nin F-001 alt kümesi — `src/**/*.ts(x)` taranır; `0.0.0.0`, `MC_HOST`, `::` bind literali ve 127.0.0.1 dışı `http://` literali bulunursa test kırılır. (Sözleşmenin satır 221-224'teki `readFileSync + includes` fikri buraya taşınsın, ama tek dosya yerine `src/**` taransın ve **negatif** iddia olarak yazılsın.)
  3. **Opsiyonel, entegrasyon:** LAN IPv4 varsa `net.connect` reddi. `skip` olursa test raporunda "çalışmadı" olarak görünür ve **AC4'ün geçmesine katkı sağlamaz**; sözleşme bunu açıkça yazsın.

**B5 (O) — AC4'ün port testleri kırılgan ve bir iddiası mantıksız.**
· Sorun: §5 satır 209-215 varsayılan portu kanıtlamak için gerçekten 7333'e bind ediyor; ayrıca "18333 örneği için 7333 bağlantı reddeder" diyor. Birincisi: geliştirici `npm run dev`'i açık bırakmışsa (bu iskelet turunda çok olası) test `EADDRINUSE` ile kırılır — testin kırılma nedeni kriterle ilgisiz olur. İkincisi: bir süreç 18333'e bağlıyken 7333'ün durumu makine genelinde başka bir sürece bağlıdır; bu iddia o örnek hakkında hiçbir şey kanıtlamaz ve başka bir sunucu açıksa **yanlış kırmızı** verir.
· Neden önemli: kırılgan kanıt, ilerideki her feature'da rastgele kırmızı üretir ve QA sinyalini zehirler.
· İstenen düzeltme: port çözümlemesi saf fonksiyona çıkarılsın (`resolvePort(env: NodeJS.ProcessEnv): number`) ve birim testle kanıtlansın: `{}` → 7333 · `{MC_PORT:'18333'}` → 18333 · `{MC_PORT:'abc'}` → tanımlı davranış (varsayılana düş **veya** okunabilir Türkçe hata — sözleşme hangisi olduğunu **seçsin**) · `{MC_PORT:'0'}` → tanımlı davranış. Entegrasyon testi ise **port 0** (efemeral) ile başlatılsın ve `server.address().port` üzerinden `/api/health` çağrılsın. "7333 reddeder" iddiası tamamen çıkarılsın. Böylece AC4'ün "varsayılan 7333" yarısı deterministik birim testiyle, "MC_PORT okunur" yarısı hem birim hem entegrasyonla kanıtlanır ve hiçbir test sabit porta bağlanmaz.

**B6 (O) — AC5: `uptime` / `uptime_s` sapması tek taraflı çözülmüş, zarf ve `version` kaynağı tanımsız.**
· Sorun (üç parça):
  (a) Satır 230-232 mimarideki `uptime_s`'i seçiyor. Ama §4 satır 149-152 tam tersi kuralı ilan ediyor ("daha spesifik olan feature notu esas alınır"). Sözleşme aynı belgede iki zıt çakışma-çözme kuralı uyguluyor.
  (b) Mimari §6 tüm `/api` uçları için `ApiResponse<T>` zarfı tanımlıyor (`{success, data}`), §6.6 ise health'i **düz** obje olarak gösteriyor. Sözleşme `body.ok === true`'yu düz kabul ediyor ama bu tercihi gerekçelendirmiyor.
  (c) `version` alanının kaynağı hiç yazılmamış (package.json okuma? sabit? `import pkg from '../../package.json' with {type:'json'}`?). Bu, `tsc --noEmit` ve `tsx` altında farklı davranan bir karardır (`resolveJsonModule`, `module: NodeNext` import attribute'ları).
· Neden önemli: F-002 `/api/events`'i yazarken zarf kararını tekrar tartışmak zorunda kalır; `version` kaynağı seçilmezse typecheck kod turunda patlar (istenmeyen sürtünme, B15'le aynı sınıf).
· İstenen düzeltme: (a) sözleşme **tek** çakışma-çözme kuralı ilan etsin ("alan adları/API sözleşmesi = mimari; kapsam ve bitiş kriteri = feature notu") ve `uptime_s`'i bu kurala dayandırsın; ayrıca CEO'ya not düşülsün: `docs/features/F-001-iskelet.md` AC5 metnindeki `uptime` → `uptime_s` olarak düzeltilsin ki kriter ile kod aynı şeyi söylesin. (b) Health'in zarf **dışında** olduğu açıkça yazılsın (gerekçe: readiness probe'u; §6.6 birebir bu formatı gösteriyor) ve F-001'in döneceği alan kümesi sabitlensin: `{ ok, version, port, node, uptime_s }` — §6.6'nın kalan alanları ilgili feature'larda eklenecek. (c) `version` kaynağı seçilsin ve tsconfig ayarı (`resolveJsonModule: true`) §2'de not edilsin.

**B7 (D/koşullu) — AC6 yaklaşımı kabul, ama koşulu ve iki teknik ayrıntısı yazılmalı.**
· Sorun: R2'nin (satır 318) kararı sözleşmede askıda bırakılmış ("qa-evaluator yetersiz bulursa…"). Ayrıca vitest `environment: 'node'` altında `.tsx` derlemesi ve olası `import './index.css'` zinciri hiç konuşulmamış.
· İstenen düzeltme: aşağıdaki "R2 kararı"nı sözleşmeye koşullarıyla birlikte yazın; ek olarak (1) `App.tsx` **CSS import etmesin** (CSS girişi `main.tsx`'te kalsın) ki node ortamındaki bileşen testi CSS çözümlemesine bağımlı olmasın, (2) `vitest.config.ts` `environment: 'node'` + `esbuild.jsx` ayarının React 19 `react-jsx` dönüşümüyle uyumlu olduğu ilk testte kanıtlansın.

**B8 (O) — `playwright.config.ts` `webServer` tanımı sözleşmede üç yerde iki farklı şekilde yazılmış.**
· Sorun: §2 satır 67 → "`webServer` ile `npm run build && npm start`"; §4 satır 163 → "config `webServer` ile build+start'ı kendisi tetikler"; §5 satır 241-242 → `command: 'npm start'` ve build ayrı elle (`npm run build && npm run e2e`).
· Neden önemli: `npm start` `dist/web`'i servis eder; build yapılmamışsa E2E, "beyaz ekran" veya 404 ile kırılır ve bu, AC7'nin kırılma nedenini gizler. Ayrıca bu belirsizlik CI'a alınırsa `npm run e2e` tek başına çalışmaz.
· İstenen düzeltme: tek tanım seçilsin — `webServer: { command: 'npm run build && npm start', url: 'http://127.0.0.1:7333/api/health', reuseExistingServer: false, timeout: 120_000 }`. Readiness URL'i olarak `/api/health` kullanılsın (mimari §6.6 bunu açıkça readiness sinyali ilan ediyor). Üç yer bu tanımla hizalansın.

**B9 (O) — E2E'nin iki kırılma tuzağı tanımsız: tarayıcı projeleri ve statik servisin 404 davranışı.**
· Sorun (a): sözleşme `npx playwright install chromium` diyor (§6, satır 304-305) ama `playwright.config.ts`'in **yalnızca** chromium projesi tanımlayacağı yazılmamış. Playwright'ın varsayılan iskeleti üç tarayıcı projesi üretir; kurulmamış firefox/webkit yüzünden `npm run e2e` kırılır.
· Sorun (b): `src/server/index.ts`'in statik servis davranışı hiç tanımlanmamış: bilinmeyen yol için 404 mü, SPA fallback (`index.html`) mı? MIME eşlemesi? Bu doğrudan AC7'nin "konsol hatası yok" assert'ini etkiler — tarayıcının kendiliğinden istediği `/favicon.ico` gibi kaynaklar için üretilen 404'ler Chromium konsoluna hata olarak düşebilir (? INFERRED — kod turunda ampirik doğrulanmalı) ve `expect(consoleErrors).toEqual([])` **ürün hatası olmadan** kırmızı verir.
· İstenen düzeltme: (a) config'de tek proje: `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`. (b) Statik servis sözleşmesi §2/§5'te yazılsın: bilinen uzantılar için MIME + `/` → `index.html`; bilinmeyen yol → **404** (SPA fallback F-003'te router gelince eklenir, şimdi gerekmiyor); ve `src/web/favicon.svg` (veya `.ico`) **ship edilsin**, `index.html` bunu link'lesin. Alternatif olarak "console error filtresi" **kabul edilmez** — assert'i gevşetmek yerine kaynağı düzeltin.
· Ek: `consoleErrors` toplayıcısı `page.goto`'dan **önce** bağlanmalı ve `page.on('pageerror')` de toplanmalı (yakalanmamış JS istisnası `console` olayı üretmez). Sözleşme bunu yazsın.

**B10 (K) — AC9'un komutunun yarısı (`npm ci`) hiçbir yerde çalıştırılmıyor.**
· Sorun: §5 AC9 yalnızca `ci.yml` **metnini** doğruluyor; `npm ci`'nin bu depoda çalıştığı hiç denenmiyor. §5 AC2 ise `npm install` kullanıyor.
· Neden önemli: `npm ci`, `package.json` ile `package-lock.json` senkron değilse **hata verip durur**. İskelet feature'ında paket ekleyip lock'u yenilememek en sık yapılan hatadır ve tek belirtisi CI'ın kırmızı olmasıdır — bizim CI'ı çalıştıramadığımız bir turda bu hata sessizce "done" olur.
· İstenen düzeltme: §5 AC9'a zorunlu yerel adım eklensin: temiz bir dizine `git clone` (veya `node_modules` silinerek) → `npm ci` → exit 0 → ardından `npm run verify` → exit 0. Kanıt: iki komutun çıkış kodu. Bu, AC9'un yerelde kanıtlanabilir kısmının tamamıdır; gerçek Actions koşusu R4 kapsamında push onayına bağlı kalır ve **F-001'in GEÇTİ kararını bloke eder** (B2 ile aynı push'a bağlanır).

**B11 (O) — `ci.yml` içeriği eksik tanımlı; ayrıca geçici doğrulama scripti gereksiz.**
· Sorun: satır 254-258 YAML'ı parse eden, çalıştırılıp **silinecek** bir Node scripti öneriyor. Bu, CLAUDE.md "Karpathy kuralı 2/3" ile çelişir (tek kullanımlık araç + sonra ölü kod temizliği). Ayrıca workflow'un Node sürümü, `actions/setup-node` adımı, cache ve OS matrisi hiç tanımlanmamış.
· İstenen düzeltme: geçici script fikri tamamen çıkarılsın; kalıcı `tests/ci-workflow.test.ts` `ci.yml` dosyasını okuyup `on:`/`push`, `npm ci`, `npm run verify` dizgelerini assert etsin (mimari §11.4 tarzı statik guard testi — kalıcı ve ucuz). Workflow şu unsurları içersin ve sözleşmede yazılsın: `on: [push]` · `strategy.matrix.os: [ubuntu-latest, windows-latest, macos-latest]` (B2) · `actions/setup-node@v4` ile `node-version: '22'` (veya `engines` ile uyumlu ≥20.11) · `npm ci` · `npm run verify`. Playwright tarayıcısı CI'a **kurulmaz** (e2e verify'da değil) — bu bilinçli karar §6'da zaten var, `ci.yml` yorum satırında da yazılsın ki gelecekte kaza eseri "eksik" sanılmasın.

**B12 (O) — `.gitignore` eksik; ilk commit'in içeriği tanımsız.**
· Sorun: §2 satır 71 `.gitignore` için "en az `node_modules/`, `dist/`, `data/`" diyor. Playwright çalıştıktan sonra kökte `test-results/` ve `playwright-report/` oluşur; `.gitignore`'a girmezse AC1'in `git status` "clean" iddiası **`npm run e2e` çalıştırılır çalıştırılmaz** bozulur. Ayrıca ilk commit'in neyi içereceği (özellikle `docs/` — bu klasör şu an tamamen versiyonsuz, bkz. `docs/progress.md`) yazılmamış.
· İstenen düzeltme: `.gitignore` = `node_modules/`, `dist/`, `data/`, `test-results/`, `playwright-report/`, `.env*`, `*.local`. AC1'in kanıtı şu hâle gelsin: `git status --porcelain` **boş** + `git ls-files docs/features/F-001-iskelet.md` dolu (yani `docs/` versiyonlanmış) + üç zorunlu desen için `findstr`. İlk commit kapsamı sözleşmede bir cümleyle yazılsın: "tüm depo (docs/ dahil), yalnızca ignore edilenler hariç".

**B13 (K) — AC10'un "tipografi" yarısı hiç karşılanmıyor ve font kaynağı planlanmamış (S1 ihlali riski).**
· Sorun: AC10 metni "Koyu tema, **tipografi** ve renk token'ları … Tailwind config'e girilmiş" diyor. `docs/03-ux.md` §Tipografi üç fontu **isimle** zorunlu kılıyor: Departure Mono (başlık), IBM Plex Mono (gövde), IBM Plex Sans (uzun metin). Sözleşme §1'de "MISSION CONTROL (Departure Mono)" diye geçiyor ama: §3'te font paketi yok, §2'de font dosyası yok, §5 AC10'da tipografi doğrulaması yok.
· Neden önemli: iki kötü sonuçtan biri kesin. (1) Developer fontu atlar → AC10 kelimesi kelimesine karşılanmaz, QA turunda kırmızı. (2) Developer en kolay yolu seçip `index.html`'e Google Fonts / CDN `<link>` koyar → **S1 ihlali** (mimari §1: "Kodda hiçbir dış hostname yok"; §10: panel dışarıya hiçbir şey göndermez) ve ileride mimari §11.4b guard testi ile PRD F6/AC4 E2E'si bunu kırar. Bu, sözleşmenin **görmediği en pahalı boşluktur**.
· İstenen düzeltme: sözleşme iki yoldan **birini** açıkça seçsin ve gerekçesini yazsın:
  (a) **Self-host:** `src/web/fonts/` altına woff2 dosyaları (lisans notu README'ye), `index.css` içinde `@font-face` + `@theme` token'ları `--font-display`, `--font-mono`, `--font-sans`. Yeni npm bağımlılığı gerekmez (dosya olarak eklenir), `src/web/**` zaten dosya sahipliğinde. Bu G2 kapalı listesini **büyütmez**, ADR gerekmez.
  (b) **Ertele:** F-001'de yalnızca sistem mono yığını (`ui-monospace, SFMono-Regular, Consolas, monospace`) `--font-mono`/`--font-display` token'larına bağlanır; özel fontlar F-003'e bırakılır. Bu durumda **CEO'nun** `docs/features/F-001-iskelet.md` AC10 metnini daraltması gerekir (qa-evaluator kriteri kendi başına gevşetemez).
  Hangisi seçilirse seçilsin, doğrulama somutlaşsın: E2E'de `getComputedStyle(document.querySelector('[data-testid="app-title"]')).fontFamily` beklenen token değerini içerir + `tests/web/theme.test.ts` `index.css` içinde üç `--font-*` token'ının tanımlı olduğunu assert eder.
· **Ek zorunlu guard (ucuz, şimdi yapılmalı):** `tests/no-external-host.test.ts` — `src/web/**` + `src/server/**` + `index.html` taranır; `127.0.0.1`/`localhost` dışında bir `http://`/`https://` literali veya `fonts.googleapis.com`/`cdn.` dizgesi bulunursa test kırılır. S1 iskelette bir satırla korunur ve bir daha hiç gözden kaçmaz.

**B14 (K) — AC10'un renk assert'i Tailwind v4'te büyük olasılıkla eşleşmez.**
· Sorun: satır 267-269 `getComputedStyle(document.body).backgroundColor` değerinin `rgb(9, 9, 11)` olmasını bekliyor. Tailwind v4'ün varsayılan paleti **OKLCH** ile tanımlıdır (`zinc-950` ≈ `oklch(0.141 0.005 285.823)`); Chromium modern renk uzaylarını `rgb()` olarak değil, tanımlandığı uzayla serileştirir (✗ UNCERTAIN — serileştirme ayrıntısı kod turunda ampirik doğrulanmalı; kesin olan, sabit bir RGB dizgesine bağlanmanın kırılgan olduğudur).
· Neden önemli: AC10, temanın gerçekten uygulandığını kanıtlayan **tek çalışma-zamanı** kanıtıdır. Sabit dizgeye bağlanırsa ya yanlış kırmızı verir ya da developer assert'i "içeriyor mu" seviyesine gevşetir ve kriter ölçüsüzleşir.
· İstenen düzeltme: serileştirme biçiminden bağımsız assert kullanılsın. Somut: E2E'de
  `const [bg, token] = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).getPropertyValue('--color-zinc-950').trim()])`
  → `expect(bg).not.toBe('')` ve `expect(bg)` ile `token`'ın **aynı rengi** gösterdiği (aynı string ya da normalize edilmiş karşılaştırma) assert edilsin. Ayrıca ikinci, biçimden tamamen bağımsız bir güvenlik ağı: `document.body`'nin hesaplanan renginin koyu olduğu (parse edilmiş relative luminance < 0.1) doğrulansın. "Boş kabuk beyaz değil" iddiası AC3'ün "beyaz ekran vermez" kriterini de bu sayede fiilen kanıtlar.

**B15 (O) — `tailwind.config.ts` Tailwind v4'te ölü konfigürasyon olacak.**
· Sorun: §2 satır 78 `tailwind.config.ts`'i `content` globs için listeliyor. Tailwind v4 + `@tailwindcss/vite` kurulumunda tema CSS-first (`@theme`) tanımlanır ve içerik taraması otomatiktir; bir JS/TS config dosyası ancak `@config` yönergesiyle **açıkça** yüklenirse etkilidir. Sözleşme `@config`'ten hiç bahsetmiyor ve zaten "tema esas olarak `index.css`'teki `@theme` içinde" diyor.
· Neden önemli: yüklenmeyen bir config dosyası (1) ölü koddur (CLAUDE.md Karpathy 3), (2) AC10'un "Tailwind config'e girilmiş" ifadesi için **sahte kanıt** üretir — dosya var, ama hiçbir etkisi yok.
· İstenen düzeltme: `tailwind.config.ts` oluşturulmasın; token'lar `src/web/index.css` `@theme` bloğunda tanımlansın ve sözleşme "AC10'daki 'Tailwind config' ifadesi v4'te `@theme` bloğuna karşılık gelir" cümlesini açıkça yazsın. (Feature notunun dosya sahipliği listesi bir **üst sınırdır**, zorunluluk değil — dosyayı yazmamak kapsam ihlali değildir, ama sözleşmede gerekçelendirilmelidir.) Eğer developer dosyayı yine de isterse `index.css`'te `@config "../../tailwind.config.ts";` satırı zorunludur ve testle kanıtlanmalıdır.

**B16 (D) — README kontrol listesi biraz dar.**
· İstenen ekleme: AC11 dizge aramasına şunlar da girsin — `npx playwright install chromium` (E2E ön koşulu, §6'da karar verilmiş ama README kontrolünde yok), Node ≥ 20.11 gereksinimi, `data/` klasörünün gitignore'lu olduğu ve `npm run e2e`'nin `verify`'a dahil **olmadığı**, commit öncesi elle çalıştırılması gerektiği notu.

---

### Beş denetim sorusuna kararlar

**R1 — `verify` tanımı çelişkisi: `build` dahil mi?**
**Karar: DAHİL. `verify = typecheck && lint && test && build`. Sözleşmedeki tanım (§4 satır 168) geçerlidir; developer'ın seçimi doğrudur, ama gerekçesi eksiktir.**
Gerekçe (sözleşmedekinden bağımsız, teknik): CI **yalnızca** `verify` koşuyor (AC9). `build` `verify` dışında kalırsa `vite build`'i hiçbir otomatik kapı çalıştırmaz; tip kontrolünden geçen ama bundle edilemeyen bir kod (çözümlenemeyen import, CSS/asset hatası, Tailwind v4 eklenti hatası — B13/B15 tam da bu sınıf) "yeşil" alır ve F-002'de patlar. `build` ayrıca AC7'nin ön koşuludur. Maliyeti birkaç saniyedir.
Ancak sapmayı belgede bırakmak **kabul edilmez**: `docs/02-architecture.md` §12 tablosundaki `npm run verify` satırı `typecheck && lint && test && build` olarak düzeltilmelidir (bu editoryal bir düzeltmedir, mimari bir değişiklik değil; ADR gerektirmez, ama `docs/` düzenlemesi olduğu için CEO yapar). Sözleşme, düzeltme yapılana kadar §12 ile çeliştiğini ve bu QA kararının çelişkiyi kapattığını yazsın. `e2e` `verify`'a **dahil edilmesin** (Playwright tarayıcı indirmesi CI'ı kırılganlaştırır) — bu karar da açıkça yazılsın, B16'daki README notuyla birlikte.

**R2 — Web bileşen testi `renderToStaticMarkup` ile yapılabilir mi?**
**Karar: F-001 İÇİN YETERLİ — ama üç koşulla, ve bu bir kalıcı çözüm olarak kabul edilmez.**
Gerekçe: §1'de tanımlanan kabuk **kasıtlı olarak davranışsız**dır — state yok, event handler yok, effect yok, tıklanabilir öğe yok (B-koşul 3 bunu zorunlu kılıyor). Davranışı olmayan bir bileşende jsdom'un ölçtüğü hiçbir ek şey yoktur; `renderToStaticMarkup` çıktısı bu bileşen için tam kapsamdır. Gerçek DOM/etkileşim tarafını Playwright (gerçek Chromium) zaten karşılıyor ve iskelette E2E maliyeti düşük. Yeni bağımlılık = G2 kapalı listesi + ADR demektir; **davranışsız bir bileşen için ADR açmak orantısızdır** (CLAUDE.md Karpathy 2).
Koşullar (sözleşmeye yazılacak):
1. F-001'in web kabuğunda hiçbir `useState`/`useEffect`/`onClick` bulunmaz; bir tanesi bile gerekiyorsa bu karar **geçersizdir** ve önce ADR gerekir.
2. `tests/e2e/shell.spec.ts` şunu assert eder: üst çubukta tıklanabilir öğe yoktur — `expect(await page.locator('header button, header a, header [role=button]').count()).toBe(0)`. Bu hem R5 kararının hem de "stub buton yok" fabrika kuralının otomatik kanıtıdır.
3. **Gerçek DOM test altyapısı en geç F-003'te (SSE zaman çizelgesi — ilk etkileşimli ekran) gelir.** F-003'ün sözleşmesi `jsdom` + `@testing-library/react` için bir ADR taslağıyla **açılmak zorundadır**; F-002 tamamlandığında CEO bunu F-003 brief'ine koyar. Sözleşme §7'ye bu taahhüt R2'nin karşılığı olarak yazılsın (risk değil, **planlı iş** olarak).
Ayrıca B7'deki iki teknik koşul (App.tsx CSS import etmez; vitest node ortamında tsx/JSX çalışır) eklensin.

**AC4 — `os.networkInterfaces()` + `skip` kanıtı yeterli mi?**
**Karar: YETERSİZ. `skip` durumunda kriter GEÇTİ sayılamaz.** Detay ve önerilen deterministik alternatif B4'te (üç katman: `server.address()` assert'i → `src/**` statik guard → opsiyonel LAN entegrasyonu). Kısaca: birincil kanıt `expect(server.address()).toMatchObject({address:'127.0.0.1', family:'IPv4'})` olmalıdır — ağ gerektirmez, atlanamaz, `listen(port)` tek-argümanlı hatasını da yakalar (dizge araması yakalayamaz). LAN testi yalnızca **ek** kanıttır ve atlandığında raporda "çalışmadı" olarak görünür.

**Bağımlılıklar — 18 paket (2 runtime + 16 dev), 17 değil.**
· **Gereksiz gördüğüm: yok.** Tek tek geçtim; her paket ya G2 §3.4 kapalı listesinde onaylı ya da onun alt kümesi. `concurrently` (§3.4'te açıkça onaylı, alternatifi elle spawn scripti), `tsx` (§3.2 kararı), `@eslint/js` + `typescript-eslint` (flat config için asgari), `prettier` (fabrika `format` komutu) — hepsi yerinde. `chokidar`/`yaml`/`@dnd-kit/core`'un **kurulmaması** doğru karardır ve iyi gerekçelendirilmiştir (§1 satır 33-36); mimari §11.4c bağımlılık testi "liste dışı paket" arar, "listedeki her paket kurulmuş olmalı" demez.
· **Native derleme: yok.** `better-sqlite3`/`node-gyp` sınıfından hiçbir şey yok; `esbuild` (vite/tsx üzerinden) ve `playwright` önceden derlenmiş ikili **indirir**, derlemez — G2/S2 sınırı derlemeyle ilgilidir ve mimari §3.2 bunu açıkça onaylamıştır. **Ancak sözleşmenin kendi AC2 kanıtı bu gerçekle çelişiyor (B1) — düzeltilmeli.**
· **Eksik olanlar:** (1) **Font varlıkları** — paket değil ama AC10'un zorunlu girdisi, hiç planlanmamış (B13, kritik). (2) **Playwright tarayıcı kurulumu** — adım olarak §6'da var, README kontrol listesinde ve `playwright.config.ts` proje tanımında yok (B9, B16). (3) **`package.json` `"type"` alanı kararı yok** — ESM (`"type":"module"`) mi CJS mi olduğu `eslint.config.js`, `vite.config.ts`, `tailwind.config.ts` ve `tsx`'in import çözümlemesini doğrudan belirler; iskelet turlarında en çok zaman kaybettiren tek karar budur ve sözleşmede hiç geçmiyor (bkz. B-ek/E3). (4) Sürüm uyumu: `vitest ^2` ile `vite ^6` peer aralığı **kurulum anında doğrulanmalı** (? INFERRED: Vitest 2 hattının peer aralığı Vite 5 merkezlidir); `npm install` peer uyarısı verirse sözleşme "vitest ve vite majörleri tek bir uyumlu çift olarak seçilir" kuralını uygulasın — bu kapalı listeyi büyütmez, yalnızca aralık seçimidir.
· **Sayı düzeltmesi:** §3 tabloları 2 runtime + 16 dev = **18** paket listeliyor. Sözleşme "17" demiyor ama brief'te öyle geçti; kayıt için netleştirildi.

**Kapsam sızması: YOK.**
· §2'deki 22 dosyanın tamamı `docs/features/F-001-iskelet.md` "Dosya sahipliği" kümesinin içinde. `.prettierignore` → "prettier yapılandırmaları"na girer; `src/web/index.html|main.tsx|App.tsx|index.css` → `src/web/**`; üç test dosyası → `tests/**`. Sınır dışına çıkan hiçbir yol yok.
· Ürün özelliği sızması **yok**: §1'in dışlama listesi (satır 25-38) F-002…F-011'i madde madde kapatıyor; `POST /api/events`, SSE, kanban, kapılar, `write-gate.ts`, chokidar, hash router, global state hepsi açıkça dışarıda. Bu bölüm sözleşmenin en güçlü tarafıdır.
· İki küçük istisna: (1) satır 254-258'deki "geçici doğrulama scripti" dosya sahipliği dışında bir dosya yaratıp siliyor → B11 ile kaldırılsın. (2) B13'ün önerdiği `tests/no-external-host.test.ts` ve B1'in `tests/deps.test.ts`'i `tests/**` içinde kalır, sızma değildir.
· **Bilinçli dışarıda bırakılan ama sözleşmede yazılmayan bir şey var:** mimari §10'un Host/Origin beyaz listesi (DNS rebinding koruması). F-001'de yalnızca `/api/health` olduğu için ertelenmesi savunulabilir, ama **açık bir dışlama olarak §1'e yazılmalıdır** ("Host/Origin koruması F-002'de, ilk yazma ucuyla birlikte gelir") — aksi halde sonraki QA turunda "mimari zorunluluğu atlanmış" diye okunur.

---

### Developer'ın görmediği ek riskler

**E1 — Windows'ta `concurrently` + `tsx watch` süreç ağacı temizliği.** `npm run dev`'i Ctrl+C ile kapatmak Windows'ta alt `node` süreçlerini yetim bırakabilir; port 7333 tutulu kalır ve **sonraki** test/dev koşusu `EADDRINUSE` ile kırılır. B5'in efemeral port önerisi testleri korur; README'ye bir "sorun giderme" satırı eklensin (`netstat -ano | findstr 7333` → `taskkill /PID <pid> /F`). Mimari §15 zaten `EADDRINUSE` için okunabilir Türkçe mesaj istiyor — F-001 bunu uygulasın ve mesajın varlığı `resolvePort`/bootstrap birim testinde değil, en azından kod incelemesinde kanıtlansın.

**E2 — Linux CI'da yalnızca orada çıkan iki hata sınıfı.** (a) Import yolu **büyük/küçük harf duyarlılığı**: Windows'ta `./app` ile `./App` aynıdır, ubuntu-latest'te değildir — CI'ın ilk kırmızısı çoğu zaman budur. (b) CRLF: Windows'ta `core.autocrlf` açıkken çalışma kopyası CRLF olur; bugün `verify` biçim kontrolü içermediği için zararsızdır, ama ileride `prettier --check` eklenirse platforma göre farklı sonuç verir. Öneri: sözleşme `.gitattributes` (`* text=auto eol=lf`) eklenmesini **CEO'ya dosya sahipliği genişletmesi olarak** sorsun (tek satırlık dosya) ya da açıkça "şimdilik eklenmiyor, `verify` biçim kontrolü içermiyor" desin. Karar verilmemiş olması kabul edilemez; hangisi olduğu yazılsın.

**E3 — `package.json` `"type"` ve tek `tsconfig.json`'ın çift hedefi.** Sunucu (Node, `node:http`, `@types/node`) ile web (DOM lib, JSX) tek tsconfig'i paylaşacaksa `lib: ["ES2022","DOM"]` olur ve sunucu kodunda `document` kullanmak **typecheck'ten geçer** — S1/S4 açısından zararsız ama sessiz bir tuzak. Mimari §4 "tek tip kontrolü" diyor, feature notu `tsconfig*.json` (çoğul) diyor. Öneri: tek `tsconfig.json` + `references`/`projects` karmaşasına girmeden, `src/server/**` için ayrı bir `tsconfig.server.json` **gerekmediği** açıkça yazılsın veya iki config seçilsin; ve `"type": "module"` kararı yazılsın (bunu seçmemek `eslint.config.js`'in yüklenmesini ve `vite.config.ts`'in import biçimini belirsiz bırakır).

**E4 — `npm run e2e` hiçbir zaman CI'da koşmuyor → E2E çürümesi.** Bilinçli karar (§6) ve F-001 için kabul ediyorum, ama bir tetikleyici tanımlanmalı: sözleşme "her feature'ın bitiş kanıtına `npm run e2e` çıktısı dahildir (yerelde, QA turunda)" cümlesini yazsın; aksi halde 3 feature sonra hiç çalıştırılmamış bir E2E takımıyla kalırız.

**E5 — `data/` klasörü klonda hiç oluşmaz.** `.gitignore`'lu olduğu için taze klonda `data/` yoktur. F-001 sunucusu `data/`'yı kullanmıyor, dolayısıyla bu bir F-001 hatası değildir — ama F-002'nin ilk işi `MC_DATA_DIR`'i `mkdir -p` etmektir. Sözleşme §1 dışlama listesine bir satır not düşsün ki F-002 sözleşmesinde unutulmasın.

---

### Kod başlamadan önce yapılması gerekenler

Developer (sözleşmeyi güncelleyip yeniden QA'ye gönderir):
1. B1 — AC2 kanıtını `hasInstallScript` beyaz listesi + `node-gyp`/`prebuild-install`/`node-addon-api`/`better-sqlite3` negatif araması olarak yeniden yaz (`tests/deps.test.ts`, kalıcı).
2. B3 — AC3'ü elle gözlemden çıkar: Playwright `dev` projesi + 4 assert (başlık, boş değil, 7334 `/api/health` proxy 200, 7333 doğrudan 200).
3. B4 + B5 — AC4'ü yeniden yaz: `resolvePort()` birim testleri (4 vaka, geçersiz değer davranışı **seçilmiş**) + `server.address()` assert'i + `src/**` statik guard + opsiyonel LAN testi (skip ⇒ katkı sağlamaz). Sabit 7333'e bind eden test ve "7333 reddeder" iddiası kaldırılsın.
4. B13 — Font kararını ver (self-host **veya** sistem yığını + CEO'nun AC10 daraltması), `--font-*` token doğrulamasını ekle ve `tests/no-external-host.test.ts` guard'ını sözleşmeye koy. **CDN yasak.**
5. B14 — AC10 renk assert'ini serileştirmeden bağımsız hâle getir (CSS değişkeniyle karşılaştırma + koyuluk kontrolü).
6. B10 + B11 — AC9'a yerel `npm ci` + `npm run verify` adımını ekle; geçici YAML scriptini kaldır, kalıcı `tests/ci-workflow.test.ts` yaz; `ci.yml`'i tam tanımla (matris, setup-node, sürüm).
7. B8 + B9 — `webServer` tanımını tek biçime indir (`npm run build && npm start`, readiness `/api/health`); `projects: [chromium]`; statik servisin 404/MIME davranışını ve favicon'u yaz; `pageerror` toplayıcısını ekle.
8. B6 — Tek çakışma-çözme kuralını ilan et; `uptime_s`, health'in zarfsız olduğu ve F-001'in alan kümesi (`ok, version, port, node, uptime_s`), `version`'ın kaynağı yazılsın.
9. B12 — `.gitignore` listesini genişlet (`test-results/`, `playwright-report/`, `.env*`); ilk commit kapsamını (docs/ dahil) yaz; AC1 kanıtını `git status --porcelain` boş olacak şekilde güncelle.
10. B15 — `tailwind.config.ts`'i listeden çıkar (veya `@config` ile bağla) ve AC10'un "Tailwind config" ifadesinin v4'te `@theme` demek olduğunu yaz.
11. B7 + R2 — R2 kararını üç koşuluyla birlikte sözleşmeye işle; F-003'ün gerçek DOM ADR taahhüdünü §7'ye yaz.
12. E2 + E3 — `.gitattributes` ve `package.json` `"type"` + tsconfig hedef kararlarını **açıkça** yaz (hangisi seçilirse seçilsin, "karar verilmedi" kabul edilmez).
13. §1'e iki açık dışlama ekle: Host/Origin koruması (F-002) ve `data/` klasörü oluşturma (F-002).
14. B16 — AC11 README kontrol listesini genişlet.

CEO:
15. `docs/02-architecture.md` §12'deki `npm run verify` satırını `typecheck && lint && test && build` olarak düzelt (R1 kararının belge karşılığı; editoryal, ADR gerekmez).
16. `docs/features/F-001-iskelet.md` AC5'teki `uptime` → `uptime_s` düzeltmesini yap (B6a).
17. B13'te (b) yolu seçilirse AC10'un "tipografi" ifadesini daralt; (a) seçilirse font lisans notunun README'ye gireceğini onayla.
18. B2 + B10 + R4: F-001'in GEÇTİ kararı, ilk push sonrası CI'ın (matris dahil) yeşil koşusuna bağlıdır. Push kullanıcı onayı gerektirir; bu onay F-001 QA turundan **önce** planlansın, yoksa AC2 ve AC9 yarım kalır ve feature GEÇTİ alamaz.

Bu 18 madde kapandığında sözleşme onaylanacaktır. Kod, en azından B1, B3, B4, B10, B13, B14 kapanmadan başlamamalıdır — bunlar kod turunun sonunda değil, başında ödenmesi gereken kararlardır.

---

## Sözleşme revizyonu 2 — 2026-09-04

Yazan: `developer`. QA denetim bulguları (B1–B16, E1–E5) ve CEO kararları (dosyanın
`docs/features/F-001-iskelet.md` "CEO kararları" bölümü) tek tek işlendi. Denetim bölümü
("## QA sözleşme denetimi — 2026-09-04") **değiştirilmedi**; bu tablo yalnızca ne yapıldığını
kaydeder. Bu tur da bir kod turu **değildir** — hâlâ yalnızca sözleşme metni güncellendi, kod
yazılmadı, komut çalıştırılmadı.

### Bulgu bazında kapatma tablosu

| # | Şiddet | Nasıl kapatıldı |
|---|---|---|
| B1 | K | §3 "hasInstallScript beyaz listesi" eklendi; §5 AC2 kalıcı `tests/deps.test.ts` tanımına bağlandı (beyaz liste + native derleme negatif taraması). |
| B2 | O | §5 AC2 macOS/Linux ayağı artık CI matrisine (`ubuntu-latest`/`windows-latest`/`macos-latest`) bağlandı; push öncesi açıkça "yarım" sayılıyor (§8). |
| B3 | K | §5 AC3 tamamen yeniden yazıldı: elle doğrulama kaldırıldı, Playwright `dev` projesi + `tests/e2e/dev-shell.spec.ts` (4 assert: başlık, boş değil, proxy 200, doğrudan API 200). |
| B4 | K | §5 AC4 üç katmanlı hâle getirildi: `server.address()` zorunlu assert'i (katman 1, atlanamaz) + `src/**` statik guard (katman 2) + opsiyonel LAN testi (katman 3, skip GEÇTİ'ye katkı sağlamaz, açıkça yazıldı). |
| B5 | O | `resolvePort()` saf fonksiyonu + 4 vakalık birim test tanımlandı (geçersiz değer davranışı: varsayılana düş + Türkçe uyarı — seçildi); sabit 7333'e bind eden test ve "7333 reddeder" iddiası tamamen kaldırıldı; tüm testler efemeral port kullanır. |
| B6 | O | Tek çakışma-çözme kuralı ilan edildi (alan adı/API = mimari, kapsam/bitiş = feature notu); `uptime_s` bu kurala bağlandı; CEO zaten AC5'i `uptime_s`'e güncellemiş; zarfsız düz JSON açıkça yazıldı; `version` kaynağı (`package.json` import + `resolveJsonModule`) belirlendi. |
| B7 | D/koşullu | R2 kararı üç koşuluyla birlikte §5 AC6'ya işlendi; App.tsx CSS import etmez + vitest node/JSX uyumu teknik koşulları eklendi. |
| B8 | O | §5 AC7'de tek `webServer` tanımı sabitlendi (`npm run build && npm start`, readiness `/api/health`); §2 dosya tablosunda da aynı tanıma referans verildi. |
| B9 | O | §5 AC7'ye `projects: [chromium]` (+ `dev`), statik servis sözleşmesi (MIME/`/`→index.html/404), `favicon.svg`, `consoleErrors`'ın `goto`'dan önce bağlanması ve `pageerror` toplayıcısı eklendi. |
| B10 | K | §5 AC9'a temiz klonda gerçek `npm ci` → `npm run verify` yerel adımı zorunlu kılındı; §8 bitti tanımına da eklendi. |
| B11 | O | Geçici YAML parse scripti fikri tamamen kaldırıldı; kalıcı `tests/ci-workflow.test.ts` tanımlandı; `ci.yml` içeriği tam yazıldı (matris, `setup-node@v4` node 22, `npm ci`, `npm run verify`, Playwright kurulmuyor notu). |
| B12 | O | `.gitignore` listesi genişletildi (`test-results/`, `playwright-report/`, `.env*`, `*.local`); ilk commit kapsamı ("tüm depo, docs/ dahil, yalnızca ignore hariç") yazıldı; AC1 kanıtı `git status --porcelain` boş olacak şekilde güncellendi. |
| B13 | K | CEO kararı işlendi: self-host, 4 font dosyası + 2 lisans dosyası, kaynak URL'leri, `@font-face`/`--font-*` token'ları, statik+çalışma zamanı doğrulama, `tests/no-external-host.test.ts` guard'ı yeni AC12 olarak eklendi, README lisans notu. Tıkanma durumunda CEO'ya dönme kuralı tekrar yazıldı. |
| B14 | K | §5 AC10 renk assert'i serileştirmeden bağımsız hâle getirildi: CSS değişkeniyle karşılaştırma + relative luminance < 0.1 koyuluk kontrolü; sabit `rgb(9,9,11)` dizgesi kaldırıldı. |
| B15 | O | `tailwind.config.ts` §2 dosya listesinden çıkarıldı (oluşturulmuyor); AC10'daki "Tailwind config" ifadesinin v4'te `@theme` bloğu anlamına geldiği açıkça yazıldı. |
| B16 | D | §5 AC13 (README) kontrol listesi genişletildi: `npx playwright install chromium`, Node ≥20.11, `data/` gitignore notu, `npm run e2e`'nin `verify` dışı olduğu notu, font lisans notu. |
| E1 | — | §7 R8 olarak risk tablosuna eklendi: Windows süreç ağacı temizliği + README sorun giderme satırı. |
| E2 | — | İki parçası ayrı ele alındı: (a) Linux import büyük/küçük harf duyarlılığı → §3'e kod inceleme disiplini notu eklendi; (b) `.gitattributes` kararı → **ekleniyor**, §2 ve §3'e `* text=auto eol=lf` olarak yazıldı, dosya sahipliğine küçük ekleme olarak not düşüldü (§9). |
| E3 | — | `package.json` `"type": "module"` kararı ve tek `tsconfig.json` (ayrı `tsconfig.server.json` yok) kararı §3'e açıkça yazıldı. |
| E4 | — | §7 R9 olarak risk tablosuna eklendi; "her feature'ın bitiş kanıtına yerel `npm run e2e` çıktısı dahildir" kuralı README'ye (AC13) ve §7'ye yazıldı. |
| E5 | — | §1'e açık dışlama olarak eklendi (`data/` oluşturma F-002'nin işi) ve §7 R10'da tekrar not edildi. |

### İtiraz edilen bulgu

Yok. 16 bulgunun (B1–B16) ve 5 ek riskin (E1–E5) tamamı yukarıdaki gibi kapatıldı; hiçbirine
gerekçeli itiraz edilmedi — QA'nın teknik gerekçeleri (özellikle B4/B14'ün "yanlış kırmızı/skip
= geçti sayılmaz" mantığı ve B13'ün S1 güvenlik gerekçesi) sağlam bulundu.

### 18 maddelik "kod öncesi yapılacaklar" listesi — durum

Developer'a düşen 14 madde (1–14) yukarıdaki tabloda karşılık gelen bulgularla birlikte
kapatıldı. CEO'ya düşen 4 madde (15–18) zaten **CEO tarafından yapılmış** olarak bulundu:
mimari §12 düzeltilmiş (madde 15), feature notu AC5 `uptime_s` olmuş (madde 16), font kararı
self-host olarak verilmiş (madde 17 — (a) yolu seçildi), CI/push planı feature notunun "CEO
kararları" bölümüne yazılmış (madde 18). Bu 4 maddenin dosya üzerindeki karşılıkları bu
revizyonda sözleşmeye işlendi, ayrıca doğrulanmadı (CEO'nun kendi belgelerini okuma dışında).

### Kod turuna hazır olma değerlendirmesi

B1, B3, B4, B10, B13, B14 (QA'nın "en azından bunlar kapanmadan kod başlamamalı" dediği altı
kritik bulgu) bu revizyonda kapatıldı. Sözleşme artık `status: draft` ile yeniden QA'ye
gönderilmeye hazırdır; kod turu yalnızca qa-evaluator onayından sonra başlayacaktır
(`docs/PROCESS.md` §5 — GEÇTİ/KALDI kararı yalnızca qa-evaluator'ındır, developer kendi işini
"geçti" ilan edemez).

---

## QA sözleşme denetimi — tur 2 — 2026-09-04

Denetleyen: `qa-evaluator` · Denetlenen sürüm: bu dosyanın 1–539. satırları (revize sözleşme)
+ "## Sözleşme revizyonu 2" tablosu. Yine **kod QA'si değildir**: kod yazılmadı, uygulama
çalıştırılmadı, Playwright/npm/git çalıştırılmadı. Karşılaştırılan belgeler:
`docs/features/F-001-iskelet.md` (güncel, 13 AC + "CEO kararları"), `docs/02-architecture.md`
(§3, §3.4, §3.5, §4, §6.6, §11.4, §12), `docs/03-ux.md` ("Tipografi", "Renk paleti").

### Karar: DÜZELTME İSTENİYOR

Gerekçe özeti (kısa tur): revizyon **büyük ölçüde gerçek** — 21 maddenin 18'i tam, 2'si kısmen
kapandı, 1'i (B3) niyet olarak doğru ama **uygulanamaz bir mekanizmayla** kapatıldı. Kozmetik
metin değişikliğiyle geçiştirilen bir bulgu yok; developer hiçbir yerde kanıtı zayıflatmamış.
Ama iki yeni, somut ve **kod turunu ilk saatte durduracak** hata girdi:

1. **Y1 (K):** AC3'ün yeni kanıtı Playwright'ta **geçersiz bir konfigürasyondur** —
   `webServer` bir *proje* alanı değildir; ayrıca iki `webServer` de aynı 7333 portunu
   ister. Uygulanabilir en yakın hâli (üst düzey `webServer` dizisi) AC3'e **yanlış yeşil**
   verdirir: dev API süreci `EADDRINUSE` ile ölse bile proxy assert'i prod sunucusunu
   vurup 200 döner. Bu tam olarak B3'ün kapatmak istediği hatanın tekrarıdır.
2. **Y2 (O):** AC11'in çalışma zamanı kanıtı olarak seçilen `getComputedStyle(...).fontFamily`
   assert'i, sözleşmenin iddia ettiği şeyi (font dosyasının **yüklendiğini**) ölçmez;
   yalnızca CSS bildirimini okur. woff2 404 verse bile bu assert yeşil kalır.

Bu ikisi + Y3 (guard'ın lisans dosyalarını taraması) yazıldığında sözleşme onaylanacaktır.
Sözleşmenin geri kalanı bu turda **onaylanmıştır**; tur 3 denetimi yalnızca Y1–Y3'e bakacak,
kapanan maddeler yeniden açılmayacaktır.

**CEO'nun 4 maddesi — doğrulandı (dosya üzerinden okundu):**
- `docs/02-architecture.md` §12 son satırı: `verify` = `typecheck && lint && test && build`,
  `e2e` açıkça dışarıda, CEO düzeltme notuyla. ✓ VERIFIED
- `docs/features/F-001-iskelet.md` AC5: `{ ok, version, port, node, uptime_s }`, zarfsız düz
  JSON. ✓ VERIFIED (mimari §6.6 ile aynı adlandırma)
- Font kararı: feature notunda AC11 (self-host, CDN yok, OFL lisans notu) + AC12
  (`tests/no-external-host.test.ts`) + "CEO kararları" bölümü. ✓ VERIFIED
- CI/push planı: "CEO kararları" B2/B10/R4 maddesi (private repo, matris, push kullanıcı
  onayı, developer push/remote **etmez**). ✓ VERIFIED

---

### Bulgu kapanış tablosu

| # | Şiddet | Durum | Kanıt / gerekçe (satır göstererek) |
|---|---|---|---|
| B1 | K | **kapandı** | §3 "hasInstallScript beyaz listesi" (satır 202-209) + §5 AC2 (satır 297-302): beyaz liste `{esbuild, @esbuild/*, playwright, @playwright/test}`, liste dışı ad → test kırılır; ayrıca `node-gyp`/`prebuild-install`/`node-addon-api`/`nan`/`better-sqlite3` negatif taraması. Kalıcı test (`tests/deps.test.ts`), `npm install` çıktısına bağlı değil. İstenen buydu. |
| B2 | O | **kapandı** | §5 AC2 (satır 303-307) + §6 + §8: macOS/Linux ayağı CI matrisine bağlandı, push öncesi **açıkça yarım** sayılıyor ve GEÇTİ engelleniyor. Metin "README'de yazıyor" savunmasından gerçek koşuya taşınmış. |
| B3 | K | **AÇIK (mekanizma geçersiz)** | Elle gözlem gerçekten kaldırılmış (satır 310-322) ve dört assert doğru seçilmiş — niyet doğru. Ama kanıtın taşıyıcısı olan konfigürasyon uygulanamaz ve yanlış yeşil üretir → **Y1**. AC3 bu hâliyle hâlâ ölçemiyor. |
| B4 | K | **kapandı** | §5 AC4 katman 1 (satır 325-329): `createServer(0)` → `server.address()` `toMatchObject({address:'127.0.0.1',family:'IPv4'})`, "hiçbir koşulda skip edilmez" yazılı; katman 3 için "atlanırsa GEÇTİ'ye **hiçbir** katkı sağlamaz" açıkça yazılmış (satır 336-337). Tur 1 kararı birebir uygulanmış. (Ampirik ayrıntı için Y4.) |
| B5 | O | **kapandı** | Satır 338-345: `resolvePort(env)` saf fonksiyonu + 4 vaka, geçersiz değer davranışı **seçilmiş** (varsayılana düş + Türkçe stderr uyarısı); "sabit 7333'e hiç bağlanılmaz" ve "7333 reddeder iddiası tamamen kaldırılmıştır" cümleleri yerinde. |
| B6 | O | **kapandı** | Satır 348-365: tek çakışma-çözme kuralı ilan edilmiş (alan adı/API = mimari, kapsam/bitiş = feature notu), zarfsızlık gerekçelendirilmiş (§6.6 ile uyumlu), alan kümesi sabit, `version` kaynağı + `resolveJsonModule` yazılmış. Feature notu AC5 ile artık çelişki yok. |
| B7 | D | **kapandı** | Satır 367-381: R2'nin üç koşulu (state/handler/effect yok · e2e tıklanabilir öğe = 0 · F-003'te ADR) + iki teknik koşul (App.tsx CSS import etmez, node ortamında JSX) yazılmış; §7'de "Planlı iş" olarak da kayıtlı. |
| B8 | O | **kısmen** | Prod `webServer` tek biçime indirildi (§2 satır 75, §5 AC7 satır 385-387) — bu kısmı kapandı. Ancak AC7 "**Tek** `webServer` tanımı" derken AC3 ikinci bir `webServer` tanımlıyor: belge içi çelişki geri geldi → Y1 ile birlikte çözülmeli. |
| B9 | O | **kapandı** | AC7: `projects: [chromium]` (+dev), statik servis sözleşmesi (MIME listesi, `/`→index.html, bilinmeyen yol 404, SPA fallback F-003'e ertelendi), `favicon.svg` + `<link rel="icon">`, `page.on('console')`'un **`goto`'dan önce** bağlanması ve `pageerror` toplayıcısı — hepsi yazılı. |
| B10 | K | **kapandı** | §5 AC9 ilk madde + §8: temiz klonda `npm ci` → çıkış 0 → `npm run verify` → çıkış 0 **zorunlu yerel adım**; bitti tanımına da girmiş. AC9'un komutunun yarısı artık gerçekten çalıştırılıyor. |
| B11 | O | **kapandı** | Geçici YAML scripti fikri gerçekten silinmiş; `ci.yml` içeriği tam (on: [push], 3 OS matrisi, `setup-node@v4` node 22, `npm ci`, `npm run verify`, "Playwright kurulmuyor" yorumu) ve `tests/ci-workflow.test.ts` kalıcı dizge doğrulaması tanımlı. |
| B12 | O | **kapandı** | §2 + AC1: `.gitignore` 7 desen (`test-results/`, `playwright-report/`, `.env*`, `*.local` eklendi), ilk commit kapsamı ("tüm depo, docs/ dahil"), kanıt `git status --porcelain` boş — **e2e koştuktan sonra da** şartı yazılmış. |
| B13 | K | **kısmen (statik taraf gerçek, çalışma zamanı kanıtı hatalı)** | Gerçek olan: §3 font varlıkları tablosu, 4 woff2 + 2 lisans dosyası, göreli `@font-face` yolları, üç `--font-*` token'ı, `tests/web/theme.test.ts` statik doğrulaması, README lisans notu, tıkanma → `docs/blockers.md` kuralı. Hatalı olan: satır 186-189 ve AC11'in "hesaplanan `fontFamily` ⇒ font gerçekten yüklendi" çıkarımı → **Y2**. Ayrıca guard'ın kapsamı lisans dosyalarını da tarıyor → **Y3**. |
| B14 | K | **kapandı** | AC10 (satır 421-434): sabit `rgb(9,9,11)` dizgesi kaldırılmış; CSS değişkeniyle karşılaştırma + relative luminance < 0.1 koyuluk assert'i. Koyuluk kontrolü tek başına da anlamlı bir kanıt olduğu için serileştirme riskine karşı dayanıklı. (Bir ampirik uyarı için Y5.) |
| B15 | O | **kapandı** | `tailwind.config.ts` §2 tablosunda "**Oluşturulmuyor**" satırına çevrilmiş, gerekçe (v4 CSS-first, `@config` olmadan ölü dosya) ve AC10'daki "Tailwind config" ifadesinin `@theme` demek olduğu yazılmış. Tailwind v4 için doğru karar. |
| B16 | D | **kapandı** | AC13: `npx playwright install chromium`, Node ≥ 20.11, `data/` gitignore notu, `npm run e2e`'nin verify dışı olduğu notu, font lisans notu — hepsi listede. |
| E1 | — | **kapandı** | §7 R8: Windows süreç ağacı + README sorun giderme satırı (`netstat`/`taskkill`) + `EADDRINUSE` Türkçe mesajı. |
| E2 | — | **kapandı** | (a) §3 sonunda import büyük/küçük harf disiplini notu; (b) `.gitattributes` kararı **verilmiş** (ekleniyor, `* text=auto eol=lf`), §2/§3/§9 üçünde tutarlı. "Karar verilmedi" durumu kalmadı. |
| E3 | — | **kapandı** | §3: `"type": "module"` ve tek `tsconfig.json` (ayrı `tsconfig.server.json` yok, `lib: ["ES2022","DOM"]` tuzağı açıkça kabul edilmiş) kararları yazılı. |
| E4 | — | **kapandı** | §7 R9 + AC13 README notu: "her feature'ın bitiş kanıtına yerel `npm run e2e` çıktısı dahildir". |
| E5 | — | **kapandı** | §1 dışlama listesine `data/` maddesi + §7 R10. F-002'ye devri net. |

**Sayım:** 21 maddeden **18 tam kapandı**, 2 kısmen (B8, B13), 1 açık (B3 — mekanizma).
**Kozmetik kapanış: yok.** Hiçbir maddede "metin değişti ama kanıt hâlâ ölçülemez" durumu
görülmedi; B3 ve B13'ün kalan sorunu kozmetik değil, **teknik hata** (yanlış API / yanlış
ölçüm). Developer hiçbir bulguya itiraz etmemiş ve hiçbir kanıtı gevşetmemiş — bu tur
sözleşmenin kalitesini gerçekten yükseltmiştir.

---

### Yeni bulgular

**Y1 (K) — `webServer` proje düzeyinde tanımlanamaz; iki webServer aynı 7333'ü ister → AC3 yanlış yeşil verir.**
· Nerede: §5 AC3 (satır 310-317) `projects` içinde `{ name: 'dev', use: {...}, webServer: {...} }`;
  §2 satır 75 ve §5 AC7 (satır 385-387) prod `webServer`'ı üst düzeyde tanımlıyor.
· Sorun (üç katman):
  1. **Şema hatası:** Playwright'ta `webServer` bir `TestConfig` alanıdır, `TestProject` alanı
     **değildir**. `defineConfig({ projects: [{ name:'dev', webServer:{...} }] })` fazla-alan
     kontrolüne takılır → `npm run typecheck` kırmızı (playwright.config.ts tek tsconfig
     kapsamında, §2). Yani AC8 bile bu hâliyle geçmez.
  2. **Port çakışması:** Üst düzey `webServer` dizisine çevrilirse (tek uygulanabilir hâl)
     Playwright **her koşuda tüm** webServer'ları başlatır — `--project=dev` filtresi
     webServer'ları filtrelemez. `npm start` 7333'ü, `npm run dev`'in `dev:server`'ı da
     7333'ü ister (mimari §3.3/§3.5) → ikincisi `EADDRINUSE` ile ölür.
  3. **Yanlış yeşil (asıl tehlike):** dev'in API süreci ölse bile Vite 7334'te ayağa kalkar,
     readiness sağlanır ve AC3'ün 3. asserti (7334 `/api/health` proxy → 200) ile 4. asserti
     (doğrudan 7333 → 200) **prod sunucusunu** vurarak 200 döner. Test yeşil, kanıt sahte.
     Bu, B3'ün kapatmayı amaçladığı hatanın (ölçmediğini ölçtüğünü sanan kanıt) aynısıdır.
· İstenen düzeltme (developer **seçsin**, sözleşme kararı yazsın — ben yazmam):
  (a) Ayrı konfigürasyon: `playwright.dev.config.ts` (tek proje + kendi `webServer`'ı) +
      script `e2e:dev` = `playwright test -c playwright.dev.config.ts`; `npm run e2e` prod
      koşusu olarak kalır. §8 bitti tanımı "iki koşu da yeşil" der. Dosya sahipliğine bir
      config dosyası eklenir (mevcut kapsam içi).
  (b) Tek config + üst düzey `webServer` **dizisi** + dev tarafını farklı porta taşımak:
      dev koşusunda `MC_PORT`/`MC_WEB_PORT` ayrı değerlere (ör. 7433/7434) set edilir ve
      Vite proxy hedefi `MC_PORT`'tan okunur (§2 zaten "proxy → `MC_PORT`" diyor). Bu, dev
      API'sinin gerçekten kendi süreci olduğunu da kanıtlar.
  (c) Prod ve dev projelerini `dependencies`/`teardown` ile sıralamak **çözüm değildir**
      (webServer'lar yine paralel başlar) — seçilmemeli.
· Hangisi seçilirse seçilsin sözleşme şunu yazsın: **dev koşusunda 7333'ü yanıtlayan sürecin
  `npm run dev`'in kendi süreci olduğu** kanıtlanmalı (ör. prod webServer'ı o koşuda hiç
  başlatılmaz). Aksi hâlde AC3 ölçmez.

**Y2 (O) — AC11'in çalışma zamanı kanıtı fontun yüklendiğini ölçmüyor.**
· Nerede: §3 satır 186-189 ("hesaplanan `fontFamily`'sinin `Departure Mono` içerdiği assert
  edilir — font dosyasının gerçekten yüklendiğinin kanıtıdır") ve §5 AC11 (aynı iddia,
  "404 olsaydı tarayıcı fallback'e düşerdi").
· Sorun: `getComputedStyle(el).fontFamily` **CSS bildirimini** döndürür, kullanılan (used)
  fontu değil. `@font-face` kaynağı 404 verse de hesaplanan değer `'Departure Mono',
  ui-monospace, monospace` olarak kalır; tarayıcı yalnızca render'da fallback'e düşer.
  Yani assert, `index.css`'te zaten statik olarak doğrulanan şeyi ikinci kez doğrular ve
  AC11'in asıl iddiasını (self-host font **yerelden servis edilip yükleniyor**) kanıtlamaz.
· Neden önemli: AC11'in varlık sebebi S1 (dış hostname yok) + fontun gerçekten çalışması.
  Bu assert'le, fontları repoya koymayı unutmuş bir kod turu yeşil alır.
· İstenen düzeltme (biri yeterli, sözleşme seçsin):
  1. `await page.evaluate(async () => { await document.fonts.ready; return
     document.fonts.check('16px "Departure Mono"'); })` → `true` beklenir; veya
  2. `page.on('response')` ile `.woff2` isteklerinin **aynı origin**'den ve `status() === 200`
     döndüğü assert edilir (en az bir woff2 yüklendi + hiçbiri 4xx değil).
  Mevcut `fontFamily` assert'i kalabilir (token'ın gerçekten uygulandığını gösterir), ama
  **fontun yüklendiğinin kanıtı olarak sunulmamalı**; §3 ve AC11'deki gerekçe cümlesi
  düzeltilsin.

**Y3 (D/O) — `tests/no-external-host.test.ts` kendi lisans dosyalarına takılacak.**
· Nerede: §2 satır 97 ve §5 AC12: tarama kapsamı `src/web/**` + `src/server/**` + `index.html`,
  dosya uzantısı sınırı yok.
· Sorun: aynı revizyon `src/web/fonts/LICENSE-DepartureMono.txt` ve `LICENSE-IBMPlex.txt`
  dosyalarını `src/web/**` altına koyuyor. OFL-1.1 metni gövdesinde harici URL barındırır
  (SIL/OFL adresi). Guard bu dosyaları okursa **her koşuda kırmızı** verir; developer'ın
  ilk refleksi guard'ı gevşetmek olur — S1'in tek otomatik kanıtı zayıflar.
· İstenen düzeltme: tarama kapsamı uzantıyla sınırlansın (`**/*.{ts,tsx,css,html}`) ve
  sözleşme "lisans/binary varlıklar taranmaz, çünkü kod değildir" gerekçesini yazsın.
  Alternatif (daha zayıf): `LICENSE-*` dosyalarını istisna listesine almak.

**Y4 (D) — `createServer(0)` sözleşmesi eksik: `listen` asenkrondur.**
· §5 AC4 katman 1 `const server = createServer(0)` → hemen `server.address()` assert ediyor.
  `net.Server.address()` **`listening` olayından önce `null`** döner; ayrıca `createServer`'ın
  `listen`'i kendisinin çağırıp çağırmadığı yazılmamış (isim `http.createServer` ile de
  çakışıyor). Sözleşme tek cümleyle netleştirsin: fonksiyon `listen(port, '127.0.0.1')`
  çağırır ve test `await once(server, 'listening')` sonrası `address()`'i assert eder,
  sonunda `server.close()` yapar. Assert'in kendisi **zayıflatılmaz** (B4 kararı geçerli).
  Bu tek başına bloklayıcı değildir, ama Y1–Y3 turunda bir cümleyle kapatılabilir.

**Y5 (D) — AC6'nın kanıt cümlesi kendi dosya listesiyle uyuşmuyor.**
· Satır 380-381: "toplam ≥4 test dosyası" diyor, ardından **6** dosya sayıyor (§2 de 6 diyor).
  Sayı ≥6 olmalı; aksi hâlde iki test dosyası sessizce düşerse kanıt yine "yeşil" görünür.
  Kozmetik ama ucuz.

**Yeni hata girmediği doğrulanan yerler (tur 1'de doğru olan maddeler bozulmamış):**
`resolvePort()` birim testi ve efemeral port kararı tutarlı (AC4/AC5 tek bir port kaynağı
kullanıyor, sabit porta bağlanan test kalmamış) · statik servis sözleşmesi (MIME/404/`/`)
§2 ve AC7'de aynı · `.gitignore` listesi §2 ile AC1'de birebir aynı 7 desen · `ci.yml`
tanımı AC9 ile `tests/ci-workflow.test.ts` arasında birebir · `.gitattributes` §2/§3/§9'da
tutarlı · bağımlılık listesi değişmemiş (2 runtime + 16 dev = 18; **yeni npm paketi yok**,
fontlar statik varlık) · ürün özelliği sızması yok (§1 dışlama listesi F-002…F-011'i ve
Host/Origin, `data/` maddelerini kapsıyor) · `tailwind.config.ts`'in çıkarılması Tailwind v4
CSS-first kurulumu için **doğru** karar.

**Bitti tanımı (§8):** doğru ifade edilmiş. Yerelde kanıtlanacaklar (`verify`, iki e2e koşusu,
temiz klonda `npm ci` + `verify`, 13 AC, `git log`/`git status`) ile push sonrası
kanıtlanacaklar (üç OS'lik matris) ayrı paragraflarda; "yerel her şey yeşil olsa bile push ve
CI koşusu tamamlanmadan F-001 GEÇTİ ilan edilemez" cümlesi net ve ara durum ("yerel doğrulama
tamam, CI bekleniyor") tanımlı. AC2'nin macOS/Linux yarısının push öncesi **yarım** sayılması
§5, §6 ve §8'de üç kez tutarlı tekrarlanmış. Bu bölüm onaylanmıştır — yalnızca §8'in "hem
`chromium` hem `dev` projeleri" ifadesi Y1'in seçilecek çözümüne göre güncellenmeli.

---

### Kod turunda doğrulanacaklar (ampirik — sözleşmeyi bloklamaz)

1. **`--color-zinc-950` çalışma zamanında var mı?** AC10 renk assert'i
   `getPropertyValue('--color-zinc-950')` okuyor. Tailwind v4 tema değişkenlerini kullanıma
   göre üretir; değişken boş dönerse test **yanlış kırmızı** verir. Kural: bu durumda birincil
   kanıt luminance < 0.1 koyuluk assert'i + `theme.test.ts` statik kontrolü olur; koyuluk
   assert'i **kaldırılamaz/gevşetilemez**, yalnızca değişken karşılaştırması düşürülebilir.
2. **`vitest@^2` × `vite@^6` peer uyumu** — §3'te kural yazılı (uyumlu tek çift seçilir, ADR
   gerekmez). `npm install`'ın ilk çıktısında kontrol edilecek.
3. **`import pkg from '../../package.json' with { type: 'json' }`** — Node 20.11 + tsx +
   `tsc --noEmit` üçlüsünde import attribute sözdizimi patlarsa sözleşmenin verdiği alternatif
   (`readFileSync` + `JSON.parse`) kullanılır; bu bir sapma değildir (§5 AC5 zaten iki
   seçeneği de yazmış).
4. **`environment: 'node'` altında TSX/JSX derlemesi** (AC6 teknik koşulu) ilk testte ampirik
   doğrulanacak — sözleşme bunu zaten "ilk testte doğrulanır" diye yazmış.
5. **Playwright'ın Windows'ta `concurrently` + `tsx watch` süreç ağacını temizlemesi** (R8) —
   yalnızca koşarak görülür.
6. **Öneri (zorunlu değil):** mimari §11.4c "liste dışı paket → test kırılır" kontrolü
   `tests/deps.test.ts`'e bir assert olarak eklenebilir (`package.json` bağımlılıkları ⊆ §3.4
   kapalı listesi). F-001 AC'si değil; F-002'de gelebilir.

---

### Kod turu başlayabilir mi

**Hayır — henüz değil.** Y1 sözleşmenin AC3 kanıtını uygulanamaz kılıyor (ve uygulanabilir
en yakın hâli yanlış yeşil veriyor); Y2 AC11'in çalışma zamanı kanıtını geçersiz kılıyor;
Y3 kendi guard'ını ilk koşuda kırmızıya düşürüyor. Üçü de **kod yazılmadan** verilecek küçük
kararlar ve bir sözleşme turu daha uzatmaz: Y1 için bir seçim (a/b) + Y2 için bir assert
seçimi + Y3 için bir glob daraltması, artı Y4/Y5'in birer cümlesi.

Bunlar yazıldığında sözleşme **onaylanacaktır**; tur 3 denetimi yalnızca Y1–Y5'e bakacak ve
kapanmış 18 maddeyi yeniden açmayacaktır. Tur 1'in "kod, en azından B1/B3/B4/B10/B13/B14
kapanmadan başlamamalıdır" kuralı geçerli: B3 (→Y1) ve B13'ün çalışma zamanı yarısı (→Y2)
hâlâ açık olduğu için kod turu bekler.

---

## Sözleşme revizyonu 3 — 2026-09-04

Yazan: `developer`. Tur 2 QA bulguları (Y1–Y5) ve B3/B8/B13'ün açık kalan yarıları tek tek
işlendi. Tur 1 ve tur 2 denetim bölümleri (`## QA sözleşme denetimi — 2026-09-04` ve
`## QA sözleşme denetimi — tur 2 — 2026-09-04`) **değiştirilmedi**; bu tablo yalnızca ne
yapıldığını kaydeder. Onaylanmış bölümler (§8 bitti tanımının push sonrası paragrafı, kapsam,
bağımlılık listesi, `.gitignore`, `ci.yml`, `.gitattributes`, statik servis sözleşmesi,
`resolvePort()` planı) yeniden açılmadı; yalnızca Y1–Y5'in ve B3/B8/B13'ün gerektirdiği yerler
değişti. Bu tur da bir kod turu **değildir** — kod yazılmadı, komut çalıştırılmadı.

### Bulgu bazında kapatma tablosu

| Bulgu | Sözleşmenin hangi bölümü değişti | Kanıt artık neden sağlam |
|---|---|---|
| **Y1** (K) — `webServer` proje alanı değil; iki webServer aynı 7333'ü ister, AC3 yanlış yeşil verebilir | §2 (`playwright.config.ts` satırı prod-only'e daraltıldı, yeni satır `playwright.dev.config.ts`); §4 (yeni script `e2e:dev`); §5 AC3 (tamamen yeniden yazıldı — dev kanıtı ayrı config dosyasında); §5 AC7 (prod `webServer` tanımının yalnızca `playwright.config.ts` kapsamında olduğu netleştirildi, "tek webServer" çelişkisi kalktı); §8 (bitti tanımı iki ayrı komuta — `npm run e2e` ve `npm run e2e:dev` — bağlandı); §9 (dosya sahipliğine `playwright.dev.config.ts` eklendi) | Seçenek (a) uygulandı: dev kanıtı kendi `webServer`'ına sahip ayrı bir config dosyasında çalışır ve bu dosyada prod `webServer` (build+start) **hiç tanımlı değildir**. Dolayısıyla `npm run e2e:dev` koşusunda 7333'ü yanıtlayabilecek tek süreç `npm run dev`'in kendi API sürecidir — port çakışması yapısal olarak imkânsız, "prod sunucusu dev testini yanlış yeşil yapar" senaryosu artık kurulamaz. Şema da geçerlidir: `webServer` her iki dosyada da `TestConfig` düzeyinde, `TestProject` içine gömülmüyor — `npm run typecheck` kırılmaz. |
| **Y2** (O) — `getComputedStyle(...).fontFamily` font yüklendiğini değil CSS bildirimini ölçüyor | §3 "Font varlıkları" madde 4; §5 AC11; §5 AC7 assert listesi (shell.spec.ts artık 6 assert) | Birincil kanıt `await document.fonts.ready` + `document.fonts.check('16px "Departure Mono"') === true` oldu. `document.fonts.ready`, tüm `@font-face` isteklerinin (başarılı/başarısız) sonuçlanmasını bekler; `check()` yalnızca **gerçekten yüklenmiş** bir yüz için `true` döner — woff2 404 verirse yüz "unloaded" kalır ve assert `false` ile kırılır. Eski `fontFamily` assert'i kaldırılmadı, ikincil (yalnızca "token uygulandı") kanıt olarak yeniden etiketlendi; hiçbir assert gevşetilmedi, bir tane eklendi. |
| **Y3** (D/O) — guard `LICENSE-*.txt` dosyalarını tarayıp OFL metnindeki URL'e takılıyor | §2 (`tests/no-external-host.test.ts` satırı); §5 AC12 | Tarama kapsamı uzantıyla sınırlandı: `src/web/**/*.{ts,tsx,css,html}`, `src/server/**/*.ts`, `index.html`. `.txt` ve `.woff2` hiç taranmıyor — lisans metni artık guard'ı tetiklemez. İstisna yalnızca ikili/lisans dosyalarıyla sınırlı; kod/işaretleme uzantılarının kapsamı **daraltılmadı**, S1'in koruduğu yüzey (dış hostname taraması) aynı kaldı — "her şeyi hariç tut" yönüne kaymadı. |
| **Y4** (D) — `createServer(0)` + `server.address()` senkron varsayımı; `listen` asenkron | §5 AC4 katman 1 | Sözleşme artık fabrika fonksiyonunun `listen(port, '127.0.0.1')`'i kendisi çağırdığını ve testin `await once(server, 'listening')` sonrası `address()`'i assert ettiğini, sonunda `server.close()` yaptığını açıkça yazıyor. Assert'in içeriği (`{address:'127.0.0.1', family:'IPv4'}`) değişmedi — yalnızca zamanlama doğru sıraya oturdu. |
| **Y5** (D) — AC6 "≥4 test dosyası" derken 6 dosya sayıyor | §5 AC6 | Sayı ≥6'ya düzeltildi; listelenen 6 dosya (`health.test.ts`, `deps.test.ts`, `no-external-host.test.ts`, `App.test.tsx`, `theme.test.ts`, `ci-workflow.test.ts`) ile cümle artık tutarlı — iki dosya sessizce düşerse test artık yeşil kalamaz. |
| **B3** (K, açık kalan yarı) — mekanizma geçersizdi (bkz. Y1) | Y1 ile aynı değişiklikler (§2, §4, §5 AC3/AC7, §8, §9) | Y1 satırıyla aynı gerekçe: dev kanıtı artık gerçekten uygulanabilir bir Playwright konfigürasyonuyla, ayrı ve çakışmasız bir port/süreç modeliyle kanıtlanıyor. Elle gözlem hâlâ yok; `npm run e2e:dev` tek komutla tekrar üretilebilir. |
| **B8** (O, açık kalan yarı) — AC7 "tek webServer" derken AC3 ikinci bir webServer tanımlıyordu (belge içi çelişki) | §5 AC7 ("yalnızca `playwright.config.ts` (prod modu) kapsamında" ifadesi eklendi) | "Tek webServer" ifadesi artık dosya bazında doğru: her config dosyasının kendi tek `webServer`'ı var, ikisi asla aynı anda/aynı dosyada tanımlı değil. Çelişki, "tek dosya" yerine "her koşu tipi için tek config, her configte tek webServer" olarak netleştirilerek kapandı. |
| **B13** (K, açık kalan yarı) — çalışma zamanı font kanıtı hatalıydı + guard kapsamı hatalıydı | Y2 ve Y3 ile aynı değişiklikler (§3, §5 AC11, §5 AC12, §5 AC7 assert listesi) | Y2 ve Y3 satırlarıyla aynı: statik taraf zaten sağlamdı (tur 2'de kapandı), şimdi çalışma zamanı kanıtı (`document.fonts.check`) ve guard kapsamı (uzantı sınırlaması) da doğru ölçüyor. B13 artık tam kapalı. |

### İtiraz edilen bulgu

Yok. Y1–Y5'in tamamı ve B3/B8/B13'ün açık kalan yarıları yukarıdaki gibi kapatıldı; hiçbirine
itiraz edilmedi, hiçbir kanıt gevşetilmedi (assert'ler ya aynı kaldı ya da güçlendirildi/
eklendi — hiçbiri "içeriyor mu" seviyesine düşürülmedi).

### Kod turuna hazır olma değerlendirmesi

21 maddenin tamamı (16 + 5 tur 1 ek risk + Y1–Y5) artık kapalı. Sözleşme `status: draft` ile
yeniden qa-evaluator'a gönderilmeye hazırdır; kod turu yalnızca qa-evaluator'ın tur 3 onayından
sonra başlayacaktır (`docs/PROCESS.md` §5 — GEÇTİ/KALDI kararı yalnızca qa-evaluator'ındır).

---

## QA sözleşme denetimi — tur 3 — 2026-09-04

Denetleyen: `qa-evaluator` · Denetlenen sürüm: bu dosyanın 1–580. satırları (revizyon 3
sonrası sözleşme) + "## Sözleşme revizyonu 3" tablosu. **Kod QA'si değildir:** kod yazılmadı,
uygulama çalıştırılmadı, `npm`/`npx`/`git`/Playwright çalıştırılmadı. Kapsam, brief gereği
**dar**: yalnızca Y1–Y5, B3/B8/B13'ün açık yarımları ve tur 2'de onaylanmış bölümlerde
regresyon. Tur 1/tur 2'de kapanan 18 madde yeniden açılmadı, denetlenmedi.

### Karar: ONAY

Gerekçe: Y2, Y4, Y5, B8 tam kapandı; Y1 ve Y3 **normal (temiz) bir koşuda** artık yanlış
yeşil üretemez — kalan iki açık yalnızca dış bir bozulma (7333'te yabancı bir süreç) veya
developer'ın kendi yazacağı `favicon.svg`'ye dış host koyması hâlinde ortaya çıkar. Bu ikisi
sözleşmeyi bloklamaz ama **kod turunda zorunludur** (aşağıdaki K1/K2); F-001'in GEÇTİ kararı
bunlara bağlıdır. Sözleşme metnindeki iki iddia ("port çakışması **yapısal olarak imkânsız**",
"7333'ü yanıtlayan sürecin dev API'si olduğu **garantidir**") olduğundan güçlüdür; doğrusu bu
denetim bölümünde kayda geçirilmiştir (K1).

Ölçüt olarak uygulanan kural (tur 2 precedent'i): "bu assert, iddia yanlışken kırmızı olur
mu?" Tur 2'de AC3 **her koşuda** yalan söyleyebiliyordu (iki webServer aynı koşuda başlıyordu);
şimdi yalnızca port kirliyken. Bu nitel bir farktır: sözleşme kanıtı artık ölçüyor.

---

### Y1–Y5 ve B3/B8/B13 kapanış tablosu

| # | Durum | Kanıt / gerekçe |
|---|---|---|
| **Y1** (K) — AC3 mekanizması | **kapandı (bir kalıntıyla → K1)** | Üç katmanın ikisi tam çözülmüş: (1) **Şema:** `webServer` her iki dosyada da üst düzeydedir (§2 satır 75-76, §5 AC3, §5 AC7) — `TestProject` içine gömülü değil, `tsc --noEmit` kırılmaz. (2) **Port çakışması:** `npm run e2e` yalnızca `playwright.config.ts`'i, `npm run e2e:dev` yalnızca `playwright.dev.config.ts`'i yükler (§4); prod `webServer` dev configde **hiç yok**, iki webServer aynı süreçte asla başlamaz → aynı koşuda çakışma imkânsız. (3) **Yanlış yeşil:** koşunun *kendi* başlattığı prod sunucusundan gelen sahte 200 elenmiştir. Kalıntı: bkz. tablonun altındaki not. |
| **Y2** (O) — AC11 font yükleme kanıtı | **kapandı** | §3 madde 4 + §5 AC11 + §5 AC7 assert (5): birincil kanıt `await document.fonts.ready` → `document.fonts.check('16px "Departure Mono"') === true`. Bu assert iddia yanlışken **kırmızı olur**: `@font-face` CSS'te bildirildiği için yüz `document.fonts` kümesine kayıtlıdır; woff2 404/eksikse yüzün durumu `error`'a düşer ve `check()` `false` döner. Fallback fontun yüklü olması sonucu kurtarmaz — `check()` sorgudaki aileyi (`Departure Mono`) kümede bulur ve o yüzün durumuna bakar; `ui-monospace`/`monospace` sorguya dahil değildir. Tek teorik kaçış, `@font-face` kuralının tamamen silinmesidir (o zaman aile kümede bulunmaz ve `check()` `true` dönebilir) — bunu `tests/web/theme.test.ts`'in üç `@font-face` bloğu için yaptığı statik dizge kontrolü kapatıyor. İki kanıt birlikte deliksiz. Eski `fontFamily` assert'i kaldırılmamış, doğru biçimde "uygulanma kanıtı (ikincil)" diye yeniden etiketlenmiş — kanıt gevşetilmemiş, eklenmiş. |
| **Y3** (D/O) — guard kapsamı | **kapandı (bir kalıntıyla → K2)** | §2 satır 97 + §5 AC12: kapsam `src/web/**/*.{ts,tsx,css,html}`, `src/server/**/*.ts`; `LICENSE-*.txt` ve `*.woff2` taranmıyor. OFL metnindeki URL artık guard'ı tetiklemez → guard "her koşuda kırmızı" olmaktan çıktı, developer'ın onu gevşetme baskısı ortadan kalktı. S1 yüzeyi **daralmadı**: hiçbir kod/işaretleme uzantısı kapsam dışına alınmamış, istisna yalnızca lisans metni + ikili varlıkla sınırlı ve gerekçesi yazılı. `.json`/`.mjs` kaçak yolu F-001'de yok (§2 dosya listesi kapalı; `src/**` altında bu uzantılarda dosya üretilmiyor). Kalan tek kaçak yol `.svg` → K2. |
| **Y4** (D) — `createServer(0)` + `listening` | **kapandı** | §5 AC4 katman 1: fabrika `listen(port,'127.0.0.1')`'i kendisi çağırır, test `await once(server,'listening')` sonrası `address()`'i assert eder, `server.close()` ile kapatır. Assert içeriği (`{address:'127.0.0.1',family:'IPv4'}`) aynen korunmuş — yalnızca zamanlama düzeltilmiş, B4 kararı zayıflatılmamış. |
| **Y5** (D) — AC6 dosya sayısı | **kapandı** | §5 AC6 son madde: "≥6 test dosyası" + altı dosya adı; §2'nin vitest dosya listesiyle (health, deps, no-external-host, App, theme, ci-workflow) birebir. İki dosya sessizce düşerse kanıt artık yeşil kalamaz. |
| **B3** (K, açık yarı) | **kapandı (Y1 ile aynı, K1 kalıntısı)** | Elle gözlem yok; `npm run e2e:dev` tek komutla tekrar üretilebilir; dört assert korunmuş; mekanizma artık uygulanabilir. |
| **B8** (O, açık yarı) | **kapandı** | §5 AC7'ye "yalnızca `playwright.config.ts` (prod modu) kapsamında" ifadesi eklenmiş; §2'de iki ayrı satır, §4'te iki ayrı script, §8'de iki ayrı koşu, §9'da config dosyasının sahipliği — beş yerde tutarlı. Belge içi çelişki kalmadı. |
| **B13** (K, açık yarı) | **kapandı** | Statik taraf tur 2'de kapanmıştı; çalışma zamanı kanıtı (Y2) ve guard kapsamı (Y3) da düzeldi. AC7 assert sayısı 5→6'ya çıkarılmış ve §3 madde 4 ile birebir uyumlu. |

**Y1'in kalıntısı (kayda geçirilir, K1 ile kapatılacak):** "bu koşuda 7333'ü yanıtlayan süreç
`npm run dev`'in kendi API sürecidir" ifadesi yalnızca *Playwright'ın kendi başlattığı*
süreçler için doğrudur. 7333'te **dış** bir dinleyici varsa (R8'in belgelediği Windows yetim
süreci; §8 gereği aynı oturumda önce koşan `npm run e2e`'nin `npm start` sürecinin artığı;
ya da developer'ın ikinci terminalde açtığı `npm start`), zincir şöyle işler: `dev:server`
`EADDRINUSE` ile ölür → `concurrently` diğer süreci öldürmediği için komut çıkmaz → Vite
7334'te ayağa kalkar → `webServer.url` (7334) hazır sayılır → 3. assert (proxy 7334→`MC_PORT`)
ve 4. assert (doğrudan 7333) **yabancı süreci** ölçüp 200 döner → AC3 yeşil, oysa
`npm run dev` API'yi kaldıramamıştır. `reuseExistingServer: false` yalnızca `url`'deki portu
(7334) korur, 7333'ü korumaz. Bu temiz ortamda gerçekleşmediği için sözleşmeyi bloklamaz;
kod turunda kapatılması **zorunludur** (K1).

---

### Kod turunda ZORUNLU (F-001'in GEÇTİ kararı bunlara bağlıdır)

Bunlar öneri değildir; kod QA turunda tek tek aranacaktır.

**K1 — `e2e:dev` koşusunu yabancı 7333 dinleyicisinden yalıt.** Tercih edilen (en ucuz) hâl:
`playwright.dev.config.ts`'te
`webServer: { command: 'npm run dev', env: { MC_PORT: '7433', MC_WEB_PORT: '7434' }, url: 'http://127.0.0.1:7434', reuseExistingServer: false, timeout: 60_000 }`
ve `use: { baseURL: 'http://127.0.0.1:7434' }`; `dev-shell.spec.ts`'in 4. assert'i
`http://127.0.0.1:7433/api/health` olur. Bu, sözleşmenin zaten yazdığı iki mekanizmayı
kullanır (`vite.config.ts` proxy hedefi `MC_PORT`'tan okunur — §2; `dev:web` portu
`MC_WEB_PORT`'tan — §4), yeni kavram getirmez ve dev koşusunda 7333'ü tamamen devre dışı
bırakır. Eşdeğer kabul edilecek alternatif: dev configde `globalSetup` ile "7333'te dinleyen
bir şey varsa koşuyu **kırmızı** bitir" ön kontrolü. Kabul edilmeyecek: hiçbir şey yapmayıp
"port temiz olsun" diye README'ye not düşmek (kanıt yine yanlış yeşil verebilir).

**K2 — guard kapsamına `svg` ekle:** `src/web/**/*.{ts,tsx,css,html,svg}`. Gerekçe:
`src/web/favicon.svg` tarayıcıya servis edilen **işaretlemedir** ve `<image href>` /
`xlink:href` ile dış host taşıyabilir; guard onu atlarsa S1'in F-001'deki tek otomatik kanıtı
bu dosyada kör kalır. Lisans/`.woff2` istisnası aynen korunur. (Ayrıca AC12'nin taranan dosya
listesindeki tekil `index.html` maddesi `src/web/index.html` ile aynı dosyadır — kökte
`index.html` yok, Vite `root: 'src/web'`; kod turunda liste sadeleşsin.)

**K3 — §8'in son cümlesi düzeltilsin:** "`docs/qa/F-001-contract.md` bu haliyle qa-evaluator
tarafından onaylanmıştır" cümlesi sözleşme gövdesinde durmamalı; QA kararı yalnızca denetim
bölümlerinde yaşar (CLAUDE.md: developer kendi işini "geçti" ilan edemez). Bu tur ONAY
verildiği için içerik doğru, ama cümle "onay kaydı: bu dosyanın 'QA sözleşme denetimi — tur 3'
bölümü" biçimine çevrilsin. Frontmatter `status: draft` → `approved` bu turdan sonra
güncellenebilir (defter tutma işi, kanıt değil).

---

### Regresyon kontrolü (tur 2'de onaylanmış bölümler bozuldu mu)

**Bozulma yok.** Tek tek karşılaştırıldı:

| Bölüm | Durum |
|---|---|
| §1 kapsam + dışlama listesi (F-002…F-011, Host/Origin, `data/`) | Değişmemiş; ürün özelliği sızması yok. Üst çubuk "statik/tıklanamaz" kararı aynı, AC10'un "Kapılar/Thread/Token bulunmaz" assert'iyle uyumlu. |
| §3 bağımlılık listesi | Değişmemiş: 2 runtime + 16 dev = 18 paket. Revizyon 3 **hiç yeni paket getirmedi** — `playwright.dev.config.ts` aynı `@playwright/test`'i kullanıyor. Kapalı liste (mimari §3.4) ihlali yok, ADR gerekmiyor. |
| §2 `.gitignore` 7 deseni ↔ §5 AC1 | Birebir aynı, değişmemiş. |
| `ci.yml` tanımı ↔ `tests/ci-workflow.test.ts` | Değişmemiş (`on: [push]`, 3 OS matrisi, `setup-node@v4`/node 22, `npm ci` → `npm run verify`, "Playwright kurulmuyor" yorumu). |
| `.gitattributes` (§2/§3/§9) | Üç yerde tutarlı, değişmemiş. |
| Statik servis sözleşmesi (MIME, `/`→index.html, bilinmeyen yol 404, favicon) | Değişmemiş. `.woff2 → font/woff2` MIME'ı zaten listede — self-host fontlar prod koşusunda doğru servis edilecek, AC11 ile uyumlu. |
| `resolvePort()` + efemeral port kararı | Değişmemiş; 4 vaka aynı; "sabit 7333'e hiç bağlanılmaz" cümlesi duruyor. Not: K1 uygulanınca dev e2e koşusu da sabit porttan kurtulur — bu kararı güçlendirir, çelişmez. |
| §8 bitti tanımı | Yalnızca gerekli yerden değişti: iki e2e komutu (`npm run e2e` + `npm run e2e:dev`) eklendi — tur 2'nin "§8'deki 'hem chromium hem dev projeleri' ifadesi seçilen çözüme göre güncellensin" talebinin birebir karşılığı. Push sonrası paragrafı (üç OS matrisi, "yerel yeşil ≠ GEÇTİ", ara durum tanımı) harfiyen korunmuş. Tek istisna: son cümle → K3. |
| §9 dosya sahipliği | `playwright.dev.config.ts` eklenmiş; mevcut "E2E config" kapsamının doğal parçası, kapsam sızması değil. |
| AC4 assert'i, AC5 alan kümesi/zarfsızlık, AC6 R2 koşulları, AC9 yerel `npm ci` adımı, AC10 renk/luminance assert'i, AC13 README listesi | Değişmemiş; hiçbir assert gevşetilmemiş. |

Kanıt gevşetme taraması: revizyon 3'te hiçbir assert "içeriyor mu" seviyesine düşürülmemiş;
net değişim **+1 assert** (AC7 5→6) ve **+1 koşu** (`e2e:dev`).

---

### Kod turunda doğrulanacaklar (ampirik — sözleşmeyi bloklamaz)

Tur 2'nin 1–6 maddeleri (Tailwind `--color-zinc-950` değişkeni, `vitest`×`vite` peer uyumu,
`with { type: 'json' }` import attribute, `environment: 'node'` altında TSX derlemesi,
Windows süreç ağacı temizliği, `tests/deps.test.ts`'e kapalı liste assert'i önerisi) aynen
geçerlidir, tekrarlanmaz. Bu turda eklenenler:

7. **`use.baseURL` hiçbir configde yazılı değil.** AC3 ve AC7 `page.goto('/')` ve
   `page.request.get('/api/health')` kullanıyor; Playwright `webServer.url`'i baseURL'e
   **çevirmez**. Tanımlanmazsa ilk koşu geçersiz URL hatasıyla **kırmızı** biter (yanlış yeşil
   değil, bu yüzden bloklamaz). Prod: `http://127.0.0.1:7333`; dev: K1'deki değer.
8. **Vitest'in Playwright spec'lerini toplaması.** Vitest'in varsayılan `include` deseni
   `**/*.spec.ts`'i de kapsar → `tests/e2e/shell.spec.ts` ve `dev-shell.spec.ts` `npm test`
   altında çalışmaya kalkar ve patlar. `vitest.config.ts` `include: ['tests/**/*.test.ts?(x)']`
   (veya `exclude: ['tests/e2e/**']`) ile sınırlansın; AC6'nın "≥6 dosya, 0 fail" kanıtı buna
   bağlıdır. Yine kırmızı biter, bloklamaz.
9. **`document.fonts.check` için tek seferlik negatif kontrol.** Kod turunda woff2 dosyası
   geçici olarak yeniden adlandırılıp assert'in **kırmızı** olduğu bir kez gösterilsin
   (kanıtın kanıtı). Ayrıca font isteği ancak fontu kullanan bir render tetiklendiğinde başlar;
   assert `page.goto` + başlık görünür olduktan **sonra** çalıştırılsın, aksi hâlde
   `fonts.ready` erken çözülüp `check()` henüz yüklenmemiş yüz için `false` dönebilir (yanlış
   kırmızı).
10. **Vite build'in font çıktısı.** `index.css`'teki göreli `url('./fonts/...')` referansları
    build'de `dist/web/assets/*.woff2` olarak hash'lenir; prod e2e'de bu isteklerin 200
    döndüğü ilk koşuda teyit edilsin (statik servis `.woff2` MIME'ı sözleşmede zaten var).
11. **İki e2e koşusu ardışık çalıştırılsın**, paralel değil (ikisi de 7333/7334 ailesini
    kullanıyor; K1 uygulanınca dev tarafı 7433/7434'e taşınacağı için bu kısıt gevşer).

---

### Kod turu başlayabilir mi

**Evet.** Sözleşme, 13 kabul kriterinin her biri için ölçülebilir ve iddia ettiğini ölçen bir
kanıt tanımlıyor; tur 1'in "kod, en azından B1/B3/B4/B10/B13/B14 kapanmadan başlamamalıdır"
kuralının tamamı karşılandı. Kod turu K1/K2/K3 ile birlikte başlar — K1 ve K2 birer satırlık
config/glob değişikliğidir, kodun ilk saatinde uygulanır ve sözleşmeyi yeniden açmayı
gerektirmez; K3 metin düzeltmesidir.

**F-001'in GEÇTİ kararının koşulları (değişmedi + eklendi):** yerelde `npm run verify` +
`npm run e2e` + `npm run e2e:dev` + temiz klonda `npm ci` → `verify` yeşil; 13 AC §5'teki
komutlarla kanıtlı; `git status --porcelain` boş; **artı** K1/K2 uygulanmış olmalı; **artı**
push sonrası üç OS'lik GitHub Actions matrisi yeşil (§8, kullanıcı onaylı push).

ESKALE: false — üç turda anlaşmaya varıldı, kullanıcıya eskalasyon gerekmiyor.
