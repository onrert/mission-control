# F-007 — QA kod turu raporu (qa-evaluator, 2026-09-06)

KARAR: KALDI
ESKALE: false

Puanlar (1-10): **İşlevsellik 7 · Özellik bütünlüğü 6 · Görsel/UX 6 · Kod kalitesi 6**
Karar kuralı: üç boyut < 7 ve iki bloklayıcı bulgu var → KALDI.

Kapsam: `docs/features/F-007-kanban.md` (10 AC + 6 devralınan taahhüt), `docs/qa/F-007-contract.md`
(CEO onayı → CEO kararları → D40-D45 → A-F → gövde), `docs/03-ux.md` ekran 2 + akışlar,
ADR-001 (karar 5/8), ADR-005, ADR-013.

---

## 1. Komutlar ve gerçek çıktılar (hepsini kendim koşturdum)

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` | **0** | typecheck + lint + `Test Files 48 passed (48)` / `Tests 728 passed (728)` + `vite build ✓ built in 1.15s` |
| `npm run e2e` | **0** | `23 passed (27.4s)` (chromium, workers:1) |
| `npm run e2e:dev` | **0** | `1 passed (4.4s)` |
| `npm audit` | **0** | `found 0 vulnerabilities` |

Vitest worker fork kararsızlığı bu turda **görülmedi**: `npx vitest run` bu turda toplam 9 kez
koşturuldu (mutasyonlu koşular dahil), doğru kodda her seferinde 728/728.

---

## 2. AC1-AC10 + T1-T6 kanıt tablosu (16/16 kutu işaretliydi — her birini ayrı doğruladım)

Doğrulama ortamı: **üretim derlemesi** (`npm run build` + `tsx src/server/index.ts`), izole
`MC_DATA_DIR`, `MC_PORT=7433`, geçici fixture proje (11 dosya: 7 geçerli durum + CRLF/BOM/yorumlu
dosya + tanımsız durum + bozuk frontmatter + `.txt`).

| # | Kriter | Kanıt | Sonuç |
|---|---|---|---|
| AC1 | Kart doğru sütunda | Tarayıcı: 7 sütunun her birinde beklenen kart; `parse-feature.test.ts` + M2b mutasyonum KIRMIZI | **GEÇTİ** |
| AC2 | Yalnızca `status` baytı değişir | §4 bayt diff: 144→146 bayt, **tek fark** `status:   todo` → `status: contract`; BOM, CRLF, yorum satırı, gövde birebir korundu. M3b (`+ ' '`) 11 test KIRMIZI | **GEÇTİ** |
| AC3 | Dış değişiklik ≤2 sn | Gerçek ölçüm: dosya yazımı `t=1788642797485`, DOM'da görünme `t=1788642797951` → **466 ms** | **GEÇTİ** |
| AC4 | Çakışma: yazma durur, uyarı, yeniden çizim | §3'teki sessiz-üzerine-yazma denemesi: 409, disk korundu, Türkçe banner + kart eski sütunda. M1 (handler hash'i diskten yeniden hesaplasın) KIRMIZI | **GEÇTİ** |
| AC5 | Yazma hatası: kart geri döner, panel çökmez | `chmod 444` ile gerçek EPERM: kart QA sütununda kaldı, `F-103 kaydedilemedi: Dosyaya yazma izni reddedildi.` + `[Tekrar dene]`, panel ayakta. M8 (rollback kaldır) KIRMIZI. **Ama:** `rereadCard` hata yolu kapsanmıyor → **B1** | **KOŞULLU** |
| AC6 | "Bilinmeyen durum" + sürüklenebilir | 8. sütun render ediliyor (`kanban-column-unknown`); F-300 klavye ile Engelli'ye taşındı, diskte `status: blocked` | **GEÇTİ** |
| AC7 | Kart detayı salt okunur | Modal: `F-100 — Kart todo`, Durum/Sahip (owner)/Bağımlılıklar (deps)/Sprint; ekran görüntüsü aşağıda | **GEÇTİ** |
| AC8 | Echo döngü/yanıp sönme yok | E2E D42 render sayacı gerçek çit (M4 mutasyonumu KIRMIZI yakaladı). jsdom çiti flaky → **Ö4** | **KOŞULLU** |
| AC9 | Klavye alternatifi | Gerçek tarayıcı: `Tab`→`Boşluk`→`ArrowRight`→`Enter` üç ayrı kartta diske yazdı. M5 (`keyboardCodes.end`→`['KeyQ']`) E2E'de KIRMIZI (birim testlerde YEŞİL) | **GEÇTİ** |
| AC10 | "Etiket (kod)" başlıkları | DOM: `Yapılacak (todo)`, `Sözleşme (contract)`, `Geliştirme (dev)`, `QA (qa)`, `Düzeltme (fix)`, `Bitti (done)`, `Engelli (blocked)`, `Bilinmeyen durum` — ADR-001 karar 8 uyumlu | **GEÇTİ** |
| T1 | Tam `tablist` deseni | Statik ARIA doğru (`role=tablist/tab/tabpanel`, roving `tabindex`, Ayarlar desen dışında). **Ok tuşu odağı taşımıyor (Ö1), klavye kodu tamamen çitsiz (Ö2), `aria-controls` yarım çitli (Ö3)** | **KALDI** |
| T2 | F-005 AC1 görsel kanıtı | Canlı ölçüm: `POST /api/projects` → kart DOM'da **4,6 sn** içinde; proje çipi de eklendi | **GEÇTİ** |
| T3 | 375px'te gezinme kaybolmaz | Ölçüm: her iki sekmenin **görünür piksel genişliği 0** → **B2** | **KALDI** |
| T4 | `Atomics.wait`→async | `write-gate.ts:136` `delay()` `setTimeout` tabanlı; `Atomics.wait` grep=0; `setFeatureStatus`/`writeGateApproval`/`writeGateDenial` async | **GEÇTİ** |
| T5 | `safeYamlValue` sertleştirme | `YAML_INDICATOR_START` + `resolvesToNonString` (`write-gate.ts:191-215`), 40 golden fixture yeşil | **GEÇTİ** |
| T6 | `OPERATION_PATTERNS` koşulu | `git diff fec3aa2..HEAD -- src/server/write-gate.ts`: desenlere hiç dokunulmamış → koşul tetiklenmedi, kayıt doğru | **GEÇTİ (uygulanamaz)** |

---

## 3. Sessiz üzerine yazma denemesi (görev madde 4 — AC4'ün özü)

**Senaryo:** Kanban açıkken F-102 kartında `Boşluk` ile klavye sürüklemesi başlatıldı (bu sırada
`useFeatures.isDraggingRef` yeniden çekmeyi kuyruklar), sürükleme **açıkken** dosya diskten
değiştirildi (`metin` → `DISARIDAN DEGISTIRILDI - KAYBOLMAMALI`), sonra `ArrowRight` + `Enter` ile
bırakıldı.

**Diskte gerçekte ne oldu (dönen koda değil, `od -c` çıktısına baktım):**

```
status: dev            <- DEĞİŞMEDİ
# Govde dev
DISARIDAN DEGISTIRILDI - KAYBOLMAMALI   <- dış değişiklik KORUNDU
```

- HTTP: `409 Conflict` (tarayıcı konsolunda tek hata satırı bu).
- UI: `F-102 panel açıkken dışarıdan değişti — güncel durum yüklendi (Geliştirme/dev). Az önceki
  sürükleme uygulanmadı.` + `[Kapat]`; kart Geliştirme sütununda yeniden çizildi.
- **Sessiz üzerine yazma YOK.** AC4 uçtan uca doğrulandı.

Ek olarak hash üretim noktasını ve handler seviyesini ayrı ayrı mutasyonladım (M1, M2b) — ikisi de
KIRMIZI, yani çakışma yolu iki noktadan çitli.

Kalan teorik pencere (bulgu değil, kayıt): `setFeatureStatus` oku-karşılaştır-yaz sırasını
kilitsiz yapıyor (`write-gate.ts:255-302`); okuma ile `rename` arasındaki (~ms) pencerede yapılan
bir dış yazım kaybolur. Tek kullanıcılı yerel araçta kabul edilebilir, ADR-005 madde 7 bunu zaten
"hash karşılaştırması" seviyesinde tanımlıyor.

## 4. AC2 bayt diff kanıtı

Gerçek klavye sürüklemesi sonrası, BOM + CRLF + yorum satırı + fazladan boşluk içeren fixture:

| | önce | sonra |
|---|---|---|
| bayt | 144 | 146 |
| farklı segment | `status:   todo` | `status: contract` |
| BOM (`﻿`) | var | var |
| satır sonları | tümü `\r\n` | tümü `\r\n` |
| `# yorum satiri` / gövde | aynı | aynı |

