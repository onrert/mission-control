KARAR: GEÇTİ
ESKALE: false

# F-013 — QA raporu (düzeltme turu, 2. tur — DAR KAPSAM)

- **Tarih:** 2026-09-08
- **Değerlendiren:** qa-evaluator
- **Commit:** `d55ee89 docs(F-013): record QA fix round K1-K6 in progress.md`
  (düzeltmeler: `7b8d8ce` güvenlik, `f518a29` UX)
- **Kapsam:** yalnızca 1. turun (`docs/qa/F-013-2026-09-08.md`, KALDI) açık bulguları —
  B1, B2 ve Ö1-Ö4. 1. turda GEÇTİ verilen AC'ler (AC1/AC2/AC5/AC7/AC8/AC9) yeniden ölçülmedi;
  yalnızca düzeltmenin dokunduğu focus-trap yüzeyi regresyon için sınandı.
- **Yöntem:** temiz `npm run build && npm start` (port 7357, `MC_CHAT_ENABLED=0`, izole
  `MC_DATA_DIR` + gerçek `docs/` kopyasından üretilmiş fixture proje); gerçek tarayıcıda
  (Playwright) tıklama ve klavye; 6 bağımsız mutasyon; doğrudan `buildFeatureDetail` /
  `resolveInsideRootForRead` çağıran bağımsız sızıntı probu (11 saldırı vektörü);
  `npm run verify` + `npm run e2e`.
- **Ekran görüntüleri:** `docs/qa/screens/F-013-t2-01-modal-1280.png`,
  `docs/qa/screens/F-013-t2-02-yenile-sonrasi.png`, `docs/qa/screens/F-013-t2-03-320px.png`

---

## 1. Karar özeti

**GEÇTİ.** 1. turun iki bloklayıcısı da (B1, B2) ve dört önemli bulgusunun dördü de (Ö1-Ö4)
kapandı; brief'in istediği dört mutasyonun (guard, desen, manifest, bayatlık) **dördü de
KIRMIZI**. Yeni bloklayıcı yok.

En kritik sonuç: 1. turda **gerçekten sızdırdığım** kök dışı okuma artık iki bağımsız katman
tarafından kapatılıyor ve **her iki katmanın da kendi mutasyonu var** — katmanlardan birini
kaldırmak testleri kırmızıya düşürüyor, diğerini kaldırmak da. 1. turda `SAFE_ID_PATTERN`
mutasyonu 109/109 yeşil bırakıyordu; artık kırmızı.

Bir tane NOT seviyesi çit zayıflığı buldum (N6, aşağıda): K6'nın E2E assert'i `locator.focus()`
kullandığı için "kap klavye ile odaklanabilir" iddiasını **ölçmüyor**. Kullanıcıya görünen
davranış gerçek tarayıcıda doğrulandı (Tab kaba ulaşıyor, `PageDown` kaydırıyor), bu yüzden
bloklayıcı değil — ama rapora yazılıyor.

---

## 2. 1. tur bulgularının kapanış tablosu

