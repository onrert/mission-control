KARAR: KALDI
ESKALE: false

# F-013 — QA raporu (kod turu, 1. tur)

- **Tarih:** 2026-09-08
- **Değerlendiren:** qa-evaluator
- **Commit:** `4a8852b feat(F-013): show feature body, contract, and QA reports in detail modal`
- **Kaynaklar:** `docs/features/F-013-feature-detay-icerigi.md` (9 AC), `docs/qa/F-013-contract.md`,
  `docs/03-ux.md` §Kanban/F-013 metin sözlüğü, `ADR-005`, `docs/progress.md` F-013 bölümü,
  `CLAUDE.md` "Öğrenilen kurallar" (tamamı).
- **Yöntem:** üretim derlemesi + `npm start` (port 7355, `MC_CHAT_ENABLED=0`), gerçek tarayıcıda
  (Playwright) gerçek repo verisiyle tıklama; 8 mutasyon (5'i sözleşmedeki zorunlular, 3'ü kendi
  seçimim); canlı fault-injection ile ayrı bir sunucu süreci (port 7356); doğrudan
  `buildFeatureDetail` çağıran 3 bağımsız sızıntı probu; `npm run verify` + `npm run e2e`.
- **Ekran görüntüleri:** `docs/qa/screens/F-013-*.png`

---

## 1. Karar özeti

**KALDI.** İki bloklayıcı:

- **B1 — AC6 ihlali:** `docs/qa/*` (sözleşme + QA raporları) diskte değişince panel **sessizce
  eski içeriği** göstermeye devam ediyor; bayat olduğu **hiçbir yerde belli olmuyor** ve elle
  tazeleme yolu yok. AC6 kelimesi kelimesine "sessizce eski içerik gösterilmez" diyor ve feature
  notunda `[x]` işaretli. Ölçüldü: sözleşme dosyası yeniden yazıldı + yeni bir QA raporu
  oluşturuldu → 9 sn sonra panel hâlâ eski sözleşmeyi ve "QA raporu bulunamadı." metnini
  gösteriyordu.
- **B2 — AC4'ün mutasyon çiti eksik:** Kök kaçışını engelleyen ikinci yol-kurma noktası
  (`SAFE_ID_PATTERN`, `feature-detail.ts:22`) **hiçbir test tarafından korunmuyor**; çiti kaldıran
  mutasyon 109/109 **YEŞİL** kaldı ve kök dışındaki bir dosyanın içeriğini panele **gerçekten
  sızdırdım**. AC4: "Mutasyonla çitlenecek: çiti kaldıran mutasyon KIRMIZI vermeli."