`\r\n` ayracını yakalama grubuyla bölüp segment segment karşılaştırdım: **`status` satırı dışında
farklı segment yok.** Not: satır tamamen yeniden yazıldığı için `status:` sonrasındaki fazladan
girinti normalleşiyor — ADR-005 madde 6 "yalnızca girintisiz ilk `status:` satırı değiştirilir"
kapsamında, ihlal değil.

---

## 5. Kendi mutasyon tablom (9 mutasyon — developer'ın 14'ünü tekrarlamadım; biri kasıtlı tekrar)

Her mutasyon: uygula → ölç → `git checkout --` ile geri al.

| # | Mutasyon | Dosya:satır | Koşturulan | Sonuç |
|---|---|---|---|---|
| M1 | Handler istemcinin `expected_hash`'ini yok sayıp diskten yeniden hesaplasın (sessiz üzerine yazma) | `handlers.ts:124` | `features-api.test.ts` | **KIRMIZI** (409 testi) |
| M2b | `content_hash` üretim noktası bozulsun (`sha256(buffer+'x')`) | `parse-feature.ts:48` | tam vitest | **KIRMIZI** (3 test) |
| M3b | `newText = parts.join('') + ' '` (status DIŞINDA bayt ekle) | `write-gate.ts:300` | tam vitest | **KIRMIZI** (11 test, golden fixture'lar) |
| M4 | `mergeCards` aynı referans yerine **sığ kopya** döndürsün | `useFeatures.ts:56` | `useFeatures.test.ts` ×11 | **YEŞİL 8/11** (bkz. Ö4) · E2E D42: **KIRMIZI** |
| M4b | Developer'ın mutasyon 5'i birebir tekrar (`return next`) | `useFeatures.ts:56` | `useFeatures.test.ts` ×6 | **YEŞİL 1/6** (flaky doğrulandı) |
| M5 | `keyboardCodes.end` = `['KeyQ']` (Enter/Boşluk/Tab onayı kaldırıldı) | `KanbanScreen.tsx:59` | tam vitest / E2E `-g AC9` | Birim **YEŞİL 728/728**, E2E **KIRMIZI** |
| M6 | `aria-controls` = `panel-XX-<tab>` | `App.tsx:83` | `App.test.tsx` | **KIRMIZI** (1 test) |
| M6b | Her iki sekme de `aria-controls="panel-timeline"` | `App.tsx:83` | tam vitest | **YEŞİL 728/728** (bkz. Ö3) |
| M7 | `tests/e2e/zzz-qa-probe.spec.ts` eklendi (hiçbir config'te yok) | geçici dosya | `e2e-config-guard.test.ts` | **KIRMIZI**, dosya silindi |
| M8 | `patchStatus` hata dalındaki `restore()` kaldırıldı | `useFeatures.ts:199` | tam vitest | **KIRMIZI** (1 test) |
| M9 | `onKeyDown={onTabKeyDown}` tamamen kaldırıldı (tablist ok tuşları) | `App.tsx:87` | tam vitest **+ tam E2E** | **YEŞİL 728/728 + 23/23** (bkz. Ö2) |

**Yeşil kalan mutasyonlar: M4 (kısmen), M5 (birim katmanında), M6b, M9.**

Ayrıca hata yolu **fault injection** (mutasyon değil, arıza enjeksiyonu) — bkz. B1.

---

## 6. Bulgular (2 bloklayıcı · 5 önemli · 4 not)

### BLOKLAYICI

**B1 — `PATCH /api/features` yanıtı, yazma başarılı olduktan sonraki bir okuma hatasında SONSUZA
KADAR askıda kalıyor (istemci hiçbir yanıt almıyor).**
`src/features/kanban/server/handlers.ts:123-165` — `void (async () => { … })()`; içindeki
`rereadCard()` (`handlers.ts:43-48`, satır 128 ve 135'te çağrılıyor) `try/catch` içinde **değil**.
`withDispatchErrorBoundary` (`src/server/index.ts:147`) yalnızca **senkron** dağıtımı sarıyor,
bu asenkron IIFE'yi yakalayamaz.

*Tekrar üretme (ölçüldü):* `rereadCard`'ın başına `MC_QA_FAULT=1` ile tetiklenen bir `EBUSY`
fırlatması eklendi (geçici, geri alındı) → üretim derlemesi 7434'te başlatıldı → geçerli hash ile
`PATCH` gönderildi.
*Beklenen:* 500 + `{"code":"write_failed"}` (mimari §6 / `src/shared/types.ts:45`: "handler ne
olursa olsun genel 500'e düşer").
*Gerçek:* `HTTP=000 time=10.013` (curl 10 sn'de zaman aşımına uğradı, sunucu **hiç yanıt
vermedi**), `server2.log`'da tek satır: `Beklenmeyen reddedilen promise (güvenlik ağı, B1): Error:
EBUSY…`. **Yazma diskte gerçekleşmişti** (`status: dev`), yani veri yazıldı ama istemci hiçbir
zaman haber almıyor.
*İstemci etkisi:* `useFeatures.patchStatus`'un `await writeFetchForPatch(...)`'i hiç çözülmez →
`pendingKeys` o kart için **hiç temizlenmez** (`useFeatures.ts:164-170` yalnızca yanıt/catch
yolunda çağrılıyor), kart kalıcı olarak "bekliyor" durumunda donar; ne hata banner'ı ne rollback
çalışır. Süreç yalnızca F-002'den kalan `unhandledRejection` **güvenlik ağı** sayesinde ayakta —
o ağın kendi yorumu "ASIL çözüm değil" diyor (`src/server/index.ts:21-24`).
*Neden gerçekçi:* ürün Windows-only (ADR-009); ADR-005 madde 5 aynı dosya için EPERM/EBUSY
riskini **yazma** tarafında kabul edip 3 kademeli retry koymuş. Yazmadan hemen sonraki okuma, AV
tarayıcısının dosyayı kilitlediği tam penceredir. Yani hata sınıfı sözleşmenin kendi kabul ettiği
sınıf; kapatılan taraf yazma, açık kalan taraf okuma.
*Sınıf tekrarı:* F-002 B1 ve F-005'in "yeni yazma yolunda fault injection" dersinin **üçüncü**
tekrarı; bu turda hiçbir test bu yolu koşmuyor (`grep -n "rereadCard" tests/` = 0).

**B2 — T3 (devralınan taahhüt 3) sağlanmıyor: 375px'te sekme çubuğunun görünür piksel genişliği
SIFIR; çiti de bunu ölçmüyor.**
*Ölçüm (gerçek Chromium, 375×720, `getBoundingClientRect`):*
`header > div` (kaydırma kabı) `x=16, right=184, clientWidth=168, scrollWidth=395, scrollLeft=0`;
`#tab-timeline` `x=219`, `#tab-kanban` `x=361` → **kırpılmış görünür genişlik: her ikisi de 0 px.**
Kullanıcı `MISSION CONTRO…` başlığı ve Ayarlar dişlisinden başka bir şey görmüyor; ekranlar arası
geçiş ancak başlık şeridini yatay kaydırmayı **keşfederse** mümkün.
*Sözleşme ne diyor:* §6 madde 3 — "gezinme **hiçbir zaman tamamen gizlenmez**".
`docs/03-ux.md:17` (G3 onaylı) — dar ekranda "yatay kaydırılabilir bir şerit halinde kalır —
hamburger menüsü, **gizli navigasyon** veya ikinci bir tıklama katmanı gerektirmez".
*Çit neden yakalamıyor:* `tests/e2e/kanban.spec.ts:353-362` sekmeler için yalnızca
`toBeVisible()` + `.click()` kullanıyor. Playwright'ta `toBeVisible()` bir `overflow-x-auto`
kabında kaydırılmış öğe için **doğrudur** ve `.click()` öğeyi otomatik olarak görünür alana
kaydırır — yani test, kullanıcının hiç göremediği bir sekmede de yeşil kalır. Ayarlar düğmesi için
gerçek bir `boundingBox` sınırı var (satır 348-351), sekmeler için **yok**.
*Etki:* F-005'te aynı sınıf "statik etiket" olduğu için tolere edilmişti; F-007 sekmeleri **tek
gezinme mekanizmasına** çevirdiği için taahhüt tam da bu yüzden devredilmişti. Taahhüt feature
notunda `[x]` işaretli ve kanıt olarak bu ölçmeyen test gösteriliyor.
*Not:* geniş ekranda (1280px) sorun yok.

### ÖNEMLİ

**Ö1 — Tablist ok tuşları DOM odağını taşımıyor (WAI-ARIA roving tabindex ihlali).**
`src/web/App.tsx:45-59` `onTabKeyDown` yalnızca `selectTab(...)` çağırıyor; yeni seçili sekmeye
`focus()` verilmiyor.
*Ölçüm:* `#tab-kanban` odaktayken `ArrowLeft` → `aria-selected="true"` **tab-timeline**'a geçti,
`tabIndex` 0/-1 yer değiştirdi, ama `document.activeElement` hâlâ **tab-kanban** (artık
`tabIndex=-1` olan öğe). Ekran okuyucu odak taşınmadığı için sekme değişimini duyurmaz; sonraki
`Tab` basışı beklenmedik yere düşer. Sözleşme §7 bunu açıkça "APG Tabs Pattern, roving tabindex"
diye tanımlıyor.

**Ö2 — Tablist klavye gezinmesinin HİÇBİR testi yok (M9 tam yeşil).**
`onKeyDown={onTabKeyDown}` bağlantısı tamamen silindiğinde **728/728 birim + 23/23 E2E yeşil**
kaldı. `grep -rn "ArrowLeft\|onTabKeyDown\|'End'" tests/` → tablist için 0 sonuç. Sözleşme §5 T1
satırı "E2E (**gerçek ok tuşu, gerçek focus**)" vaat ediyordu; teslim edilen kanıt
`tests/web/App.test.tsx:41-56`'daki **statik HTML dizge** assert'leri. `Home`/`End` (§7'de
"tek satırlık ek" denen davranış) da hiç ölçülmüyor.

**Ö3 — `aria-controls` eşleşmesi yarım çitli (M6b tam yeşil).**
`App.test.tsx:50` yalnızca `aria-controls="panel-timeline"` dizgesini arıyor. Her iki sekmeyi de
`panel-timeline`'a bağlayan mutasyon 728/728 yeşil kaldı — yani Kanban sekmesinin panel ilişkisi
hiç ölçülmüyor (ekran okuyucu yanlış panele giderdi). Aynı test dosyası `panel-kanban` için
`aria-labelledby`'yi kontrol ediyor ama ters yönü (`tab-kanban` → `panel-kanban`) atlamış.

**Ö4 — Echo çiti (jsdom) flaky ve çoğunlukla ölçmüyor — ölçüldü.**
`tests/features/kanban/web/useFeatures.test.ts:61-75`: assert, `fetchImpl` **çağrı sayısı** 2'ye
ulaşır ulaşmaz koşuyor; React'in ikinci state commit'ini beklemiyor. Sonuç:
kendi mutasyonum (`return { ...prevCard }`, davranışsal olarak referans kimliğini bozan en dar
mutasyon) **11 koşuda 8 kez YEŞİL**; developer'ın mutasyon 5'i (`return next`) **6 koşuda 1 kez
YEŞİL**. Developer bunu "bilinen kalıntı" olarak kaydetmiş ama sıklığı ölçmemiş — gerçek yanlış-
yeşil oranı benim mutasyonumda %73. **Bloklayıcı değil**, çünkü ikinci savunma hattı gerçek:
E2E D42 render sayacı (`kanban.spec.ts:367-405`) aynı mutasyonu deterministik olarak KIRMIZI
verdi (`expect(after).toBe(before)`). Düzeltme yönü: assert'i `waitFor(() => expect(cards[0])
.toBe(firstRef))` yerine, ikinci fetch'in state'e yansıdığını gösteren bir gözlemden (ör.
`lastSyncedAt` değişimi) sonra yapmak.

**Ö5 — Sözleşme §6 madde 1'in açıkça söz verdiği "Ayarlar açıkken tablist durumu" testi yazılmamış.**
Sözleşme: "`KanbanScreen.test.tsx`/App testlerine bu üçüncü durumu … doğrulayan bir test eklenir."
`grep -rn "lastTabScreen" tests/` = 0. Davranışı tarayıcıda elle doğruladım ve **doğru**
(Ayarlar açıkken tam olarak bir `[role=tab][aria-selected=true]` kalıyor, `aria-pressed="true"`),
ama çit yok → gelecek turda sessizce bozulabilir. (Ayrıca sözleşme "Ayarlar kendi
`#panel-settings`'inde gösterilir" diyor; DOM'da böyle bir id yok — metin bayat.)

### NOT (GEÇTİ'yi engellemez, kayıt)

**N1 —** 403 `write_denied` istemciye §4.3 sözlüğündeki *"dosya biçimi tanınamadı. Tekrar
deneyin."* yerine 500 ile **aynı** metni (`Dosyaya yazma izni reddedildi.`) döndürüyor
(`handlers.ts:147` ve `:158`). Kullanıcı güvenlik reddi ile disk hatasını ayırt edemiyor; sözlük
satırı uygulanmamış.

**N2 —** Brief'in "`settings.spec.ts` ve `shell.spec.ts` assert'leri değişti" öncülü yarı yanlış:
`git diff fec3aa2..HEAD --stat` yalnızca `tests/e2e/shell.spec.ts`'i (+31/-... ) gösteriyor,
`settings.spec.ts`'e **hiç dokunulmamış**. `shell.spec.ts` değişikliği davranış gevşetmesi
değil, yeni gerçeğe uyarlama: `clickableCount` 1→**3**, `aria-current` sayısı 1→**0**,
`tabRoleCount` 0→**2** ve **yeni** bir "tam olarak bir `[role=tab][aria-selected=true]`, metni
`Zaman Çizelgesi`" assert'i eklenmiş. Ölçme niteliği korunmuş, regresyon yok.

**N3 —** CEO ödevleri hâlâ açık: `docs/03-ux.md:443` klavye akışı hâlâ "`Enter`/`Boşluk` ile
seçili moda al" diyor (CEO onaylı sapma yansıtılmamış) ve §4.3'ün iki yeni hata metni UX Türkçe
sözlüğüne eklenmemiş (`grep "sunucuya ulaşılamadı" docs/03-ux.md` = 0). Developer'ın işi değil,
ama G4-1 öncesi kapanmalı.

**N4 —** `setFeatureStatus` oku→karşılaştır→`rename` sırası kilitsiz; okuma ile yeniden adlandırma
arasındaki milisaniyelik pencerede yapılan bir dış yazım sessizce kaybolur. Tek kullanıcılı yerel
araçta kabul edilebilir; kayıt olarak duruyor (ADR-005 madde 7'nin sınırı).

---

## 7. Görsel doğrulama (üretim derlemesi + izole veri dizini + geçici fixture)

| Gözlem | Sonuç |
|---|---|
| 7 durum sütunu + "Bilinmeyen durum" | 8 sütun render ediliyor (`kanban-column-todo…unknown`) |
| Sütun başlığı biçimi | `Geliştirme (dev)` — ADR-001 karar 8 uyumlu, hepsi Türkçe |
| Kart sürüklenince dosya değişiyor mu | Evet (klavye ile 3 farklı kart, 3 farklı dosya diskte değişti) |
| Kart detay modalı (AC7) | `id`, `title`, `Durum`, `Sahip (owner)`, `Bağımlılıklar (deps)`, `Sprint`; `Esc` kapatıyor |
| Hata durumunda kart eski sütununa dönüyor mu (AC5) | Evet, `[Tekrar dene]` ile birlikte |
| Ayrıştırılamayan dosyalar | `Ayrıştırılamayan dosyalar (1)` ayrı liste, sürüklenemez |
| `.txt` dosyası | Kanbanda yok (doğru) |
| 375px | **Sekmeler görünmüyor (B2)**; sütunlar ve uyarı banner'ları doğru sarıyor |
| Konsol | Yalnızca beklenen 409/500 kaynak hataları; JS hatası/pageerror yok |

Ekran görüntüleri:
- `docs/qa/screens/F-007-2026-09-06-kanban-1280.png` (pano, 1280px)
- `docs/qa/screens/F-007-2026-09-06-modal.png` (AC7 detay modalı)
- `docs/qa/screens/F-007-2026-09-06-conflict.png` (AC4 çakışma banner'ı)
- `docs/qa/screens/F-007-2026-09-06-write-error.png` (AC5 yazma hatası + kart geri döndü)
- `docs/qa/screens/F-007-2026-09-06-375px.png` (**B2**: dar genişlikte sekmeler görünmüyor)

## 8. Erişilebilirlik denetimi

| Kontrol | Sonuç |
|---|---|
| `role="tablist"` / `tab` / `tabpanel` | Var, yapısal olarak geçerli |
| `aria-controls`/`id` eşleşmesi | Doğru render ediliyor, **çiti yarım (Ö3)** |
| Roving `tabindex` | Değerler doğru (0/-1), **odak taşınmıyor (Ö1)** |
| Ok tuşları / `Home` / `End` | Seçimi değiştiriyor, **çitsiz (Ö2)** |
| Ayarlar desene giriyor mu | **Hayır** — `aria-pressed` toggle butonu, `role=tab` değil (doğru) |
| Ayarlar açıkken tablist | Tam olarak bir `aria-selected=true` kalıyor (doğru, çitsiz — Ö5) |
| `aria-roledescription` | `"kart"` (Türkçe, dnd-kit'in `"draggable"`'ı geçersiz kılınmış) |
| `screenReaderInstructions` | `DndDescribedBy-0`: *"Bu kartı taşımak için Boşluk tuşuna basın…"* — Türkçe ve **gerçek tuş tasarımıyla uyumlu** |
| dnd-kit'in kendi `aria-live="assertive"` bölgesi | `DndLiveRegion-0` DOM'da var ama içeriği **boş** (susturma çalışıyor) |
| Kendi canlı bölgemiz | `role="status" aria-live="polite" aria-atomic="true"`, sürükleme sırasında `Sözleşme (contract) sütununa taşınıyor` yazdı — Türkçe, `polite` |

## 9. Kapsam, regresyon ve güvenlik denetimi

- **Faz 2 sızıntısı yok:** `grep -rniE "kapılar|thread|token" src/features/kanban src/web/App.tsx`
  → 0 (yalnızca `onNavigateSettings` eşleşti). `App.test.tsx` negatif çiti hâlâ yerinde.
- **`src/features/kanban/**` içinde yazma çağrısı yok:** `writeFile|appendFile|unlink|rename|
  rmSync|mkdir` → 0 sonuç. Yalnızca okuma (`readFileSync`/`statSync`/`readdirSync`/`existsSync`)
  — ADR-005'e uygun; tüm yazmalar `write-gate.setFeatureStatus` üzerinden.
- **`git diff fec3aa2..HEAD --stat`:** 38 dosya, +4093/-166. Kanban dizini + `write-gate.ts` (58
  satır: yalnızca async dönüşümü ve `safeYamlValue`), `App.tsx`, `useEventStream.ts` (`onFeatures`),
  `index.ts` (rota), `shared/*`. Sözleşme §2.1/§2.2 dosya listesinin dışına çıkılmamış (tek
  istisna `tests/e2e/shell.spec.ts`, `docs/blockers.md`'de kayıtlı ve CEO talimatıyla).
- **F-006 regresyonu:** `write-gate.test.ts` bayt-koruma golden fixture'ları ve
  `write-gate-manifest.test.ts` hâlâ yeşil; async dönüşüm imzaları değiştirmiş ama garantileri
  değiştirmemiş. `OPERATION_PATTERNS`'a dokunulmamış (T6 koşulu tetiklenmedi — doğrulandı).
- **Güvenlik:** `x-mc-write` kontrolü tek yerde, dağıtıcıda (`src/server/index.ts:333`), yeni
  `PATCH /api/features/...` rotası ondan **sonra** çözülüyor; regresyon çiti var
  (`tests/integration/features-api.test.ts:285-297`: başlıksız PATCH → 403, GET muaf). Ham
  write-gate hata metni istemciye sızmıyor (`handlers.ts:153-159`: stderr'e ham, istemciye sabit
  Türkçe metin; developer mutasyon 4 KIRMIZI). `npm audit` = 0 açık.

## 10. Temizlik kanıtı

- `git diff HEAD` → **boş** (tüm mutasyonlar geri alındı; `git status --porcelain` yalnızca bu
  raporun 5 ekran görüntüsünü untracked gösteriyor).
- Geçici probe dosyası `tests/e2e/zzz-qa-probe.spec.ts` **silindi**; fixture dizinleri
  (`scratchpad/qa007/**`) silindi; gerçek proje klasörlerine hiç yazılmadı.
- Süreç/port: 7333/7334/7335/7433/7434 üzerinde **LISTENING süreç yok**. Kalan iki `node.exe`
  Playwright MCP sunucusuna ait (komut satırı doğrulandı), uygulama süreci değil.

---

## 11. Puanların gerekçesi

- **İşlevsellik 7:** Mutlu yol, çakışma, hata, klavye, echo, canlı yansıma — hepsi gerçek
  tarayıcıda çalışıyor. Kırılan tek işlevsel yol B1 (yanıtsız kalan istek) ve Ö1 (odak).
- **Özellik bütünlüğü 6:** 10 AC'nin 10'u karşılanıyor, ama 6 devralınan taahhütten **T3 ihlal
  edilmiş** ve **T1 yarım** (klavye davranışı hatalı + çitsiz); ikisi de `[x]` işaretli.
- **Görsel/UX 6:** Geniş ekranda tasarım temiz, Türkçe metinler ve durum ikonları doğru; ama
  UX dokümanının **birincil viewport'unda (320-480px) gezinme görünmüyor** (B2).
- **Kod kalitesi 6:** 728 test + 23 E2E + iyi kurulmuş guard'lar; buna karşılık yeni yazma
  yolunda hata yakalama yok (B1), 4 mutasyonum yeşil kaldı ve sözleşmede söz verilen üç test
  (ok tuşu, Ayarlar durumu, `aria-controls` ters yönü) yazılmamış.

## 12. KALDI'yı kapatmak için istenenler

1. **B1:** `handlers.ts`'teki asenkron IIFE'yi `try/catch`'e al; hata dalında 500 +
   `write_failed` metni dön ve stderr'e logla. Çit: `rereadCard`'ı fırlatan bir entegrasyon testi
   (gerçek HTTP üzerinden yanıt geldiğini ve sürecin ayakta kaldığını ölçen), ayrıca mutasyon:
   `try/catch` kaldırılınca test KIRMIZI.
2. **B2:** 375px'te en az bir sekme her zaman görünür olsun (ör. başlığı kaydırma kabının dışına
   almak veya dar genişlikte kısaltmak). Çit: `boundingBox()` **ve** kırpma hesabı ile "her iki
   sekmenin görünür genişliği > 0" — `toBeVisible()` bu iddia için yeterli değil (bu turda
   ölçüldü).
3. **Ö1/Ö2:** Ok tuşu seçimde yeni sekmeye `focus()` verilsin; E2E'de `ArrowRight`/`ArrowLeft`/
   `Home`/`End` sonrası `document.activeElement` ölçülsün. Mutasyon: `onKeyDown` bağlantısını
   silmek KIRMIZI vermeli (bugün yeşil).
4. **Ö3:** `aria-controls="panel-kanban"` de assert edilsin (veya iki sekmenin `aria-controls`
   değerlerinin **farklı** ve kendi panel id'lerine eşit olduğu).
5. **Ö4:** jsdom echo assert'i determinist hâle getirilsin; kabul ölçütü: `{ ...prevCard }`
   mutasyonu 10/10 KIRMIZI.
6. **Ö5:** `lastTabScreen` davranışı için söz verilen test yazılsın; sözleşmedeki
   `#panel-settings` cümlesi gerçeğe göre düzeltilsin.
7. **N1:** 403 için §4.3 sözlüğündeki metin kullanılsın (veya sözlük gerçeğe göre güncellensin).