| 1. tur | Düzeltme | Sonuç | Kanıt (özet) |
|---|---|---|---|
| **B2 / AC4** — `SAFE_ID_PATTERN` tek savunma, sıfır testi | K1 | **KAPANDI** | `readOptionalDocument` artık gövdeyle **aynı** `resolveInsideRootForRead`'ten geçiyor; 11 saldırı vektörünün 11'i reddedildi; iki katmanın **ayrı ayrı** mutasyonu KIRMIZI (M1, M2) |
| **Ö4 / AC4** — guard "kök altında"yı kısıtlıyor, "docs/features altında"yı değil | K2 | **KAPANDI** | `buildFeatureDetail(repo,'../../package.json')` 1. turda `ok` (2296 karakter okundu) → şimdi `invalid_path`; `../../CLAUDE.md` 1. turda `ok` (13438 karakter) → `invalid_path` |
| **Ö1 / AC3** — manifest testi iddia ettiğini ölçmüyor | K3 | **KAPANDI** | M3a (mutlu yola gerçek `fs.writeFileSync`) 1. turda `-t "manifest"` ile **2 passed** → şimdi **2 failed**; silme mutasyonu da KIRMIZI |
| **B1 / AC6** — `docs/qa/*` sessiz bayatlık | K4 | **KAPANDI** | "Son yenileme: `<saat>`" her zaman görünür + "Yenile" düğmesi; canlı ölçüm: disk değişti → panel 2 dk boyunca eski içerik gösterdi **ama saat 20:48:31'de sabit kaldı (o an 20:50:43)**, "Yenile" ile içerik + yeni rapor + saat tazelendi |
| **Ö3** — 254px'lik kutularda 27.922px gizli içerik | K5 | **KAPANDI** | İç içe kaydırma kabı **11 → 0**; belgeler `<details>` bölümlerine alındı, gövde açık/gerisi kapalı |
| **Ö2** — içerik klavyeyle okunamıyor | K6 | **KAPANDI** | Kaydırma bölgesi **12 → 1**; `Tab` ile kaba ulaşılıyor, `PageDown` `scrollTop` 0 → **399**, `ArrowDown` → 439, `End` → 6513, `Home` → 0 (1. turda hepsi 0'da sabitti) |

---

## 3. K1/K2 — güvenlik (en kritik)

### 3.1 Gerçek saldırılar — hepsi reddedildi

Bağımsız prob (üretim kodunu doğrudan çağırır, testlerden bağımsız), fixture: kök dışında
`outside/qa/EVIL-contract.md`, kök içinde `package.json` / `.env` / `.claude/settings.json`.

```
A) 1. turun BİREBİR saldırısı — frontmatter `id: ../../../outside/qa/EVIL`
   F-902-evil.md  => contract.exists=false   qa_reports=0        (1. turda: exists=true, içerik SIZDI)
B) `id: ../../package` (kök içinde, docs/qa dışı)
   F-903-dotdot.md => contract.exists=false  qa_reports=0
C) mutlu yol kontrolü
   F-001.md       => contract.exists=true  content="SOZLESME-ICERIGI"
D) `file` parametresiyle docs/features dışına çıkma
   ../../package.json          => invalid_path
   ../../.env                  => invalid_path
   ../../.claude/settings.json => invalid_path
E) guard doğrudan
   [package.json]           => ok=false reason=not-allowed
   [.env]                   => ok=false reason=not-allowed
   [.claude/settings.json]  => ok=false reason=not-allowed
   [docs]                   => ok=false reason=not-allowed
   [docs/qa]                => ok=true
   [docs/features/F-001.md] => ok=true
F) GERÇEK repo kökü üzerinde (1. turun Ö4 repro'su)
   buildFeatureDetail(repo,'../../package.json') => invalid_path   (1. tur: ok, 2296 karakter)
   buildFeatureDetail(repo,'../../CLAUDE.md')    => invalid_path   (1. tur: ok, 13438 karakter)
```

### 3.2 İki katman, iki ayrı mutasyon — ikisi de KIRMIZI

**M1 — guard'ın üçüncü kontrolü kaldırıldı** (`read-guard.ts:78`, `if (!matchesAllowedPrefix…)`
bloğu `void matchesAllowedPrefix(...)` ile etkisizleştirildi):

- `Tests 3 failed | 115 passed` → **KIRMIZI**
  - "QA'nın ölçtüğü gerçek çağrı: root'un doğrudan altındaki bir dosya (docs/features|docs/qa DIŞI) reddedilir"
  - "docs/ altında ama docs/features veya docs/qa DIŞINDA bir dosya reddedilir"
  - "MUTASYON emsali: `file` parametresi ile kök İÇİNDE ama docs/features DIŞINDA bir dosyaya kaçış reddedilir"
- Çit **yük taşıyor**, totoloji değil: mutasyonlu kodda prob gerçekten sızdırdı —
  `../../package.json => ok BODY="{\"gizli\":\"PACKAGE-JSON-SIZINTI\"}"`, `.env => ok`,
  `.claude/settings.json => ok`, gerçek repoda `CLAUDE.md` **14.532 karakter okundu**.

**M2 — `SAFE_ID_PATTERN` kaldırıldı** (`feature-detail.ts:133`, `SAFE_ID_PATTERN.test(card.id)`
→ `card.id !== ''`):

