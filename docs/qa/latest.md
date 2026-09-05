# QA — F-005 (proje kayıt defteri + chokidar izleme + Ayarlar), düzeltme turu 1 doğrulaması

KARAR: KOŞULLU GEÇTİ
ESKALE: false

Tarih: 2026-09-05 · Değerlendiren: qa-evaluator · Tur: düzeltme turu 1 (dar doğrulama)
Değerlendirilen commit: `cc77b1f` (öncesi: `f076fef`) · Önceki tur raporu: `docs/qa/F-005-2026-09-05.md` (KALDI)
Kapsam: yalnızca D20-D24'ün kapanışı + düzeltmenin ürettiği regresyon. Önceki turda onaylanan
bölümler (manifest içerik değişikliği, chokidar ölçümü, kapsam/güvenlik, sekme deseni, `hidden`,
görsel akış) **yeniden açılmadı**.

**KOŞULLU GEÇTİ ne demek:** BLOKLAYICI yok, D20-D24'ün beşi de kapandı, dört boyutun hiçbiri < 7.
Ama iki ÖNEMLİ açık (biri ölçülmeyen çit, biri D20'nin istemci tarafındaki yarısı). Bunlar
kapanana kadar feature notu `status: fix` kalır; ikisi de mekanik (bir entegrasyon assert'i + bir
UI mesajı), yeni bir tam QA turu gerektirmez — düzeltme sonrası `verify` + bu iki noktanın
mutasyonu yeterlidir.

## Puanlar

| Boyut | Puan (önceki) | Gerekçe |
|---|---|---|
| İşlevsellik | **8** (6) | Bloklayıcı gerçekten kapandı: canlı sunucuda `projects.json` bir dizinle işgal edilirken POST **ve** DELETE `500 storage_unavailable` döndü, süreç yaşadı, `.tmp` artığı 0, bellek diskle tutarlı, engel kalkınca ilk istek başarılı. Sınır başka bir handler'ın senkron hatası için de çalışıyor (canlı probe). Kalan: DELETE hatası istemcide sessizce yutuluyor (ÖNEMLİ-2). |
| Özellik bütünlüğü | **8** (8) | D20-D24'ün beşi de uygulanmış ve (biri hariç) ölçülüyor; feature notunun dosya sahipliği listesi güncellenmiş. D20'nin UX yarısı yalnızca ekleme yolunda tam. |
| Görsel/UX | **7** (7) | 375px'te dişli artık **sabit ve tıklanabilir** (kendi ölçümüm: `x=280 … 359 ≤ 375`, sayfa yatay taşması yok). Bedeli: marka "MISSION CONTRO" olarak kırpılıyor ve nav etiketleri 168px'lik kaydırma şeridinin içinde kalıyor (NOT-3). Başarısız "Kaldır" hiçbir geri bildirim vermiyor (ÖNEMLİ-2). |
| Kod kalitesi | **7** (6) | 12 bağımsız mutasyonun **9'u KIRMIZI**; hata yolu artık gerçekten test edilmiş (tmp temizliği, bellek-disk sırası, 500 gövdesi). Ama sistemik sınırın **bağlantısı** çitsiz (ÖNEMLİ-1), guard'ın registry istisnası gerçek bir silmeyi kaçırıyor (NOT-1), gerekçesi yanlış ölü bir satır içi stil kaldı (NOT-2). |

**Karar kuralı:** BLOKLAYICI yok + tüm puanlar ≥ 7 → KALDI değil. İki açık ÖNEMLİ → GEÇTİ de değil.

## 1. Komutlar ve gerçek çıktılar (hepsi kendim çalıştırdım)

| Komut | Sonuç |
|---|---|
| `npm run verify` | **Test Files 36 passed (36)** · **Tests 430 passed (430)** · `vite build` ✓ (`dist/web/assets/index-BoXlmb-4.css` 15.34 kB) |
| `npm run e2e` | **15 passed (15.2s / 14.6s)** — iki kez |
| `npm run e2e:dev` | **1 passed** — iki kez |
| `npx vitest run` (mutasyonlar sonrası temiz ağaçta ×4) | 4/4 kez **36/36 · 430/430** |

CEO'nun bildirdiği sayılar (36 dosya / 430 test / 15 / 1) **birebir doğrulandı**.

**Tek anormallik (NOT-5):** 5 tam süit koşusundan **1'i** `[vitest-pool]: Worker forks emitted error`
ile yarıda kesildi (`Test Files 35 passed (36)` · `Tests 420 passed (430)` · `Errors 1`); zincir
orada durdu (`vite build` hiç koşmadı), yani sessiz bir yeşil değil. Aynı ağaçta arka arkaya 4
koşu tertemiz. Bir süreç ağacını yeni öldürmüştüm; 36 worker fork'unun Windows'ta ara sıra
tökezlemesi test altyapısı gürültüsü olarak değerlendirildi — ürün kodu bulgusu değil.

## 2. D20-D24 kapanış tablosu

| Karar | Durum | Kanıt |
|---|---|---|
| **D20** — sistemik hata sınırı | **KAPANDI** (istemci tarafı yarısı kısmen — ÖNEMLİ-2) | `src/server/index.ts:145-181` `withDispatchErrorBoundary` + `:288` bağlantısı; `src/features/projects/server/service.ts:107-120, 129-135` kaynakta yakalama; `handlers.ts:71-72` (POST 500) ve `:91-99` (DELETE 500). Canlı ölçüm bu raporun §4'ünde. Testler: `tests/integration/projects-api.test.ts:452-560` (POST/DELETE), `:565-616` (sınırın birimi). Mutasyonlar M2/M3/M4 KIRMIZI. |
| **D21** — izleyici sayacı çiti | **KAPANDI** | `tests/integration/projects-api.test.ts:299-323` "kaldırma sonrası `watchers === N-1`". **M5** (`service.ts:140` `watchers.delete(id)` silindi) → **KIRMIZI** (`expected 2 to be 1`). Önceki turda aynı mutasyon 425/425 yeşil kalıyordu. |
| **D22** — guard yorumu/kapsamı | **KAPANDI** (kapsam daraldı — NOT-1) | `tests/features/projects/no-delete-guard.test.ts:22-24` `WRITE_SUBSTRINGS = ['writeFileSync','appendFileSync','mkdirSync']`. **M6** (`service.ts`'e `fs.appendFileSync` eklendi) → guard **KIRMIZI**. Yorum ile tarama artık aynı şeyi söylüyor. |
| **D23** — dar genişlik | **KAPANDI** | `src/web/App.tsx:28-48` (kaydırma yalnızca başlık+nav bölgesinde; dişli `shrink-0` ile dışarıda). `tests/e2e/shell.spec.ts:133-152` 375px `boundingBox()` assert'i. **M11b** (başlık `f076fef`'teki hâline döndürüldü) → **KIRMIZI** (`Expected: <= 375 / Received: 593.984375`). Kendi tarayıcı ölçümüm §5'te. |
| **D24** — manifest boş dizinler + dosya sahipliği | **KAPANDI** | `tests/integration/projects-api.test.ts:64-92` manifest artık `kind: 'dir'` girdileri de üretiyor. **M8** (izlenen projede boş `docs/approvals` silindi) → **KIRMIZI** (`expected 11 to be 12`). Feature notu `docs/features/F-005-proje-kayit-izleme.md:24-33` paylaşılan dosyaları tek tek listeliyor. |

## 3. Kendi mutasyon tablom

Her mutasyon: uygula → hedef testi koş → gözlem → yedekten **birebir** geri al (md5 karşılaştırmalı).

| # | Mutasyon (dosya:satır) | Koşulan test | Sonuç · hata mesajının ilk satırı | Geri alındı |
|---|---|---|---|---|
| M1 | `index.ts:288-289` — sınırın **bağlantısı** kaldırıldı (`http.createServer(withDispatchErrorBoundary(fn))` → `http.createServer(fn)`) | tüm süit | **YEŞİL — 430/430** ⚠ ÖNEMLİ-1 | ✓ |
| M2 | `index.ts:148-151` — `withDispatchErrorBoundary` içindeki `try/catch` boşaltıldı | `projects-api` | **KIRMIZI** (2) — `AssertionError: expected [Function] to not throw an error but 'Error: boom' was thrown` | ✓ |
| M3 | `service.ts:115-120` — `registry.add` etrafındaki `try/catch` kaldırıldı | `projects-api` | **KIRMIZI** — `Error: Test timed out in 5000ms.` + `Unhandled Errors: EPERM … rename` (istemci hiç yanıt alamıyor) | ✓ |
| M4 | `service.ts:129-135` — `registry.remove` etrafındaki `try/catch` kaldırıldı | `projects-api` | **KIRMIZI** — `expected 'internal_error' to be 'storage_unavailable'` (dağıtıcı sınırı yakaladı → sınırın gerçek HTTP'de çalıştığının yan kanıtı) | ✓ |
| M5 | `service.ts:140` — `watchers.delete(id)` kaldırıldı | tüm süit | **KIRMIZI** — `expected 2 to be 1` (429/430) | ✓ |
| M6 | `service.ts:137` — izlenen projeye `fs.appendFileSync` yazımı eklendi | `no-delete-guard` | **KIRMIZI** — `… izlenen proje köklerine silme/yazma alt dizgesi içermiyor` | ✓ |
| M7 | `projects-registry.ts:remove` — izlenen projenin `README.md`'si `fs.unlinkSync` ile **silindi** | `no-delete-guard` | **YEŞİL — 11/11** ⚠ NOT-1 (dinamik manifest testi ayrıca KIRMIZI verdi) | ✓ |
| M8 | `projects-registry.ts:remove` — izlenen projede **boş** `docs/approvals` dizini silindi | `projects-api` | **KIRMIZI** — `expected 11 to be 12` | ✓ |
| M9 | `projects-registry.ts:writeAtomic` — `projects = nextProjects` yazmadan **önceye** alındı | `projects-registry` + `projects-api` | **KIRMIZI** (3) — `expected [ { id: 'p_275d17', …(6) } ] to have a length of +0 but got 1` | ✓ |
| M10 | `projects-registry.ts:writeAtomic` — `.tmp` temizliği (`unlinkSync`) kaldırıldı | `projects-registry` + `projects-api` | **KIRMIZI** (3) — `expected [ '.projects.32572-98507a.tmp' ] to have a length of +0 but got 1` | ✓ |
| M11a | `App.tsx:41` — `style={{ minWidth: 0 }}` kaldırıldı | `shell.spec.ts` (yeniden build ile) | **YEŞİL — 2/2** ⚠ NOT-2 (satır gereksiz) | ✓ |
| M11b | `App.tsx` tamamen `f076fef`'teki (düzeltme öncesi) başlığa döndürüldü | `shell.spec.ts` | **KIRMIZI** — `expect(received).toBeLessThanOrEqual(expected) / Expected: <= 375 / Received: 593.984375` | ✓ |

**Sonuç: 9 KIRMIZI / 3 YEŞİL.** Önceki turda yeşil kalan mutasyon (M7 = izleyici sayacı) artık
kırmızı. Yeni yeşiller: sınırın bağlantısı (ÖNEMLİ-1), guard'ın registry istisnası (NOT-1) ve
gereksiz satır içi stil (NOT-2).

## 4. Hata sınırı denetimi (görev maddesi 1)

Ölçüm kurulumu: `npm run build` + `node node_modules/tsx/dist/cli.mjs src/server/index.ts`
(npm sarmalayıcısı atlanmadan **doğrudan** tsx, pid izlenerek), `MC_PORT=7333`/`7433`, **izole
`MC_DATA_DIR`** (scratchpad), gerçek geçici fixture proje. Gerçek proje klasörlerine yazılmadı.

### 4.1 Sınır gerçekten genel mi? — **senkron: evet, asenkron: hayır (tasarım gereği)**

| Enjeksiyon | Yol | Sonuç |
|---|---|---|
| `handleHealth`'in gövdesine `throw new Error('qa-probe-sync')` (`/api/projects` **değil**) | dağıtıcının kendi çağrı yığını (senkron) | **`500 internal_error`** + gövde `"Beklenmeyen bir sunucu hatası oluştu. Tekrar deneyin."` · süreç **yaşadı** (`AFTER: GET /api/projects → 200`) · stderr: `Hata: istek işlenirken beklenmeyen hata oluştu, 500 dönülüyor: qa-probe-sync` |
| `handleAddProject`'in `req.on('end')` dinleyicisine `throw new Error('qa-probe-async')` | asenkron dinleyici (ayrı çağrı yığını) | **süreç `exit 1`** (`uncaughtException`), istemci `ECONNRESET`, sonraki istek `ECONNREFUSED` |

Yani sınır **rota-bağımsız** (her handler'ı kapsar) ama **yığın-bağımlı**: yalnızca dağıtıcıdan
senkron fırlayanı yakalar. Bu, `src/server/index.ts:130-144`'teki yorumda **açıkça ve dürüstçe**
yazılı — gizlenmiş bir iddia yok. Asenkron yolu iki handler kendi kaynağında kapatıyor:
`ingest.ts:53-88` (`try/catch` → 503) ve `service.ts:107-135` (→ 500). Reddedilen promise için
`index.ts:24-30`'daki `unhandledRejection` güvenlik ağı hâlâ yerinde.
**Kalan yüzey (NOT-4):** `service.ts:124-125` (`startWatchingIfPossible` → `chokidar.watch`,
`hub.broadcast` → kapanmış bir SSE soketine `res.write`) `try` bloğunun **dışında** ve asenkron
yığında; buradan fırlayacak bir hata bugün hâlâ süreci düşürür. Bilinen tetikleyicisi yok
(chokidar hataları event olarak yayılır), bu yüzden NOT.

### 4.2 `.tmp` artığı ve bellek-disk tutarlılığı — **ikisi de ölçüldü, ikisi de doğru**

Canlı sunucuda (`projects.json` yerine dizin):

```
DELETE  → 500 {"success":false,"error":{"code":"storage_unavailable","message":"Liste kaydedilemedi, tekrar deneyin."}}
health  → 200                     (süreç yaşıyor)
GET /api/projects → kayıt HÂLÂ listede   (başarısız silme belleğe yansımadı)
".tmp" artığı sayısı → 0
POST    → 500 storage_unavailable ;  watchers → 1  (değişmedi)
engel kaldırıldı → DELETE → {"success":true,"data":{"removed":true}} ; disk: {"version":1,"projects":[]} ; watchers → 0
```

Kod tarafı: `projects-registry.ts:59-84` — `projects = nextProjects` ataması `renameSync`
**başarılı olduktan sonra**; hata dalında `.tmp` `unlinkSync` ile siliniyor ve orijinal hata
yeniden fırlatılıyor. M9 ve M10 mutasyonları bu iki garantinin de **ölçüldüğünü** kanıtladı.

## 5. Görsel teyit — 375px (görev maddesi 4)

Ekran görüntüleri: `docs/qa/screens/F-005-fix1-2026-09-05-qa-375.png` (Ayarlar açık),
`docs/qa/screens/F-005-fix1-2026-09-05-qa-storage-error.png` (yazma hatası anındaki UI).

Gerçek tarayıcıda (üretim build'i, 375×700), **kaydırma yapmadan** ölçtüm:

```
viewport 375 · document.scrollWidth 375      ← sayfa artık yatay taşmıyor
gear  x=280  w=79  sağ kenar=359  visibility=visible   → tıklandı, aria-pressed=true, Ayarlar açıldı
title x=16   w=178.6 ; kaydırma şeridi clientWidth=168 → marka görsel olarak kırpık
nav   x=218.6 … 411  → şeridin dışında, yalnızca yatay kaydırmayla görünür
```

**Dişli görünür ve tıklanabilir: evet.** ÖNEMLİ-3 kapandı.

**Başlık kırpılması hakkında görüşüm (NOT-3):** kabul edilebilir, **bulgu değil ama borç**.
Kırpılan şey markadır; tek gerçek etkileşimli giriş (dişli) ve bağlantı rozeti tam görünür,
sayfa taşması gitti. Buna karşılık düzeltme, düzeltme öncesinde görünen "Zaman Çizelgesi /
Kanban" etiketlerini 168px'lik şeridin arkasına itti; bugün bunlar `role`/`onClick` taşımayan
statik etiketler olduğu için gezinme kaybı yok. **F-007 Kanban'ı gerçek sekmeye çevirdiğinde**
bu düzen `docs/03-ux.md:17`'nin "gizli navigasyon olmasın" kuralını dar panelde ihlal eder —
o feature'ın sözleşmesine "375px'te iki sekme de kaydırmasız görünür" kabul kriteri konmalı.

## 6. Bulgular (2 ÖNEMLİ · 6 NOT)

### ÖNEMLİ-1 — D20'nin ana teslimatı (dağıtıcı sınırı) **bağlantı düzeyinde çitsiz**
**Tekrar üretme:** `src/server/index.ts:288-289`'da `withDispatchErrorBoundary(` sarmalayıcısını
kaldır (`http.createServer(((req, res) => { … }))`) → `npx vitest run` → **430/430 YEŞİL**.
**Beklenen:** en az bir test kırmızı (sınır uygulamadan koparıldı).
**Gerçek:** hiçbir test görmüyor. Sınırın **mantığı** iki birim testiyle çitli
(`projects-api.test.ts:565-616`, sahte `res` ile doğrudan `withDispatchErrorBoundary` çağrılıyor)
ama **uygulamaya bağlı olduğu** hiçbir yerde ölçülmüyor.
**Şiddet:** BLOKLAYICI değil — ürün kodu doğru ve canlı probe ile kanıtlandı (§4.1: gerçek
sunucuda `/api/health`'in senkron hatası 500 dönüyor, süreç yaşıyor). Ama bu, önceki turdaki
ÖNEMLİ-1 ile aynı sınıf: "yeşil kalan mutasyon = ölçmeyen test". Brief bu mutasyonun yeşil
kalmasını BLOKLAYICI sayıyordu; ölçtükten sonra ÖNEMLİ'ye indiriyorum çünkü davranış gerçekten
doğru ve bilinen tüm fırlatma yolları ikinci bir katmanda (kaynakta) da yakalanıyor.
**Öneri (ucuz):** gerçek HTTP üzerinden bir entegrasyon assert'i — dağıtıcının çağırdığı bir
handler'ı test içinde fırlatacak şekilde tetikle (ör. `createServer` sonrası `serveStatic`
yoluna erişilemeyen bir istek ya da enjekte edilebilir bir handler) ve `500` + sonraki
`GET /api/health` `200` bekle. Mevcut iki birim testi kalsın, bu üçüncüsü bağlantıyı çitler.
**Dosya:** `src/server/index.ts:288`.

### ÖNEMLİ-2 — D20'nin istemci yarısı: **başarısız "Kaldır" sessizce yutuluyor**
**Tekrar üretme (gerçek tarayıcı, 375px):** izlenen bir proje varken `MC_DATA_DIR/projects.json`'ı
bir dizinle değiştir → panelde **Kaldır**'a tıkla.
**Beklenen:** kullanıcı bir hata görür (sunucu zaten `500` + `"Liste kaydedilemedi, tekrar
deneyin."` gövdesini döndürüyor; aynı senaryoda **Ekle** yolu bu banner'ı **gösteriyor** —
ekran görüntüsü `…-qa-storage-error.png`).
**Gerçek:** hiçbir şey olmuyor. `role="alert"` sayısı **0**, sayfa metninde "Liste kaydedilemedi"
**yok**, satır yerinde kalıyor (durum doğru ama sessiz). Kullanıcı için buton "çalışmıyor" gibi
görünür; tekrar tıklamak da aynı sessizliği verir. Konsolda yalnızca tarayıcının kendi
`500 (Internal Server Error)` kaynak logu var.
**Muhtemel dosya:satır:** `src/features/projects/web/useProjects.ts:97-105` — `remove()` içinde
`if (!res.ok) return` (yorum: *"sessizce yut — SSE `projects` kanalı zaten gerçek durumu
senkronize edecek"*). Bu gerekçe hata durumunda geçersiz: yazma başarısız olduğu için SSE
`projects` çerçevesi **hiç yayınlanmıyor** (`service.ts:142` sadece başarı yolunda `broadcast`),
yani senkronize edecek bir olay yok.
**Şiddet:** BLOKLAYICI değil (veri güvende, liste yalan söylemiyor, süreç yaşıyor); ama D20'nin
"kullanıcı ne görür" yarısı ekleme yolunda kapatılmışken kaldırma yolunda açık kaldı ve
`docs/03-ux.md:289` bu ekran için "Liste kaydedilemedi, tekrar deneyin." metnini tanımlıyor.
**Öneri:** `remove()` de `add()` gibi `{ ok, message }` döndürsün, `SettingsScreen` satır içi/
banner olarak göstersin; `useProjects.test.ts`'e 500 vakası + `SettingsScreen.test.tsx`'e
görünürlük assert'i.

### NOT-1 — `no-delete-guard`'ın registry istisnası gerçek bir silmeyi kaçırıyor
D22 düzeltmesi `projects-registry.ts`'i taranan listeden **tamamen** çıkardı
(`no-delete-guard.test.ts:26-33`) ve yerine yalnızca `rmSync|rmdirSync|fs.rm(` arayan dar bir
test koydu (`:50-55`). **M7:** `registry.remove` içine izlenen projenin `README.md`'sini silen
`fs.unlinkSync(...)` koydum → guard **11/11 yeşil**. Dinamik manifest testi yakaladığı için
(2 test KIRMIZI) risk kapalı; ama statik katman `unlink` için artık kör. Öneri: istisnayı dosya
düzeyinde değil **dizge düzeyinde** yap (yalnızca `unlinkSync(tmpPath)` biçimine izin ver).

### NOT-2 — `style={{ minWidth: 0 }}` gereksiz; gerekçe yorumu gerçeğe uymuyor
`src/web/App.tsx:41`. **M11a:** satırı kaldırdım → 375px E2E **yeşil** ve dişli hâlâ yerinde.
Sebep: CSS spec'e göre `overflow-x: auto` taşıyan bir flex öğesinde `min-width:auto` zaten `0`
olarak çözülür. Öğenin üstündeki 10 satırlık yorum bu satırın "aksi hâlde `<header>` taşardı"
diye zorunlu olduğunu iddia ediyor — ölçüm bunu doğrulamıyor. Karpathy §3 (kendi bıraktığın ölü
kodu temizle) gereği ya satır ya yorum gitmeli.

### NOT-3 — 375px kozmetik: marka kırpık, nav etiketleri kaydırma şeridinde
Ayrıntı ve görüşüm §5'te. Bugün bulgu değil; F-007'nin kabul kriterine taşınmalı.

### NOT-4 — asenkron yığın hâlâ sınırın dışında (kalan yüzey)
`service.ts:124-125` (`startWatchingIfPossible`, `hub.broadcast`) `try`'ın dışında ve
`req.on('end')` yığınında. Bilinen tetikleyici yok; ölçüm ve gerekçe §4.1'de.

### NOT-5 — bir kez `[vitest-pool]: Worker forks emitted error` (5 koşudan 1'i)
Ayrıntı §1'de. Zincir durdu (sessiz yeşil değil), 4 koşu temiz. Tekrarlarsa vitest'in kendi
önerisi (`isolate: false`) veya `pool` ayarı değerlendirilebilir.

### NOT-6 — `storage_unavailable` mesajı yol yarışı için semantik olarak yanlış
`service.ts:107-111` `resolveProjectPath`'in `ENOENT` yarışını da `storageUnavailableError`'a
çeviriyor; kullanıcı "Liste kaydedilemedi, tekrar deneyin." görüyor, oysa sorun listede değil
yolda. Süreç yaşadığı ve 500 döndüğü için davranış doğru; yalnızca metin isabetsiz.

## 7. Regresyon kontrolü (görev maddesi 6)

- `verify` / `e2e` / `e2e:dev` üçü de yeşil (§1) — 4xx/5xx yolları, SSE akışı ve `shutdown`
  testleri dâhil (`timeline.spec.ts:327` bağlantı kopma/toparlanma, `:429` kalıcı hata,
  `tests/server/graceful-shutdown.test.ts` süitte).
- Sınırın `headersSent` dalı SSE'yi bozmuyor: açık `/api/stream` bağlantısıyla koşan iki E2E
  testi geçti; birim testi de ikinci `writeHead` denenmediğini çitliyor (M2 ile ölçüldü).
- Hata sınırı eklenmesi dağıtıcıyı bir seviye içeri aldı (girinti değişikliği); rota sırası,
  Host/Origin kontrolünün en başta çalışması ve 404 dalları diff'te birebir korunmuş
  (`index.ts:290-360`), M3/M4 dışında hiçbir test bu yeniden düzenlemeden etkilenmedi.
- `git diff 6613f28..HEAD --name-only` kapsamı: yeni bir dosya/dizin sızması yok; `cc77b1f`
  yalnızca sınır, servis, registry, App başlığı ve testlere dokunmuş.

## 8. Temizlik kanıtı

- **Çalışma ağacı:** 12 mutasyonun tamamı yedekten geri alındı; her dosyanın **md5'i** düzeltme
  öncesi değerine birebir eşit (`index.ts 207db7ac…`, `projects-registry.ts 6e3c0af8…`,
  `service.ts bbf17385…`, `handlers.ts 8f4fb7c0…`, `App.tsx 6dc555b1…`,
  `no-delete-guard.test.ts d638a24b…`). `git status --porcelain` yalnızca bu turda eklenen
  **iki ekran görüntüsünü** listeliyor; **`git diff HEAD` tamamen boş.**
- **Süreçler/portlar:** QA sunucusu (pid 31620) `taskkill /T /F` ile düşürüldü.
  `netstat -ano | grep LISTENING` → **7333/7334/7335/7433/7434'te dinleyen yok**. `tasklist`'te
  `tsx`/`vite` süreci **0**; kalan iki `node.exe` (pid 8276, 10864) oturum başında açılan
  Playwright MCP sunucusu, benim bıraktığım yetim değil.
- Geçici fixture'lar, veri dizinleri ve probe betiği yalnızca scratchpad altında; **gerçek proje
  klasörlerine hiçbir şey yazılmadı** (canlı testte kullanılan fixture da scratchpad'te).
- Ürün kodu **kalıcı olarak değiştirilmedi**; commit atılmadı, `git push`/`install-hook`
  çalıştırılmadı.

## 9. Kapanış için istenenler (iki madde)

1. **(ÖNEMLİ-1)** Dağıtıcı sınırının **bağlantısını** çitleyen bir test ekle (M1 mutasyonu bir
   daha 430/430 yeşil kalmasın).
2. **(ÖNEMLİ-2)** `useProjects.remove()` hata durumunu yüzeye çıkarsın; kullanıcı `500`'de
   "Liste kaydedilemedi, tekrar deneyin." görsün (Ekle yolundaki davranışın aynısı) + test.

İsteğe bağlı (NOT'lar, karar üzerinde etkisi yok): guard istisnasını daraltma (NOT-1), ölü
satır içi stil/yorum temizliği (NOT-2), F-007 sözleşmesine 375px sekme kriteri (NOT-3).