Ürün kodu bu iki noktada da **doğru davranıyor** (gerçek kodda sızıntı yok); eksik olan (B2'de)
çit ve (B1'de) AC'nin gerektirdiği davranışın kendisi.

Ayrıca dört ÖNEMLİ bulgu var; en ağırı, AC3'ün kanıt olarak gösterdiği **manifest testinin iddia
ettiği şeyi ölçmemesi** (mutlu yoldan gelen gerçek bir yazma testten geçti).

---

## 2. Kabul kriterleri — tek tek

| # | Kriter | Sonuç | Kanıt |
|---|---|---|---|
| AC1 | Pencere feature gövdesini okunabilir gösterir | **GEÇTİ** | F-012 kartı: `feature-detail-body` 18.809 karakter, `## Açıklama` ile başlıyor. `screens/F-013-01` |
| AC2 | Sözleşme + QA raporları görünür; dosya yoksa "yok" durumu okunabilir | **GEÇTİ** | F-012: sözleşme 78.403 karakter + **9 QA raporu** kronolojik sırayla (`review-1..3`, `kod-turu-A/B`, `2026-09-06`, `-tur2/3/4`). F-008/F-011: "Sözleşme bulunamadı." / "QA raporu bulunamadı." `screens/F-013-02` |
| AC3 | Salt okunur; ADR-005 korunur; **dosya sistemi manifest testiyle kanıtlanır** | **KALDI (Ö1)** | Salt okunurluk davranışı doğru (canlı okuma sırasında disk değişmedi), fakat **kanıt mekanizması sahte**: `buildFeatureDetail`'in mutlu yoluna eklediğim gerçek `fs.writeFileSync` manifest testinden **GEÇTİ** (yalnızca statik tarayıcı yakaladı). Bkz. §4 M3a |
| AC4 | Yol çiti: her okuma proje kökü altında; `..`/symlink/UNC/harf duyarsızlığı; **mutasyonla çitlenecek** | **KALDI (B2)** | `read-guard.ts` çiti sağlam ve mutasyonu KIRMIZI (M1, 3 test). Ama **ikinci** yol-kurma noktası (`readOptionalDocument`, guard'dan geçmiyor) yalnızca `SAFE_ID_PATTERN` ile korunuyor ve o çitin **sıfır testi var**: M7 → 109/109 yeşil + gerçek sızıntı |
| AC5 | Boyut sınırı; kırpılırsa kullanıcıya söylenir (sessiz kırpma yasak) | **GEÇTİ** | 260.044 karakterlik gövde + 250.040 karakterlik sözleşme → `truncated:true`, panelde `⚠ İçerik çok büyük olduğu için kısaltıldı.` `screens/F-013-04`. Yığın stresi (7 belge, 1.42 MB): 264 ms, panel etkileşimli |
| AC6 | Dosya değişince tazelenir **veya** bayat olduğu belli olur; sessizce eski içerik yok | **KALDI (B1)** | Gövde: marker eklendikten sonra **anında** tazelendi (ölçüldü). `docs/qa/*`: 9 sn sonra hâlâ eski içerik, hiçbir bayatlık işareti yok |
| AC7 | Okuma hatası okunabilir; panel çökmez, sunucu ayakta | **GEÇTİ** | (a) QA raporu yerine dizin → `Dosya okunamadı.` (`role="alert"`), panel ayakta (`screens/F-013-05`). (b) Canlı fault-injection: `HTTP 500`, ham hata metni sızmadı, `/api/health` ayakta, sonraki istek 200 (`screens/F-013-06`) |
| AC8 | 320-480px'te okunabilir | **GEÇTİ** | Kendi ölçümüm (kırpılmış görünür genişlik, `toBeVisible()` DEĞİL): 320px → modal 288px (16..304, taşma yok), gövde `pre` 239px; 375px → 343/294px; 480px → 448/399px. `document.scrollWidth` üç genişlikte de viewport'a eşit |
| AC9 | Mevcut pencere davranışı korunur: focus-trap, `Esc` | **GEÇTİ** | Açılışta odak "Kapat"ta; `Tab` modalda kalıyor (`inModal:true`); `Esc` kapatıyor. F-013 `KanbanCard.tsx`'e dokunmadı |

**Özet: 6 GEÇTİ / 3 KALDI (AC3, AC4, AC6).**

---

## 3. Developer iddialarının doğrulanması

| İddia | Sonuç |
|---|---|
| `GET /api/features/detail` yeni salt-okunur uç, `write-gate.ts`'e dokunulmadı | **DOĞRU** — `git diff HEAD~1 --stat` içinde `write-gate.ts` yok |
| Gövde `FeatureCard`'a eklenmedi (J1) | **DOĞRU** — `/api/features` yanıtında gövde alanı yok |
| 200.000 karakter sınırı + görünür kırpma (J4) | **DOĞRU** — hem sunucuda hem panelde ölçüldü |
| Bayatlık için yeni mekanizma yok; `content_hash` + SSE (J6) | **KISMEN** — gövde için çalışıyor, `docs/qa/*` için çalışmıyor (B1) |
| Ham `<pre>`, yeni bağımlılık yok, bundle etkisi 0 KB (J5) | **DOĞRU** — `package.json`/`package-lock.json` diff'te yok; derlenmiş JS 298,11 kB / CSS 21,17 kB |
| `verify` = 0, 934 test / 66 dosya | **DOĞRU** — `EXIT=0`, `934 passed | 2 skipped (936)`, `66 passed` |
| `e2e` = 0, 26/26 (+3 yeni) | **DOĞRU** — `26 passed (31.9s)`; üç F-013 testi gerçek (kırpılmış görünür genişlik + modal viewport'u aşmıyor assert'i dahil) |
| Tailwind `@source` kapsamı (CLAUDE.md dördüncü tekrar dersi) | **DOĞRU** — F-013'ün getirdiği 12 sınıf (`max-h-64`, `text-amber-400`, `whitespace-pre-wrap`, `break-words`, `bg-zinc-950`, `space-y-4`, `overflow-y-auto`, `font-semibold`, `text-zinc-400`, `space-y-3`, `pt-3`, `flex-1`) → 12/12 `dist/web/assets/index-*.css` içinde |
| Mutasyon (e)'de sarmalayıcıyı silmek yerine fault-injection tercihi | **GEREKÇE KABUL** — ama yetersiz; ben ikisini de yaptım (§4 M5a/M5b), sarmalayıcıyı silmek test çalıştırıcısını çökertmedi, 2 test KIRMIZI verdi |
| `content_hash` `FeatureCard` ile aynı | **DOĞRU** — `ee97ebcc…` iki uçta birebir aynı |

---

## 4. Mutasyon tablosu (8 bağımsız mutasyon)

| # | Hedef | Mutasyon | Sonuç | Kanıt |
|---|---|---|---|---|
| M1 | Yol çiti (zorunlu) | `read-guard.ts`: ata-symlink + hedef-symlink + `outside-root` kapsam kontrolü kaldırıldı | **KIRMIZI** (3 test) | `feature-detail.test.ts` 2 + `features-api.test.ts` 1. Ayrıca junction'lı fixture'da **gerçek sızıntı** ölçüldü: `contract.exists` false→true, `qa_reports` 0→1, kök dışı metin panele geldi |
| M2a | Kırpma uyarısı — sunucu (zorunlu) | `truncateDocument` her zaman `truncated:false` | **KIRMIZI** (2 test) | `feature-detail.test.ts` |
| M2b | Kırpma uyarısı — istemci (zorunlu) | `FeatureDetailModal`'daki `doc.truncated && <p>…</p>` silindi | **KIRMIZI** (1 test) | `KanbanScreen.test.tsx` "kısaltıldı" beklentisi |
| M3a | Salt okunurluk (zorunlu) | `buildFeatureDetail` mutlu yoluna **sabit içerikli** `fs.writeFileSync(docs/qa/.mc-read.log)` | **KISMEN KIRMIZI — manifest testi YEŞİL** | `no-write-gate-bypass` + 2 birim testi kırmızı; **`-t "manifest"` ile yalnızca manifest testleri koşturulduğunda 2 passed** → AC3'ün gösterdiği kanıt mekanizması bu yazmayı görmüyor (Ö1) |
| M3b | Salt okunurluk (gizli biçim) | `fs.openSync(...,'a')` + `fs.writeSync(fd, 'okundu: '+file)` | **KIRMIZI** | Statik tarayıcı + manifest testi (bu sefer içerik her çağrıda değiştiği için) |
| M4 | Bayatlık/tazeleme (zorunlu) | `KanbanScreen`'in `detailCard` senkron effect'i etkisizleştirildi | **KIRMIZI** (1 test) | `KanbanScreen.test.tsx` F-013 §6 testi |
| M5a | Hata sınırı — canlı (zorunlu) | `handleFeatureDetail` başına gerçek senkron `throw` (`MC_QA_FAULT=1`), üretim sunucusu ayrı portta | **KIRMIZI/DOĞRULANDI** | `HTTP=500`, gövde `internal_error` + genel Türkçe metin, `QA-FAULT-GIZLI-DETAY` **sızmadı**, `/api/health` 200, sonraki `/api/features` 200. Panelde `role="alert"` hata, Kanban ekranı ayakta |
| M5b | Hata sınırının kendisi | `withDispatchErrorBoundary(...)` sarmalayıcısı dağıtıcıdan kaldırıldı | **KIRMIZI** (2 test) | Tam paket: `2 failed | 932 passed` — developer'ın "yıkıcı olur" endişesi ölçümle yanlışlandı |
| M6 | Dosya adı deseni (benim seçimim) | Handler'daki `isValidFeatureFileName` kontrolü kaldırıldı | **KIRMIZI** (1 test) | `features-api.test.ts` "geçersiz dosya adı → 400" |
| M7 | **`id` sanitizasyonu (benim seçimim)** | `SAFE_ID_PATTERN.test(card.id)` → `card.id !== ''` | **YEŞİL — 109/109** | Hiçbir test korumuyor. Ardından **gerçek istismar**: frontmatter'ı `id: ../../../outside/qa/EVIL` olan bir feature dosyası → `contract.content` = kök **dışındaki** dosyanın içeriği. Gerçek kodda `exists:false` (doğru) |

`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca meşru test adları
(`write-gate-manifest.test.ts:124` + F-013'ün kendi test açıklamaları). `git status` temiz,
`git diff` boş (yalnızca bu raporun ve ekran görüntülerinin eklenmesi).

---

## 5. Bulgular

### B1 (BLOKLAYICI) — `docs/qa/*` değişikliklerinde sessiz bayatlık (AC6 ihlali)

**Tekrar üretme**
1. `npm run build && npm start` (port 7355), panelde Kanban → bir karta tıkla (ör. `F-011`).
2. Pencere açıkken, **gövdeye dokunmadan** diskten şunu yap:
   `printf 'YENI-SOZLESME\n' > docs/qa/F-011-contract.md` ve
   `printf 'YENI-RAPOR\n' > docs/qa/F-011-2026-09-08-qa.md`
3. 9 saniye bekle, pencereyi oku.

**Beklenen (AC6):** içerik tazelenir **veya** bayat olduğu belli olur.
**Gerçek:** "Sözleşme" bölümü hâlâ **eski** metni gösteriyor (`QA-SOZLESME-BAYATLIK-TESTI`,
yenisi `QA-SOZLESME-IKINCI-SURUM-…`), "QA raporları" bölümü diskte bir rapor dururken
**"QA raporu bulunamadı."** diyor. Hiçbir bayatlık göstergesi, hiçbir "Yenile" düğmesi yok.
Karşılaştırma: aynı senaryoda **gövde** dosyasına marker eklenince panel **anında** tazelendi.

**Muhtemel dosya:satır**
- `src/features/kanban/web/useFeatureDetail.ts:58` — effect bağımlılığı yalnızca
  `card.content_hash` (gövde baytları); `docs/qa/*` hash'e girmiyor.
- `src/server/watch/project-watcher.ts:22` — `chokidar.watch(featuresDir)`; `docs/qa` izlenmiyor
  (`src/features/projects/server/service.ts:95`).

**Neden bloklayıcı sayıyorum:** (a) AC6 "sessizce eski içerik gösterilmez" diyor ve feature
notunda `[x]` işaretli — AC değiştirilmeden karşılanmamış sayılır; (b) bu tam olarak
kullanıcının istediği senaryo: bir QA turu koşarken raporun panelde belirmesini izlemek —
panel bunun yerine "QA raporu bulunamadı." diyerek **yanlış bilgi** veriyor; (c) sözleşmedeki
"genellikle ikisi birlikte değişir" gerekçesi *commit* düzeyinde doğru (`48f2243`, `417ea4f`
hem raporu hem feature notunu içeriyor) ama **dosya yazımı düzeyinde değil** — rapor önce, notun
`status:` satırı dakikalar sonra yazılıyor; (d) kapsam içi ucuz bir çözüm var: modalda bir
"Yenile" düğmesi (`src/features/kanban/web/**`, feature'ın kendi dosya sahipliği) veya
görünür bir "bu belgeler pencere açıldığı andan beri yenilenmedi" notu.

### B2 (BLOKLAYICI) — `SAFE_ID_PATTERN` kök-kaçışını engelleyen tek savunma ve sıfır testi var (AC4 ihlali)

**Tekrar üretme**
1. `src/features/kanban/server/feature-detail.ts:118` — `if (SAFE_ID_PATTERN.test(card.id)) {`
   satırını `if (card.id !== '') {` yap.
2. `npx vitest run tests/features/kanban tests/integration/features-api.test.ts`
3. Ayrıca frontmatter'ı `id: ../../../outside/qa/EVIL` olan bir feature dosyasıyla
   `buildFeatureDetail(root, 'F-902-evil.md')` çağır.

**Beklenen (AC4):** çiti kaldıran mutasyon **KIRMIZI** vermeli.
**Gerçek:** `Tests 109 passed (109)` — **YEŞİL**. Ve mutasyonla birlikte gerçek sızıntı:
`contract = {"exists":true,"content":"KOK-DISI-SIZAN-GIZLI-ICERIK\n",…}` — proje kökünün
**dışındaki** bir dosyanın içeriği panele akıyor. (Mutasyon geri alındığında `exists:false`.)

**Kök neden:** `readOptionalDocument` (`feature-detail.ts:38-49`) yolu
`path.join(dirPath, fileName)` ile **guard'dan geçirmeden** kuruyor. `fileName` ya
`readdirSync` çıktısı (güvenli) ya da `` `${card.id}-contract.md` `` — ve `card.id`
**frontmatter'dan**, yani dosya içeriğinden geliyor. Sözleşme §3 tüm okumaların
`resolveInsideRootForRead`'ten geçtiğini ima ediyor; bu yol geçmiyor.

**Muhtemel dosya:satır:** `src/features/kanban/server/feature-detail.ts:22` (desen),
`:38` (`readOptionalDocument`), `:118` (tek kullanım yeri).

**İstenen düzeltme:** `SAFE_ID_PATTERN` için doğrudan bir regresyon testi **ve**
`readOptionalDocument`'ın hedefini `resolveInsideRootForRead` ile doğrulaması (ikinci savunma
hattı). Mutasyon KIRMIZI verene kadar kapanmış sayılmaz.

### Ö1 (ÖNEMLİ) — AC3'ün kanıt gösterdiği manifest testi iddia ettiğini ölçmüyor

`tests/features/kanban/server/feature-detail.test.ts:214-239`. İki yapısal kusur:
1. `beforeInvalid` anlık görüntüsü **mutlu yol çağrısından SONRA** alınıyor (satır 227) —
   `buildFeatureDetail(root,'F-001.md')`'nin ürettiği herhangi bir yazma karşılaştırmaya
   hiç girmiyor.
2. `before` karşılaştırması `before.every(e => after'da aynı relPath+sha256 var)` biçiminde —
   yani yalnızca **var olan dosyaların değişmediğini** ölçüyor; **yeni dosya eklenmesini**
   (ve silinmeyi) göremiyor.

Ölçüm: mutlu yola sabit içerikli bir `fs.writeFileSync` eklendiğinde `-t "manifest"` koşusu
**2 passed** verdi. Yazmayı yakalayan tek şey `no-write-gate-bypass` statik taraması oldu —
yani AC3'ün "savunma-derinliği, totoloji değil" iddiası fiilen tek katman.
Düzeltme: `expect(after).toEqual(before)` (tam eşitlik) ve anlık görüntüyü **tüm** çağrılardan
önce almak.

### Ö2 (ÖNEMLİ) — İçerik klavyeyle okunamıyor

Ölçüm (1280px, F-012 penceresi açık): pencerede **12 kaydırma bölgesi** var (1 dış kap +
11 `<pre>`); hiçbirinde `tabindex` yok; focus-trap'in odaklanabilir öğe listesi
(`FeatureDetailModal.tsx:71-73`) yalnızca `button/[href]/input/select/textarea/[tabindex]`
arıyor → listede **tek öğe: "Kapat"**. `PageDown` ve `ArrowDown` sonrası dış kabın
`scrollTop` değeri **0** (kaydırılabilir mesafe 2690px), tüm `<pre>`lerin `scrollTop`'u 0.
Yani klavyeyle çalışan bir kullanıcı her belgenin yalnızca ilk ~254 pikselini görebiliyor.
Feature'ın tek amacı okumak olduğu için bu, işlevin kendisini yarıya indiriyor (WCAG 2.1.1).

### Ö3 (ÖNEMLİ) — Okunabilirlik: ham markdown × 254 piksellik kutular

J5 kararı (markdown kütüphanesi yok) **tek başına savunulabilir**: proje mono/terminal
estetiğinde, `dangerouslySetInnerHTML` yüzeyi açılmıyor, `ADR-009` riski sıfır, bundle etkisi 0.
Sorun render değil, **kutu geometrisi**: her belge `max-h-64` (ölçülen `clientHeight` = 254px)
bir kutuya kilitleniyor. Gerçek veriyle ölçüm — F-012 penceresi:

| Belge | Gizli kaydırma mesafesi |
|---|---|
| Sözleşme | 27.922 px |
| QA tur 1 | 12.274 px |
| Gövde | 6.578 px |
| Diğer 8 belge | 4.034 – 12.994 px |

254 piksellik bir pencereden 27.922 piksel okumak ≈ 110 ekran. Üstelik dış kap da kaydığı için
iç içe iki kaydırma katmanı var. Kullanıcının isteği ("içeride ne yapıldığı görünsün")
teknik olarak karşılanıyor ama pratikte okuma pahalı. Ucuz iyileştirmeler: yüksekliği
`max-h-64` yerine esnek yapmak, belgeleri katlanabilir (`<details>`) bölümlere almak, veya
QA raporlarını varsayılan kapalı açmak. **Bu bulgu tek başına bloklayıcı değildir** — J5
kararının kendisini sorgulamıyorum, geometriyi bildiriyorum; kararı CEO verir.

### Ö4 (ÖNEMLİ) — Okuma guard'ı "kök altında"yı kısıtlıyor, "docs/features altında"yı değil

Sözleşme §3'ün `OPERATION_PATTERNS`'i atlama gerekçesi ("okuma tarafında işlem/hedef eşleşmesi
kavramı yazma kadar kritik değil") ölçümle yanlışlandı:

```
buildFeatureDetail('C:/dev/apps/mission-control', '../../package.json')  => ok   (2296 karakter okundu)
buildFeatureDetail('C:/dev/apps/mission-control', '../../CLAUDE.md')     => ok  (13438 karakter okundu)
```

Yani çekirdek fonksiyonun sözleşmesi "kök içinde herhangi bir dosya". Kök dışına çıkmıyor
(AC4'ün lafzı korunuyor) ama hangi dosyanın okunacağını sınırlayan **tek** şey HTTP
handler'ındaki `isValidFeatureFileName` (`handlers.ts:247`). O katmanın testi var (M6 KIRMIZI),
dolayısıyla bugün istismar edilebilir değil; ama ikinci bir çağıran eklendiğinde izlenen
projedeki herhangi bir dosya (`.env`, `.git/config`, `data/projects.json`) okunabilir hâle gelir.
Kısıt guard'ın kendisine taşınmalı (ör. `relativeParts`'ın `['docs','features',<ad>]` kalıbına
uyduğunu guard içinde doğrulamak).

### NOT'lar

- **N1** — Sunucu 500 döndüğünde panelde UX sözlüğündeki `İçerik yüklenemedi. Tekrar deneyin.`
  değil, sunucunun kendi metni (`Beklenmeyen bir sunucu hatası oluştu. Tekrar deneyin.`)
  görünüyor (`useFeatureDetail.ts:44` — `body.error?.message ?? fallback`). İkisi de Türkçe ve
  okunabilir; "birebir uyum" şartına göre sapma.
- **N2** — Yol çiti bir belgeyi reddettiğinde (symlink/junction) kullanıcı bunu
  "Sözleşme bulunamadı." olarak görüyor. Güvenlik açısından doğru (bilgi sızdırmıyor), teşhis
  açısından yanıltıcı. Ölçüldü: junction'lı `docs/qa` → `contract.exists:false`.
- **N3** — 200.000 karakter sınırı **belge başına**; toplam yanıt sınırsız. Gerçek F-012 kartı
  **317.573 bayt** (11 belge) döndürüyor. Stres: 7 belge × 200k = **1.419.096 bayt**, sunucu
  0,02 sn, panel yüklemesi 264 ms, kaydırma akıcı → AC5'in "kilitlemez" şartı bugünkü ölçekte
  karşılanıyor; sınırın toplam üzerinde olmaması yine de kayda değer.
- **N4** — `Esc` sonrası odak tetikleyen karta değil `BODY`'ye dönüyor. `FeatureDetailModal`'ın
  kendi yorumu bunu `KanbanCard`'ın sorumluluğu sayıyor ama orada da yok. **F-007'den miras,
  F-013 regresyonu değil** (`git diff HEAD~1` `KanbanCard.tsx`'e dokunmuyor).
- **N5** — 320px'te pencere başlığı ile "Kapat" düğmesi arasında boşluk yok (kutular
  çakışmıyor: h2 sağ kenarı 255px, düğme sol kenarı 255px). **F-007'den miras**, F-013 başlık
  satırını değiştirmedi. `screens/F-013-03-320px.png`

---

## 6. Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **7** | Mutlu yol, eksik dosya, okuma hatası, kırpma, hata sınırı, dar genişlik — hepsi gerçek tarayıcıda çalışıyor. Eksi: `docs/qa/*` bayatlığı (B1) işlevsel bir yalan üretiyor |
| Özellik bütünlüğü | **5** | 9 AC'nin 3'ü karşılanmıyor: AC6 (sessiz bayatlık), AC4 (mutasyon çiti eksik, ikinci yol-kurma noktası guard dışı), AC3 (kanıt mekanizması iddia ettiğini ölçmüyor). Üçü de feature notunda `[x]` işaretli |
| Görsel / UX | **6** | Estetik tutarlı, üç dar genişlikte taşma yok, kırpma uyarısı belirgin, `role="alert"` doğru. Eksi: 254px kutularda 28.000px içerik (Ö3), klavyeyle içerik okunamıyor (Ö2) |
| Kod kalitesi | **7** | Temiz, iyi yorumlanmış, küçük dosyalar, `write-gate.ts`'e dokunulmamış, dosya sahipliği ihlali yok, `verify` 0 / 934 test / `e2e` 26/26 hepsi doğrulandı, `@source` dersi uygulanmış. Eksi: üç çit boşluğu (B2, Ö1, Ö4) ve M5b'nin gösterdiği gibi bir mutasyon gereksiz yere atlanmış |

Dört boyuttan ikisi < 7 → **KALDI**.

---

## 7. Düzeltme turu için istenenler

1. **B1** — `docs/qa/*` için tazeleme **veya** görünür bayatlık göstergesi. En ucuz kapsam-içi
   çözüm: pencerede bir "Yenile" düğmesi (`useFeatureDetail`'e manuel tetik) + E2E'de
   "gövde değişmeden sözleşme değişince kullanıcı güncel içeriğe ulaşabiliyor" testi.
   Alternatif (kapsam dışına taşar): watcher'ı `docs/qa`'ya genişletmek. AC6'yı daraltmak
   isteniyorsa AC metni ve `docs/03-ux.md` birlikte güncellensin — sessizce `[x]` bırakılmasın.
2. **B2** — `SAFE_ID_PATTERN` için regresyon testi (kötü `id` frontmatter'ı → kök dışı okuma
   YOK) **ve** `readOptionalDocument`'ın hedefini `resolveInsideRootForRead`'ten geçirmesi.
   Mutasyon (`SAFE_ID_PATTERN` kaldır) KIRMIZI vermeli.
3. **Ö1** — Manifest testi: anlık görüntü **tüm** çağrılardan önce alınsın,
   `expect(after).toEqual(before)` tam eşitlikle karşılaştırılsın. Kanıt: M3a mutasyonu
   (`-t "manifest"` ile) KIRMIZI vermeli.
4. **Ö2** — Kaydırılabilir belge kutuları klavyeyle erişilebilir olsun (`tabindex={0}` +
   focus-trap seçicisine dahil edilmesi) ya da dış kap odaklanabilir yapılsın.
5. **Ö4** — Yol kısıtı (`docs/features/<ad>.md`) guard'ın içine taşınsın; handler'daki desen
   ikinci katman olarak kalsın.
6. **Ö3 / N1 / N2 / N3** — CEO kararına bırakılıyor (Ö3 ürün kararı; N1 metin sözlüğü uyumu).
   **N4/N5 F-013'e ait değil** — ayrı bir not olarak kaydedilebilir.

---

## 8. Süreç hijyeni

- **Yetim süreç:** tur sonunda kendi başlattığım **1** sunucu (port 7355) kaldı ve kapatıldı;
  fault-injection sunucusu (port 7356, PID 33364 + çocuk 50448) `taskkill /T /F` ile
  sonlandırıldı, `netstat` doğrulandı. Makinede duran diğer `node.exe` süreçleri
  `C:\dev\apps\hayat-mentoru` projesine ait — **dokunulmadı**. Sayım: kapatma öncesi **8** `node.exe`, sonrası **5**
  (3 × hayat-mentoru: PID 37640 `npm run dev`, 27556 `next dev`, 34488 `start-server.js`;
  2 × Playwright MCP aracı: PID 20168, 9064). Mission Control'e ait **0** süreç kaldı;
  7333/7355/7356 portlarında LISTENING **0**.
- **Repo durumu:** tüm mutasyonlar birebir geri alındı; `git status` yalnızca bu raporu ve
  `docs/qa/screens/F-013-*.png` dosyalarını gösteriyor. Test amacıyla oluşturulan
  `F-998`/`F-999` fixture'ları ve geçici `docs/qa/F-011-*` dosyaları scratchpad'e taşındı,
  `docs/features` ve `docs/qa` orijinal hâlinde.
- **Ürün kodu düzenlenmedi.**

## 9. Doğrulayamadıklarım

- **Dosya symlink'i** (dizin junction'ı değil) ile saldırı: Windows'ta yönetici/geliştirici
  modu gerektiriyor, `fs.symlinkSync(..., 'file')` **EPERM** verdi. Dizin junction'ı ile
  ölçtüm (M1) — bu yol kapalı. `readOptionalDocument`'ın dosya-seviyesi `lstat` kontrolü
  ampirik olarak sınanamadı.
- **UNC yolu** (`\\sunucu\pay`) ile kök dışı okuma: bu makinede erişilebilir bir ağ payı yok.
  `isValidFeatureFileName` UNC'yi zaten dosya adı düzeyinde reddediyor (`basename(file)===file`).
- **Hardlink** ile kök dışı içerik okuma: `lstat` hardlink'i symlink saymaz; senaryo
  kurulmadı. ADR-005 kapsamında yazılı bir kabul yok — bir sonraki turda bakılabilir.
- **Gerçek izin hatası** (`EACCES`): Windows'ta güvenilir biçimde üretilemedi; yerine
  `EISDIR` (dosya yerine dizin) ile hata dalı sınandı.