- `Tests 1 failed | 117 passed` → **KIRMIZI**
  (`id="F-001/../F-002"`: başka feature'ın sözleşmesi `docs/qa` İÇİNDE kaldığı için guard'ın
  göremediği, yalnızca desenin kapattığı senaryo). **1. turda bu mutasyon 109/109 YEŞİLDİ.**
- M2 altında A/B/D/E vektörlerinin hepsi hâlâ **reddedildi** — yani desen kalksa bile kök dışı
  sızıntı yok. Savunma derinliği iki yönlü doğrulandı.

Developer'ın progress.md'deki "guard TEK BAŞINA kaldırılırsa `id` senaryosu yeşil kalır, bu
matematiksel olarak beklenen" açıklaması **doğru** — ölçtüm; guard'ın tek başına kattığı değer
`file` parametresi yolunda (M1'in kırdığı 3 test) ve orada çitli.

---

## 4. K3 — manifest testi artık gerçek mi?

`tests/features/kanban/server/feature-detail.test.ts:331-399` + `tests/helpers/manifest.ts`.
Anlık görüntü artık **tüm** `buildFeatureDetail` çağrılarından önce alınıyor ve
`expect(after).toEqual(before)` **tam eşitlik** ile karşılaştırılıyor (kod okundu, doğrulandı).

Üç mutasyon, `npx vitest run … -t "manifest"` ile izole koşuldu:

| Mutasyon | 1. tur | 2. tur |
|---|---|---|
| **M3a** mutlu yola sabit içerikli `fs.writeFileSync(docs/qa/.mc-read.log)` (**yeni dosya**) | **YEŞİL (2 passed)** | **KIRMIZI (2 failed)** — `expected [ …(3) ] to deeply equal [ …(1) ]` |
| **M3c** `readOptionalDocument` okuduğu dosyayı `fs.rmSync` ile **siler** | ölçülmedi | **KIRMIZI (1 failed)** |
| **M3d** var olan dosyaya **boş** `appendFileSync` (yalnızca `mtime` dokunur, içerik/boyut aynı) | ölçülmedi | **YEŞİL** manifest testinde — ama `no-write-gate-bypass` statik taraması **KIRMIZI** verdi |

M3d, testin iddia ettiği kapsamın gerçek sınırını gösteriyor: `snapshotDir` bilinçli olarak
`mtimeMs` taşımıyor (`tests/helpers/manifest.ts:6-9` bunu yazıyor), dolayısıyla içerik-nötr bir
dokunuşu göremez. Bu bir **yanlış iddia değil** (testin adı "hiçbir dosyayı değiştirmez",
yorumu yeni dosya/silme kapsamını doğru anlatıyor) ve ikinci katman (statik tarama) o boşluğu
kapatıyor. AC3'ün "savunma derinliği, totoloji değil" iddiası artık **iki gerçek katman** ile
karşılanıyor — 1. turda fiilen tek katmandı.

---

## 5. K5/K6 — okunabilirlik, gerçek tarayıcıda ölçüldü

F-012 kartı (11 belge, gerçek repo içeriğinin kopyası), 1280×900:

| Ölçü | 1. tur | 2. tur |
|---|---|---|
| Kaydırma bölgesi sayısı (modal içi) | **12** (1 dış kap + 11 `<pre>`) | **1** |
| İç içe kaydırma kabı | 11 | **0** (bölümler açıldıktan sonra da **0**) |
| `<pre>` `overflow-y` | `auto` (`max-h-64` → `clientHeight` 254px) | `visible`, yükseklik serbest (sözleşme `<pre>` açıkken 27.712px, tek akışta) |
| `PageDown` sonrası `scrollTop` | **0** (sabit) | **399** |
| `ArrowDown` sonrası | 0 | 439 |
| `End` / `Home` | — | 6513 / 0 |
| Katlanabilir bölüm | yok | **11** (`Açıklama` **açık**, `Sözleşme` + 9 QA raporu **kapalı**) |
| Odaklanabilir öğe sayısı (focus-trap seçicisi) | **1** ("Kapat") | **14** (Kapat, Yenile, içerik kabı, 11 `summary`) |

**Klavye ile bölüm açma (brief'in istediği):** `Tab` → `Tab` → içerik kabı (`tabindex=0`,
`activeElement` doğrulandı) → `Tab` → `summary "Açıklama"`; **`Enter`** bölümü kapattı
(`open=false`, kabın `scrollHeight` 7068 → 394), **`Space`** yeniden açtı (`open=true`,
`scrollHeight` 7068). Yani hem `Enter` hem `Space` çalışıyor.

**Focus-trap regresyonu yok** (düzeltme seçiciye `summary` ekledi — bu yüzden yeniden ölçtüm):
15 `Tab` sonrası odak modalın içinde ve "Kapat"a sarıyor (`inModal: true`); `Esc` pencereyi
kapatıyor (`modalCount: 0`).

**Mutasyon M5** — `<pre>`'ye `max-h-64 overflow-y-auto` geri konuldu (düzeltmeyi birebir geri
saran mutasyon): jsdom paketi yeşil kaldı ama **E2E KIRMIZI** —
`expect(nestedScrollBoxCount).toBe(0)` → `Received: 2`. K5 çitli.

