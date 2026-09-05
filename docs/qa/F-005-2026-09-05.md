# QA — F-005 (proje kayıt defteri + chokidar izleme + Ayarlar), kod turu

KARAR: KALDI
ESKALE: false

Tarih: 2026-09-05 · Değerlendiren: qa-evaluator · Tur: kod turu (1)
Değerlendirilen commit'ler: `77e4e3a` · `174c3c6` · `96b9444` · `6ce35d2` · `f076fef`
Bağlayıcı ölçüt: `docs/features/F-005-proje-kayit-izleme.md` 6 AC + `docs/qa/F-005-contract.md`
(sıra: `## CEO onayı` → `## CEO kararı — Ayarlar'ın yeri...` → D16-D19 → A-H → gövde → QA tur 2 NOT'ları)

## Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | 6 | Mutlu yollar uçtan uca gerçek tarayıcıda doğrulandı (ekle/izle/kaldır/kalıcılık/SSE). Ama **rutin bir disk yazma hatası tüm sunucu sürecini öldürüyor** (BLOKLAYICI-1), istemci hiçbir yanıt almıyor. |
| Özellik bütünlüğü | 8 | 6 AC'nin altısı da kanıtlı; AC1'in ertelenen kısmı sözleşme §9 madde 7'de **açıkça** yazılı (gizlenmemiş). Kapsam sızması yok. |
| Görsel/UX | 7 | UX ekran-3 düzeni, Türkçe sözlük, boş/hata/yükleniyor durumları birebir. Ama UX'in birincil dar-panel senaryosunda (320-480px) Ayarlar dişlisi ekran dışına kayıyor (ÖNEMLİ-3). |
| Kod kalitesi | 6 | Testler güçlü (7 bağımsız mutasyonun 6'sı KIRMIZI), ama **hata yolunda hiç `try/catch` yok**, sözleşmenin dayandığı "genel 500 yolu" mevcut değil, bir statik guard kendi yorumunun yarısını yapmıyor, bir mutasyon yeşil kaldı. |

**Karar kuralı:** İşlevsellik ve Kod kalitesi < 7 **ve** bir bloklayıcı var → **KALDI**.

## 1. Komutlar ve gerçek çıktılar (hepsi kendim çalıştırdım)

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` | **0** | typecheck + lint temiz · **Test Files 36 passed (36)** · **Tests 425 passed (425)** · `vite build` ✓ (`dist/web/assets/index-CN1nMwCF.css` 15.37 kB) |
| `npm run e2e` | **0** | **14 passed (15.2s)** (`shell` + `timeline` + `settings`) |
| `npm run e2e:dev` | **0** | **1 passed (3.5s)** |
| `npm audit` | 0 | **found 0 vulnerabilities** |

CEO'nun bildirdiği sayılar (36 dosya / 425 test / 14 / 1) **birebir doğrulandı**.

**Ortam çiti (E2E kendi veri dizini):** ✓ VERIFIED — `playwright.config.ts:9` `createTempDataDir()`
ve `:23` `env: { MC_DATA_DIR: e2eDataDir }`. F-004 hook'unun canlı olayları E2E'yi kirletmiyor.
`playwright.dev.config.ts` `MC_DATA_DIR` vermiyor (F-003'ten devralınan bilinen durum, dev-shell
testi veri okumuyor — F-005 bunu kötüleştirmiyor).

## 2. AC kanıt tablosu

| AC | Kanıt | Sonuç |
|---|---|---|
| AC1 — klasör eklenince `.md`'ler ≤5 sn görünür | **Canlı ölçüm:** çalışan sunucuya (7333, izole `MC_DATA_DIR`) gerçek fixture eklendi, `docs/features/F-003-yeni.md` yazıldı → `/api/stream` üzerinde `event: features` çerçevesi geldi (curl ile ham SSE görüldü). Ayrıca `tests/integration/projects-api.test.ts:155` (SSE, event-driven). "Kanbanda görünür" kısmının devri **sözleşme §9 madde 7'de tam paragraf olarak yazılı** + feature notu AC1 satırında + `docs/progress.md` "Kalan risk" bölümünde → **gizlenmemiş**. | ✓ (devir meşru ve görünür) |
| AC2 — kaldırınca kart/olay kalkar, diskte hiçbir şey değişmez | Tarayıcıda "Kaldır" → liste boş, `/api/health.watchers` 1→**0**, fixture'ın 4 dosyası ve sha256'ları **değişmedi**, silinen yok. `projects-api.test.ts:180-229` manifest testi (sha256+boyut). | ✓ |
| AC3 — geçmiş olaylar kalır, proje geri eklenince görünür | `data/events/**`'e hiç dokunulmuyor (izole veri dizininde `events/` klasörü kaldırma sonrası bozulmadı); statik olarak da `service.ts`/`registry.ts` events'e yazmıyor. | ✓ |
| AC4 — `docs/features` içermeyen yol reddedilir, okunabilir hata | **Tarayıcıda görüldü:** `C:\dev\apps\mission-control\src` → satır içi kırmızı `⚠ Bu klasörde docs/features bulunamadı. Yolu kontrol edin.` (UX metniyle birebir), input değeri+odak korunuyor. `validate-path.test.ts` 16 vaka. | ✓ |
| AC5 — 3 proje aynı anda, proje etiketiyle ayırt edilir | `projects-api.test.ts:238` izolasyon (yalnızca değişen projenin `project_id`'si sinyal üretiyor, sızıntı 0) + `settings.spec.ts:103` 3 satır. | ✓ |
| AC6 — liste kalıcı, restart sonrası korunur | `projects-api.test.ts:358` ikinci `createServer()` aynı `MC_DATA_DIR` → kayıt korunuyor, `watchers === 1`, yeni sunucuda da sinyal üretiyor. Diskte `projects.json` `{version:1,projects:[]}` (atomik tmp+rename, artık `.tmp` yok — başarılı yolda). | ✓ |

## 3. Kendi mutasyon tablom (developer'ın 10'unu tekrarlamadım)

Her mutasyon: uygula → izole test → gözlem → yedekten **birebir** geri al.

| # | Mutasyon (dosya:satır) | Koşulan test | Sonuç |
|---|---|---|---|
| M1 | `validate-path.ts:66` — iki katmanlı `docs/features` kontrolünün **ikinci katmanı** kaldırıldı (`\|\| !fs.statSync(featuresDir).isDirectory()`) | `validate-path.test.ts` | **KIRMIZI** (1 failed / 16) — vaka 4 (`docs/features` bir dosya) yakalandı |
| M2 | `validate-path.ts:62` — `fs.realpathSync.native` → düz `fs.realpathSync` | `validate-path` + `projects-registry` + `projects-api` | **KIRMIZI** (2 dosya, 2 test) — 6 yazım varyantı `1` yerine **3** kanonik dizge üretti; tekilleştirme/409 çöktü |
| M3 | `index.ts:253` — Origin genellemesi eski `POST /api/events` özel-durumuna geri alındı | `projects-api.test.ts` | **KIRMIZI** — cross-origin `POST /api/projects` `403` yerine **201** |
| M4 | `service.ts:87-89` — **kaldırma yolunda** izlenen fixture'ın `README.md` **içeriği değiştirildi** (silme değil, `appendFileSync`) | `projects-api.test.ts` + `no-delete-guard` | **KIRMIZI** — manifest testi sha256 farkını yakaladı (`expected '776aea…' to be 'faa5b4…'`). ⚠ Statik guard bunu **görmedi** (bkz. ÖNEMLİ-2) |
| M5 | `project-watcher.ts:34` — `.md` filtresi `.mdx`'e çevrildi (izleyici sinyali bozuldu) | `project-watcher` + `projects-api` | **KIRMIZI** (5 failed / 16) — AC1, AC4 izolasyon, AC5 restart |
| M6 | `src/web/index.css:9` — `@source "../features/projects/web";` silindi (üretim CSS çiti) | `build-css.test.ts` | **KIRMIZI** (3 failed / 11) — üç `projects/web`-özel sınıfın üçü de çıktıdan düştü; "bayat `dist/` totolojisi" **yok**, `emptyOutDir` gerçekten çalışıyor |
| **M7** | `service.ts:94` — kaldırmada `watchers.delete(id)` çıkarıldı (`stop()` kalıyor) | **tüm süit** | **YEŞİL — 425/425** ⚠ Bkz. ÖNEMLİ-1 |

**Sonuç: 6 KIRMIZI / 1 YEŞİL.** Yeşil kalan mutasyon ölçülmeyen bir çiti işaret ediyor.

## 4. Bulgular

### BLOKLAYICI-1 — Kayıt defteri yazma hatası **tüm sunucu sürecini öldürüyor** (POST ve DELETE)

**Tekrar üretme (ölçüldü, iki ayrı yol):**
1. `MC_DATA_DIR`'de `projects.json` yerine bir **dizin** oluştur (ya da mevcut `projects.json`'ı
   salt-okunur yap: `chmod 444`) → `POST /api/projects` (geçerli yol) gönder.
2. Aynı kurulumda başarılı bir eklemeden sonra `projects.json`'ı salt-okunur yapıp
   `DELETE /api/projects/:id` gönder.

**Beklenen:** istemci `500`/hata gövdesi alır, sunucu ayakta kalır (sözleşme satır 289-291 birebir
şunu iddia ediyor: *"handler genel `500`/loglama yoluna düşer"*); UX'in tanımladığı
`"Liste kaydedilemedi, tekrar deneyin."` banner'ı görünür (`docs/03-ux.md`, sözleşme satır 492).

**Gerçek:** süreç `uncaughtException` ile **exit 1** ile ölüyor. İstemci hiçbir yanıt almıyor;
Zaman Çizelgesi, SSE akışı, tüm panel birlikte gidiyor.

```
Error: EPERM: operation not permitted, rename '...\.projects.33716-3ef557.tmp' -> '...\projects.json'
    at writeAtomic (src\server\store\projects-registry.ts:60:8)
    at Object.remove  (src\server\store\projects-registry.ts:108:5)
    at removeProject  (src\features\projects\server\service.ts:87:30)
    at handleRemoveProject (src\features\projects\server\handlers.ts:87:27)
    at Server.<anonymous>  (src\server\index.ts:305:7)          ← Node.js v24 · SCRIPT_EXIT=1
```
POST yolunda aynı çökme `handlers.ts:67` (`req.on('end')` dinleyicisi içinden) üzerinden gerçekleşir.

**Muhtemel dosya:satır:** `src/server/store/projects-registry.ts:52-61` (`writeAtomic`, hata
yakalamıyor) · `src/features/projects/server/handlers.ts:67` ve `:87` (çağrı `try/catch`'siz) ·
`src/server/index.ts:19-30` (yalnızca `unhandledRejection` güvenlik ağı var, **`uncaughtException`
yok**).

**Neden bloklayıcı:**
- Bu, **F-002'nin B1 bloklayıcısının birebir aynı sınıfı**; ders `src/server/index.ts:19`'daki
  yorumda yazılı ("asıl çözüm `append`'in kendi hata yakalamasıdır") ama yeni yazma yolunda
  uygulanmamış. CLAUDE.md/`kod-turu-kontrolleri` bu deseni açıkça uyarıyor.
- Tetikleyici egzotik değil: Windows'ta AV/yedekleme/indeksleyici kilidi (`EPERM`/`EBUSY` — projenin
  kendi F-002 retention riski aynı sınıfı zaten kabul ediyor), salt-okunur/dolu disk (`ENOSPC`),
  ağ sürücüsündeki `data/`. `resolveProjectPath`'in `realpathSync.native` yarış `ENOENT`'i de
  (sözleşme satır 286-288 bunu **öngörüyor**) aynı çökmeye gider.
- Sözleşmenin dayandığı öncül **yanlış**: "genel 500/loglama yolu" diye bir şey kodda yok.
- `tests/server/store/projects-registry.test.ts:80` bu fırlatmayı **bilerek** assert ediyor
  (`expect(() => registry.add(...)).toThrow()`) — yani tasarım fırlatmayı biliyor, üst katman
  karşılamıyor. Hiçbir test HTTP seviyesinde bu yolu denemiyor.

**Ek (aynı kök):** yazma başarısız olduğunda `.projects.<pid>-<rand>.tmp` artığı silinmiyor
(`writeAtomic`'te `try/finally` yok) ve bellekteki `projects` dizisi diskten **önce** güncellendiği
için (registry.ts:99 / :106) bellek-disk ayrışması oluşuyor. Düzeltmede ikisi de ele alınmalı.

### ÖNEMLİ-1 — İzleyici sayacının **azalması** hiç ölçülmüyor (M7 yeşil kaldı)
`service.ts:94`'teki `watchers.delete(id)` kaldırıldığında **425/425 test yeşil kalıyor**.
Sözleşme §7 yalnızca "ekleme sonrası `=== N`" ve "kapanış sonrası `=== 0`" çitlerini istemişti;
kaldırma sonrası azalma çitlenmemiş. Gerçek kodda davranış **doğru** (tarayıcıda 1→0 ölçtüm), bu
yüzden bloklayıcı değil — ama `/api/health.watchers` bir sızıntı göstergesi olarak satılıyorsa
regresyon çiti olmadan işe yaramaz. **Öneri:** `projects-api.test.ts`'e "kaldırma sonrası
`watchers === N-1`" assert'i.

### ÖNEMLİ-2 — `no-delete-guard` kendi yorumunun yarısını yapmıyor (yazma taraması yok)
`tests/features/projects/no-delete-guard.test.ts:21` yorumu *"hiçbir şeyin silinmediğini/**yazılmadığını**
statik olarak doğrular"* diyor; taranan dizgeler (`unlink`, `rmSync`, `rmdirSync`, `fs.rm(`)
yalnızca **silme**. M4 mutasyonum (`appendFileSync` ile izlenen projeye yazma) bu guard'dan
**geçti**; yalnızca dinamik manifest testi yakaladı. Bloklayıcı değil (manifest testi kapatıyor)
ama guard yanlış güven veriyor: ya yorum düzeltilmeli ya `writeFileSync`/`appendFileSync`/`mkdirSync`
dizgeleri (`projects-registry.ts` istisnasıyla) taramaya eklenmeli.

### ÖNEMLİ-3 — Dar panelde (UX'in birincil senaryosu) Ayarlar dişlisi ekran dışında
`docs/03-ux.md:17` panelin **≈320-480px** VS Code Simple Browser panelinde açılacağını ve
navigasyonun *"hamburger menüsü, gizli navigasyon veya ikinci bir tıklama katmanı gerektirmez"*
olacağını; `:21` Ayarlar'ın **"sağda sabit bir dişli ikonu"** olduğunu söylüyor.
Uygulamada düğme `overflow-x-auto` başlık şeridinin içinde `ml-auto` ile duruyor
(`src/web/App.tsx:28,45`): **375px'te dişli görünmüyor**, kullanıcı başlığı yatay kaydırmadan
Ayarlar'a ulaşamıyor. Kanıt: `docs/qa/screens/F-005-2026-09-05-mobil.png`.
Hiçbir test dar genişlikte Ayarlar'ın görünürlüğünü ölçmüyor.

### ÖNEMLİ-4 — Manifest testi boş dizin silinmesini yakalamaz
`projects-api.test.ts:70-89` `snapshotManifest` yalnızca **dosyaları** yürüyor; fixture'daki
`docs/approvals/` (boş) silinse manifest aynı kalırdı. CEO kararı C'nin ("izlenen projede hiçbir şey
değişmez") küçük bir boşluğu. **İçerik değişikliği tarafı sağlam** (M4 KIRMIZI) — bu yalnızca
dizin sınıfı.

### NOT-1 — `feature_count` canlı tazelenmiyor
Tarayıcıda ölçtüm: fixture 3 `.md` içerirken satır "2 feature" göstermeye devam etti (`features`
sinyali listeyi refetch etmiyor, yalnızca `projects` kanalı state'i değiştiriyor —
`useProjects.ts` tasarımı). Hiçbir AC istemiyor, F-007'nin `features` tüketimiyle doğal olarak
kapanır; **karar üzerinde etkisi yok.**

### NOT-2 — Sözleşme/gerçeklik küçük sapmaları
(a) `validate-path.test.ts` **16** vaka içeriyor, sözleşme §7 "≈20 vaka" diyor (tablo satırlarının
bir kısmı tek testte birleştirilmiş — kapsam var, sayı farklı).
(b) Sözleşme §2.2 registry testini `tests/features/projects/server/projects-registry.test.ts`
olarak gösteriyor; gerçek yol `tests/server/store/projects-registry.test.ts`.
(c) Feature notunun "Dosya sahipliği" satırı hâlâ eksik (`package.json`, `src/web/App.tsx`,
`src/server/index.ts`, `src/web/index.css`, `src/web/lib/useEventStream.ts`, `tests/e2e/shell.spec.ts`,
`tests/web/App.test.tsx`) — sözleşme §2.2 hepsini gerekçelendirmiş ve §9 madde 2 bu güncellemeyi
zaten istemişti; yapılmamış. **Kapsam sızması değil**, not tutarsızlığı.

## 5. Manifest testi denetimi (görev maddesi 4)

**Soru:** test gerçekten hem silmeyi hem değiştirmeyi yakalıyor mu, yoksa yalnızca dosya listesi mi
karşılaştırıyor?

**Cevap: her ikisini de yakalıyor.** `projects-api.test.ts:70-89` manifest girdisi
`(göreli yol, boyut, sha256)`; `:217-225` üç ayrı iddia kuruyor: (a) `after`'daki her yol
`before`'da **var** (yeni/beklenmeyen dosya → `expect(prior).toBeDefined()` kırmızı),
(b) `sha256` ve `size` birebir aynı (**içerik değişikliği** kırmızı), (c) `after.length ===
before.length + 1` (**silme** kırmızı).
**Kendi mutasyonumla sınadım (M4):** kaldırma yolunda `README.md`'nin içeriği değiştirildi (silme
**değil**) → test **KIRMIZI** (`expected '776aea…' to be 'faa5b4…'`). Yeşil kalmadı → **bloklayıcı yok.**
`tests/e2e/settings.spec.ts:82-101` aynı garantiyi gerçek tarayıcı akışında (relPath+sha256 dizisi
`toEqual`) tekrar ediyor. Tek boşluk: boş dizinler (ÖNEMLİ-4).

## 6. chokidar ölçümünün teyidi (görev maddesi 5)

Bağımsız betikle (depo dışında, kalıntı bırakmadan) **kendim ölçtüm**, gerçek
`watchProjectFeatures` + gerçek `chokidar@4.0.3`, aynı Windows makinesi:

| Senaryo | Developer'ın bildirdiği | **Benim ölçümüm** |
|---|---|---|
| Dizin sil + yeniden oluştur → `.md` yazımı sinyal üretiyor mu | Evet (kurtarıyor) | **Evet** — taban `onChange`=1, yeniden oluşturma sonrası **3** (unlink+add); sinyal geri geldi |
| Dizin silinmiş kalırken 1 sn'de ham olay | **0** | **0** (eşik `<500`, `fs.watch` tabanı 112.535 idi) |
| Dizin silinmiş kalırken 3 sn'de ham olay | 0 | **0** |
| CPU (~3 sn) | ~3,9 ms | Tekrarlanmadı (kendi tsx harness'ımın gürültüsü baskın). Sözleşme NOT-2 bu metriği zaten **assert dayanağı olmaktan çıkarmıştı**; bağlayıcı metrik (ham olay sayısı) birebir doğrulandı. |

`tests/server/watch/project-watcher.test.ts` 5/5 yeşil (ayrıca M5 mutasyonuyla ölçtüğünü kanıtladı).
ADR-012'nin `fs.watch` → chokidar kararı **ampirik olarak yerinde**.

## 7. Sekme deseni / `hidden` / erişilebilirlik (görev maddeleri 7-8)

Gerçek tarayıcıda `getComputedStyle` ile ölçüldü (üretim build'i, `npm start`):

```
timelineDisplay: "block"   settingsDisplay: "none"
timelineInDom: true        settingsStillInDom: true      ← iki panel de mount kalıyor
aria-pressed: "false"→"true"→"false"   headerButtons: 1   tabRoles(tab/tablist): 0
```
- **Sekme deseni yok:** `role="tablist"`/`tab`/`aria-selected` sıfır (`App.tsx:40,43` statik
  `<span>`). `shell.spec.ts:41-53` bunu gerçekten ölçüyor (tıklanabilir sayısı **1** + `header
  [role="tab"]` **0**); `tests/web/App.test.tsx` jsdom katmanında aynısını ölçüyor — **iki katman
  da güncellenmiş**, yapısal KIRMIZI bırakılmamış.
- **`hidden` gerçekten gizliyor:** E2E'de gerçek hesaplanmış `display` assert'i var
  (`settings.spec.ts:130-146`) ve benim bağımsız ölçümüm de doğruladı. Developer'ın 8b mutasyonu
  bu assert'in ölçtüğünü kanıtlıyor.
- **F-003 garantisi korunmuş:** Ayarlar açıkken `TimelineScreen` DOM'da kalıyor (unmount yok).
- **Klavye:** Ayarlar gerçek `<button type="button">`, odaklanabilir; odak sırası
  Ayarlar → Duraklat (Zaman Çizelgesi kontrolleri). `aria-label="Ayarlar"` + `aria-pressed`
  (anahtar düğme için doğru rol tercihi). Gizli panelin içindekiler `display:none` olduğu için
  odak sırasına girmiyor.

## 8. Kapsam ve güvenlik denetimi (görev maddeleri 9-10)

`git diff 6613f28..HEAD --stat` → 37 dosya, 2870+/47-. **Sızma yok:**
yazma kapısı (F-006) yok, kanban/`FeatureCard` türetimi (F-007) yok, Faz 2 ekranı yok,
`scripts/install-hook.mjs` **hiç dokunulmamış**, sunucu taraflı olay filtreleme yok.
Dokunulan paylaşılan dosyaların (`package.json`, `src/web/App.tsx`, `src/server/index.ts`,
`src/web/index.css`, `src/web/lib/useEventStream.ts`, `src/shared/types.ts`) **hepsi** sözleşme
§2.2'de satır satır gerekçelendirilmiş (feature notu listesi eksik — NOT-2c).

| Güvenlik kontrolü | Sonuç |
|---|---|
| İzlenen projelere yazma/silme | Dinamik manifest testi ✓ (M4 ile kanıtlandı); statik guard yalnızca silme tarafını kapsıyor (ÖNEMLİ-2) |
| `127.0.0.1` dışı ağ literali | `tests/no-external-host.test.ts` **76 test yeşil**; `walk()` yeni `projects/`+`watch/` dizinlerini otomatik kapsıyor (✓ VERIFIED, dosya değişmemiş) |
| Origin/CSRF genellemesi | `index.ts:253` tüm non-GET `/api/*` → M3 mutasyonu KIRMIZI; `GET`'in Host çiti ayrıca test edilmiş (`projects-api.test.ts:293`) |
| Yeni bağımlılık (`chokidar@4.0.3`) | `tests/deps.test.ts` yeşil, beyaz liste değişmemiş; `npm audit` **0 açık**; `fsevents` hâlâ darwin-only+optional |
| Kayıt defteri atomik yazma | tmp+rename ✓ (`registry.ts:52-61`), `fsync` bilinçli atlanmış (§4.1). **Ama** hata yolunda tmp artığı temizlenmiyor (BLOKLAYICI-1 eki) |
| DELETE yol ayrıştırma | `id` boş veya `/` içeriyorsa 404 (`index.ts:293-296`) — yol geçişi yok |

## 9. Görsel doğrulama

Kurulum: `npm run build` çıktısı + `npx tsx src/server/index.ts`, `MC_PORT=7333`,
**izole `MC_DATA_DIR`** (scratchpad), gerçek geçici fixture proje (`docs/features/` içinde 2 `.md`).

Ekran görüntüleri:
- `docs/qa/screens/F-005-2026-09-05.png` (1280px — proje eklenmiş hâl)
- `docs/qa/screens/F-005-2026-09-05-mobil.png` (375px — ÖNEMLİ-3 kanıtı)

Gözlemler:
- **Stil üretiliyor** (F-003'ün B1 hatası tekrar etmemiş): satır düzeni, `● izleniyor` yeşil nokta
  + metin (renk körlüğü kuralı ✓), mono yol sütunu `…` ile kırpılmış, "2 feature", `Kaldır` butonu,
  altta "Depo bilgisi: …" satırı (`docs/03-ux.md:137` birebir).
- **Boş durum:** "Henüz izlenen proje yok. Başlamak için bir App Factory proje klasörü ekleyin."
  `Ekle` butonu girdi boşken **disabled**.
- **Hata durumu:** geçersiz yolda satır içi `⚠ Bu klasörde docs/features bulunamadı. Yolu kontrol
  edin.` (`role="alert"`), input değeri ve odak korunuyor.
- **Ekleme→izleme→kaldırma** akışının tamamı tarayıcıdan çalıştı; kaldırma sonrası fixture'ın
  4 dosyası ve hash'leri değişmedi, `watchers` 1→0.
- Konsolda tek "hata" 400 yanıtının tarayıcı kaynak logu (uygulama hatası değil); sayfa yükünde
  hata yok (`shell.spec` zaten çitliyor).

## 10. Temizlik kanıtı

- **Çalışma ağacı:** 7 mutasyonun tamamı yedekten birebir geri alındı; `git status --porcelain`
  **boş**, `git diff HEAD --stat` **boş** (mutasyonlardan sonra ve rapor öncesi iki kez ölçüldü).
  Bu turda eklenen tek yeni dosyalar: bu rapor, `docs/qa/latest.md` ve iki ekran görüntüsü.
- **Süreçler/portlar:** QA sunucusu (`tsx` pid 21600 + node pid 26992) durduruldu.
  `netstat -ano | grep -E ':(7333|7334|7335|7433|7434)'` → **aktif LISTENING yok** (yalnızca
  kapanmış `TIME_WAIT` kayıtları). Yetim `npm run dev` ağacı bırakılmadı.
- Geçici fixture'lar ve veri dizinleri yalnızca scratchpad altında; **gerçek proje klasörlerine
  hiçbir şey yazılmadı**. `.playwright-mcp/` zaten `.gitignore`'da.

## 11. Düzeltme turu için istenenler

1. **(BLOKLAYICI)** `POST`/`DELETE /api/projects` yazma hatasında süreç ölmesin: `writeAtomic`
   hatasını yakala, `500` + Türkçe gövde döndür, `.tmp` artığını `finally` ile temizle, bellek
   durumunu diske yazılamadığında geri al. Aynı kapsamda `resolveProjectPath`'in fırlatabildiği
   yolları da sar. **Mutasyon kanıtı istiyorum:** hata enjekte edildiğinde istemcinin `500` aldığı
   ve sonraki `GET /api/health`'in hâlâ `200` döndüğü bir test; testi kasten bozup KIRMIZI gördür.
   Sözleşmenin "genel 500 yolu" cümlesi (satır 289-291) gerçeğe uydurulsun.
2. **(ÖNEMLİ-1)** Kaldırma sonrası `watchers === N-1` çiti ekle (M7'nin bir daha yeşil kalmaması).
3. **(ÖNEMLİ-2)** `no-delete-guard`'ın yorumunu gerçeğe uydur **veya** yazma dizgelerini taramaya ekle.
4. **(ÖNEMLİ-3)** Ayarlar dişlisi 320-480px'te görünür kalsın (UX `:17`/`:21`); dar genişlikte
   görünürlüğü ölçen bir E2E assert'i ekle.
5. **(ÖNEMLİ-4 / NOT-2)** Manifest'e dizin girdileri; feature notunun dosya sahipliği listesini ve
   sözleşme §2.2'deki registry test yolunu düzelt.