---

## 6. K4 — bayatlık, canlı ölçüm

1. **20:48:31** — F-012 penceresi açıldı, panelde `Son yenileme: 20:48:31`, 9 QA raporu.
2. **20:50:26** — pencere açıkken, **gövdeye dokunmadan** diskten üç yazma:
   `F-012-contract.md` üzerine yazıldı, `F-012-contract-review-1.md` üzerine yazıldı,
   **yeni** `F-012-2026-09-08-probe.md` oluşturuldu.
3. **20:50:43** (8 sn bekleme sonrası) — panel hâlâ eski içerik (beklenen: `docs/qa` SSE ile
   izlenmiyor, J6/K4 bilinçli kararı) **ama** `Son yenileme: 20:48:31` yazıyor ve o an saat
   20:50:43 → kullanıcı içeriğin 2 dakikalık olduğunu **görüyor**. 1. turdaki "hiçbir bayatlık
   göstergesi yok, elle tazeleme yolu yok" durumu ortadan kalktı.
4. **20:50:55** — "Yenile" tıklandı: sözleşme `YENI-SOZLESME-TUR2-MARKER`,
   review-1 `QA-TUR2-BAYATLIK-MARKER-XYZ`, rapor sayısı **9 → 10** (yeni `-probe.md` listede),
   `Son yenileme: 20:50:55` (tıklama anıyla uyumlu). **Sessiz bayatlık kalmadı.**

**Mutasyon M4** — `onClick={refresh}` → `onClick={() => {}}` (düzeltmeyi birebir geri sarar):
`Tests 1 failed | 132 passed` → **KIRMIZI** ("Yenile butonu YENİ bir `/api/features/detail`
çağrısı tetikler ve güncel sözleşme içeriğini gösterir (content_hash DEĞİŞMESE bile)").

AC6'nın "veya bayat olduğu belli olur" dalıyla karşılandığı `docs/03-ux.md:133-142`'de açıkça
yazılı — AC sessizce `[x]` bırakılmadı, belge güncellendi.

---

## 7. Mutasyon tablosu (6 bağımsız mutasyon)

| # | Hedef | Mutasyon | Sonuç | Kanıt |
|---|---|---|---|---|
| M1 | Guard üçüncü kontrol (K2) | `read-guard.ts:78` izinli önek kontrolü etkisizleştirildi | **KIRMIZI (3 test)** | + prob: `.env`/`package.json`/`settings.json` gerçekten sızdı, repoda `CLAUDE.md` 14.532 karakter |
| M2 | `SAFE_ID_PATTERN` (K1) | `feature-detail.ts:133` → `card.id !== ''` | **KIRMIZI (1 test)** | 1. turda **YEŞİL (109/109)** idi |
| M3a | Manifest (K3) | Mutlu yola sabit içerikli `fs.writeFileSync` (yeni dosya) | **KIRMIZI (2 test)** | 1. turda `-t "manifest"` ile **2 passed** idi |
| M3c | Manifest kapsamı — silme | `readOptionalDocument` okuduğu dosyayı siler | **KIRMIZI (1 test)** | testin iddia ettiği kapsam gerçek |
| M4 | Bayatlık (K4) | `onClick={refresh}` → no-op | **KIRMIZI (1 test)** | `KanbanScreen.test.tsx` K4 testi |
| M5 | Okunabilirlik (K5) | `<pre>`'ye `max-h-64 overflow-y-auto` geri kondu | **KIRMIZI (E2E)** | `nestedScrollBoxCount` beklenen 0, gelen 2 |

Ek kontrol (mutasyon değil, çit denetimi): **M6 — `tabIndex={0}` kaldırıldı** → `verify` paketi
**YEŞİL**, K5/K6 E2E testi de **YEŞİL** kaldı. Bkz. N6.

`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca meşru test adları
(11 satır; `write-gate-manifest.test.ts:124` dahil, dokunulmadı). Tüm mutasyonlar
`git checkout --` ile birebir geri alındı; `dist/` mutasyonsuz kaynaktan **yeniden derlendi**
(`tabIndex:0` bundle'da var, `max-h-64` yok); `git status` temiz.

---

## 8. Dar genişlik regresyonu (`<details>` yapısı bir şey bozdu mu?)

Kırpılmış görünür genişlikle ölçüldü (`toBeVisible()` **kullanılmadı**), F-012 penceresi açık:

| Genişlik | modal | `summary` | `<pre>` | "Yenile" | "Son yenileme" | belge `scrollWidth` | sağ kenarı aşan öğe | iç kaydırma kabı |
|---|---|---|---|---|---|---|---|---|
| 320 | 288 | 239 | 239 | 61 | 158 | 320 | **0** | **0** |
| 375 | 343 | 294 | 294 | 61 | 158 | 375 | **0** | **0** |
| 480 | 448 | 399 | 399 | 61 | 158 | 480 | **0** | **0** |
| 639 | 607 | 558 | 558 | 61 | 158 | 639 | **0** | **0** |
| 640 | 608 | 559 | 559 | 61 | 158 | 640 | **0** | **0** |

Hiçbir genişlikte yatay belge kaydırması yok, hiçbir öğe kırpılmıyor. 320px'te "Son yenileme"
metni 33..191, "Yenile" düğmesi 226..287 — çakışma yok. (Kırılma noktasının iki yanı 639/640 ile
ayrıca sınandı.) `screens/F-013-t2-03-320px.png`

---

## 9. Test paketleri

| Komut | Sonuç |
|---|---|
| `npm run verify` | **EXIT=0** — `943 passed | 2 skipped (945)`, `66 passed` dosya, build 298,93 kB JS / 20,95 kB CSS. Tek koşuda yeşil, tekrar gerekmedi (worker fork kararsızlığı görülmedi) |
| `npm run e2e` | **EXIT=0** — `28 passed (34.0s)` |

Developer'ın "943 test / 66 dosya" ve "28/28" iddiaları **doğrulandı**.
Tailwind `@source` kapsamı: K4/K5'in getirdiği 10 sınıf (`cursor-pointer`, `font-semibold`,
`space-y-3`, `min-h-8`, `justify-between`, `whitespace-pre-wrap`, `break-words`,
`text-amber-400`, `pt-2`, `gap-2`) → **10/10** `dist/web/assets/index-WlzTwQSg.css` içinde.

---

## 10. NOT'lar (bloklayıcı değil)

- **N6 (YENİ, çit zayıflığı)** — `tests/e2e/kanban.spec.ts:630-636`'daki K6 assert'i
  `scrollBox.focus()` ile başlıyor. Playwright'ın `locator.focus()`'u CDP üzerinden odağı
  **zorla** verir: ölçtüm, `tabIndex={0}` tamamen kaldırılmış bir bundle'da bile
  `document.activeElement` o `div` oluyor ve test **yeşil kalıyor** (M6). Yani "kap klavye ile
  odaklanabilir" iddiası ölçülmüyor. Kullanıcıya görünen davranışın bozulmadığını ayrıca
  ölçtüm — mutasyonlu bundle'da bile gerçek `Tab` akışı `summary`'lere ulaşıp kabı kaydırıyor
  (K5'in getirdiği `<details>` başlıkları doğal olarak odaklanabilir), bu yüzden bloklayıcı
  değil. Düzeltme ucuz: `focus()` yerine `page.keyboard.press('Tab')` ile gerçek odak akışını
  yürüt ve `document.activeElement === scrollBox` assert'i ekle. **Bir sonraki dokunuşta
  kapatılsın.**
- **N1/N2/N3 (1. turdan devir)** — CEO bilinçli olarak kapsam dışı bıraktı, değişmedi.
- **N4/N5 (F-007'den miras)** — F-013'e ait değil; 320px'te `h2` sağ kenarı 255px ile "Kapat"
  sol kenarı 255px hâlâ bitişik (bu turda da ölçüldü, F-013 başlık satırına dokunmadı).
- `docs/qa/*` hâlâ SSE ile izlenmiyor: kullanıcı "Yenile"ye basmazsa panel eski içeriği
  göstermeye devam eder. AC6 bunu "bayat olduğu belli olur" dalıyla karşılıyor ve
  `docs/03-ux.md` bunu açıkça yazıyor — kabul edilebilir, ama otomatik tazeleme istenirse
  ayrı bir feature olmalı.

---

## 11. Puanlar

| Boyut | 1. tur | 2. tur | Gerekçe |
|---|---|---|---|
| İşlevsellik | 7 | **8** | Bayatlık artık yalan söylemiyor: saat + "Yenile" ile kullanıcı her zaman güncel içeriğe ulaşabiliyor (canlı ölçüldü). Otomatik tazeleme yokluğu bilinçli ve belgeli |
| Özellik bütünlüğü | 5 | **8** | 9 AC'nin 9'u karşılanıyor; AC3/AC4/AC6'nın istediği çitler artık gerçekten ölçüyor. Eksi: N6 (bir E2E assert'i vakum) |
| Görsel / UX | 6 | **8** | 12 → 1 kaydırma bölgesi, 0 iç içe kutu, klavyeyle tam kontrol (`Tab`/`Enter`/`Space`/`PageDown`/`Home`/`End`), beş genişlikte kırpma ve taşma yok |
| Kod kalitesi | 7 | **8** | Altı mutasyonun beşi KIRMIZI, ikisi (M1/M2) savunma katmanlarını **ayrı ayrı** çitliyor; yorumlar kodla uyumlu; `write-gate.ts`'e dokunulmamış; dosya sahipliği ihlali yok; `verify` 943/66 + `e2e` 28/28 doğrulandı. Eksi: N6 |

Dört boyut da ≥ 7 → **GEÇTİ**.

---

## 12. Süreç hijyeni

- **Yetim süreç: 0.** Bu turda başlattığım tek sunucu (port 7357, PID ağacı
  52228 → 33548 → 37080 → 49208) `taskkill /T /F` ile sonlandırıldı; `netstat` 7350-7359
  aralığında LISTENING **yok**. Kalan 5 `node.exe`: **3'ü `C:\dev\apps\hayat-mentoru`**
  (PID 37640 `npm run dev`, 27556 `next dev`, 34488 `start-server.js`) — **dokunulmadı**;
  2'si Playwright MCP aracı (PID 32828, 29464). Mission Control'e ait süreç **0**.
- **Repo durumu:** tüm mutasyonlar `git checkout --` ile geri alındı, `dist/` temiz kaynaktan
  yeniden derlendi, `git status` temiz. Fixture proje ve izole `MC_DATA_DIR` scratchpad'de
  kaldı — depoya hiçbir test dosyası yazılmadı (`docs/features` ve `docs/qa` orijinal hâlinde).
- **Ürün kodu düzenlenmedi.** Yazdıklarım: bu rapor, `docs/qa/latest.md`, üç ekran görüntüsü,
  feature notunun `status` satırı.

## 13. Doğrulayamadıklarım

- **Dosya symlink'i / UNC / hardlink** — 1. turdaki kısıtlar aynen geçerli (Windows'ta
  `fs.symlinkSync(...,'file')` EPERM, erişilebilir ağ payı yok). Dizin junction'ı yolu 1. turda
  kapalı ölçülmüştü ve bu turda guard'a eklenen üçüncü kontrol o yolu **daha da** daraltıyor.
