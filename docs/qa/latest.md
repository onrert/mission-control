# F-007 — QA düzeltme turu 1 doğrulaması (qa-evaluator, 2026-09-06)

KARAR: GEÇTİ
ESKALE: false

Puanlar (1-10): **İşlevsellik 9 · Özellik bütünlüğü 8 · Görsel/UX 8 · Kod kalitesi 8**
(önceki tur: 7 · 6 · 6 · 6). Dört boyut da ≥ 7, açık BLOKLAYICI/ÖNEMLİ yok → **GEÇTİ**.

Kapsam (bağlayıcı, brief'e göre dar): **B1, B2, M9, M6b, M4, Ö1, N1 + D46-D50** ve düzeltmenin
ürettiği regresyon. Önceki turda onaylanan bölümler (sessiz üzerine yazma, AC2 bayt diff,
F-005/F-006 regresyonu, güvenlik, kapsam) **yeniden açılmadı**.

---

## 1. Komutlar ve gerçek çıkış kodları (hepsini kendim koşturdum)

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` (1. koşu) | **1** | `Worker exited unexpectedly with exit code 3221226505` — `tests/integration/projects-api.test.ts`; `47 passed (48)` / `722 passed (732)`. Bilinen vitest worker fork kararsızlığı (bu projede **4. kez**). |
| `npm run verify` (2. koşu) | **0** | `Test Files 48 passed (48)` / `Tests 732 passed (732)` + `vite build ✓ built in 1.18s` |
| `npm run verify` (3. koşu, tüm mutasyonlar geri alındıktan sonra) | **0** | `48 passed (48)` / `732 passed (732)` |
| `npm run e2e` (2 kez) | **0** / **0** | `23 passed (27.1s)` ve `23 passed (26.0s)` |
| `npm run e2e:dev` (2 kez) | **0** / **0** | `1 passed` |
| `npm run build` (elle, dist doğrulaması) | **0** | `index-BtoxddyP.css 19.42 kB` |

CEO'nun ölçtüğü sayılar (48 dosya / 732 test / 23 E2E) **birebir doğrulandı**.

---

## 2. Kapanış tablosu — B1/B2/M9/M6b/M4/Ö1/N1 + D46-D50

| # | Bulgu / karar | Durum | Kendi kanıtım |
|---|---|---|---|
| **B1** | `PATCH` yanıtsız kalıyor (async IIFE `try/catch`'siz) | **KAPANDI** | §3 fault injection: `HTTP=200 time=0.040` (önce `HTTP=000 time=10.013`) |
| **D46** | IIFE gövdesi `try/catch` + yarı-başarı `200` (`data` yok) | **UYGULANDI** | `handlers.ts:130-215`; düzeltme-öncesi koda geri dönüş → integration testi `Test timed out in 5000ms` (KIRMIZI) |
| **B2** | 375px'te iki sekmenin kırpılmış görünür genişliği 0 px | **KAPANDI** | §4: 13 viewport'ta ölçüm, her ikisi de 126 px / 50 px |
| **D47** | Sekme çubuğu <640px'te kendi tam-genişlikli satırında; çit gerçek kırpma ölçüyor | **UYGULANDI** | `App.tsx:83-96`, `tests/e2e/kanban.spec.ts:349-389`; eski düzene dönüş → `Received: 0` (KIRMIZI) |
| **M9 / Ö2 / D48a** | `onKeyDown={onTabKeyDown}` silinince eskiden 728/728+23/23 yeşildi | **KAPANDI** | Mutasyon → `App.interaction.test.tsx:196` KIRMIZI (`expected 'false' to be 'true'`) |
| **M6b / Ö3 / D48b** | İki sekme de `panel-timeline` → eskiden 728/728 yeşildi | **KAPANDI** | Mutasyon → `App.test.tsx:78` KIRMIZI |
| **M4 / Ö4 / D49** | Echo çiti %73 yanlış-yeşildi | **KAPANDI** | §5: mutasyon **12/12 KIRMIZI**, doğru kod **8/8 YEŞİL** |
| **Ö1 / D50** | Ok tuşu DOM odağını taşımıyordu | **KAPANDI** | jsdom: `focusTab` no-op → `App.interaction.test.tsx:198` KIRMIZI. Gerçek Chromium: `ArrowLeft` sonrası `document.activeElement = tab-timeline`, `tabindex` 0/-1 doğru |
| **N1** | 403 `write_denied` 500 ile aynı metni dönüyordu | **KAPANDI** | `handlers.ts:184` → `Dosya biçimi tanınamadı. Tekrar deneyin.`; eski metne dönüş → `features-api.test.ts:270` KIRMIZI. Ham write-gate metni sızmıyor (403 dalında hiç kullanılmıyor, 500 dalı yalnızca `process.stderr.write`) |

**Yeşil kalan mutasyon: YOK (0/8).**

---

## 3. B1 fault injection ölçümü (dört madde, üretim derlemesi + gerçek HTTP + gerçek tarayıcı)

Kurulum: `rereadCard`'ın (`handlers.ts:42-47`) başına `MC_QA_FAULT=1` ile tetiklenen bir `EBUSY`
`throw` enjekte edildi (geçici, geri alındı). `npm run build` + `npx tsx src/server/index.ts`,
`MC_PORT=7434`, izole `MC_DATA_DIR`, scratchpad'de iki kartlı geçici fixture proje.

| Madde | Ölçüm | Sonuç |
|---|---|---|
| **(a) İstemci bir yanıt alıyor mu?** | `curl -m 10 -X PATCH …` → `{"success":true}` · **`HTTP=200 time=0.039984`** (önceki tur: `HTTP=000 time=10.013`) | **EVET** |
| **(b) Süreç yaşıyor mu?** | Aynı süreçte ardışık 4 istek daha: `GET /api/features` → `HTTP=200 time=0.0037`; çakışma yolu → `HTTP=500 time=0.0034`; tekrar → `HTTP=500 time=0.0028`. `server-fault.log`'da **`unhandledRejection` güvenlik ağı satırı YOK**, yalnızca dürüst uyarı satırları | **EVET** |
| **(c) Yazma gerçekleştiyse istemci öğreniyor mu (yarı-başarı dürüst mü)?** | Diskte `status: contract` (yazma uygulandı) + yanıt `{"success":true}` **`data` alanı YOK** → istemci "yazıldı ama tazelenemedi" ayrımını yapabiliyor. Sunucu stderr: `Uyarı: durum yazıldı ama güncel kart okunamadı (F-901.md): EBUSY…` | **EVET** |
| **(d) İstemcide `pendingKeys` temizleniyor mu?** | Gerçek Chromium, üretim derlemesi, fault AÇIK: F-902 kartında `Space`→`ArrowRight`→`Enter`. Sonuç: `[data-testid^="kanban-card-pending-"]` → **boş dizi**, kart **`kanban-column-qa`**'da, canlı bölge `"Ikinci kart → QA (qa) olarak taşındı"`, diskte `status: qa`. Kalıcı "yazılıyor…" YOK | **EVET** |

**Ek ölçüm (yarı-başarının kurtarma yolu, brief dışı ama düzeltmenin ürettiği davranış):**
fault **hâlâ açıkken** aynı kart ikinci kez taşındı (`qa`→`fix`) ve **başarılı oldu** → chokidar
echo'su bayat `content_hash`'i gerçekten düzeltiyor, yarı-başarı çıkmaz sokak değil. Diskte
`status: fix`, DOM'da `kanban-column-fix`.

**D46 mutasyonu (çitin gerçekten ölçtüğü):**
- Düzeltme-öncesi `handlers.ts` (`git show 2e7647f:…`) geri yüklendi →
  `features-api.test.ts` **2 test KIRMIZI**: B1 testi `5023ms` ile **zaman aşımı** (istek gerçekten
  asılı kalıyor) + N1 testi.
- Yalnızca iç `try/catch` (yarı-başarı dalı) kaldırıldı → B1 testi KIRMIZI (`expected 200, got 500`)
  — dış güvenlik ağı devreye giriyor, yani iki savunma hattı **ayrı ayrı** çitli.
- İstemci yarısı: `useFeatures.ts:188` yarı-başarı dalı devre dışı → `useFeatures.test.ts:248`
  KIRMIZI (rollback geri geliyor).

---

## 4. 375px ve 320px görünür genişlik ölçümü (kendi kırpma hesabımla, `toBeVisible()` kullanılmadı)

Yöntem: `getBoundingClientRect()` + tüm `overflow-x: auto/scroll/hidden` ata kaplarla ve
viewport'la kesişim. Gerçek Chromium, üretim derlemesi, `http://127.0.0.1:7434`.

| Viewport | `#tab-timeline` görünür | `#tab-kanban` görünür | Ayarlar | Header yüksekliği | `documentElement.scrollWidth` |
|---|---|---|---|---|---|
| 280 | **126 px** | **50 px** | 79 px | 77 | 280 |
| **320** | **126 px** | **50 px** | 79 px | 77 | 320 |
| 360 | 126 | 50 | 79 | 77 | 360 |
| **375** | **126 px** | **50 px** | 79 px | 77 | 375 |
| 414 / 480 / 560 / 639 | 126 | 50 | 79 | 77 | = vw |
| 640 (kırılma noktası) | 126 | 50 | 79 | **56** | 640 |
| 768 / 1024 / 1280 / 1920 | 126 | 50 | 79 | 56 | = vw |

- **Önceki tur: her ikisi de 0 px. Şimdi 13 viewport'un hiçbirinde kırpma yok**, yatay belge
  kaydırması da yok (`scrollWidth == innerWidth` her yerde).
- Başlık 320px'te `truncate` ile 113 px'e iniyor (`MISSION …`), sekmelerle genişlik yarışmıyor.
- **Mutasyon (D47):** `App.tsx` yalnızca **düzen** açısından düzeltme-öncesi hâline döndürüldü
  (roving tabindex/`focusTab` KORUNARAK) → `npx playwright test -g "T3"` **KIRMIZI**:
  `clippedVisibleWidth('#tab-timeline')` → `Received: 0`. Çit gerçekten ölçüyor.
- **Tailwind üretimi doğrulandı** (F-003 dersi): `order-1/2/3`, `sm:order-none`, `flex-wrap`,
  `gap-y-2`, `sm:flex-nowrap`, `sm:h-14`, `sm:w-auto`, `flex-none`, `truncate` sınıflarının hepsi
  `dist/web/assets/index-BtoxddyP.css` içinde üretiliyor (`emptyOutDir` de çalışıyor: mutasyonlu
  koşudan kalan `index-DRH4O7py.css` yeniden derlemede silindi).

Ekran görüntüleri: `docs/qa/screens/F-007-fix1-qa-320px.png`,
`docs/qa/screens/F-007-fix1-qa-375px.png`, `docs/qa/screens/F-007-fix1-qa-kanban-1280.png`,
`docs/qa/screens/F-007-fix1-qa-timeline-1280.png`, `docs/qa/screens/F-007-fix1-qa-timeline-375px.png`.

---

## 5. Echo kırılganlık ölçümü (M4 — 12 koşu + 8 kontrol koşusu)

Mutasyon: `src/features/kanban/web/useFeatures.ts:56` hash-eşit dalı `return prevCard` yerine
`return { ...prevCard }` (önceki turdaki kendi dar mutasyonumun birebir aynısı).

| Koşu | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mutasyonlu (`npx vitest run tests/features/kanban/web/useFeatures.test.ts`) | K | K | K | K | K | K | K | K | K | K | K | K |

**12/12 KIRMIZI** (K), her koşu ayrı `vitest run` süreci. Kırılan test her seferinde aynı:
`useFeatures — echo no-op … > aynı content_hash ile gelen refetch aynı kart REFERANSINI korur`,
`AssertionError: … // Object.is equality`.

Kontrol (doğru kod, 8 ardışık koşu): **8/8 YEŞİL** (`11 passed (11)`) — çit yanlış-kırmızı da
vermiyor. Önceki turdaki **%73 yanlış-yeşil oranı sıfırlandı.** Developer'ın "5/5" iddiası
doğrulandı ve 12'ye genişletildi. Kök neden gerçekten kapanmış: senkronizasyon sinyali artık
`fetchImpl` çağrı sayısı değil, `setCards` ile aynı React commit'inde yazılan `lastSyncedAt`
(`useFeatures.ts:94`, test `useFeatures.test.ts:81`).

---

## 6. Kendi mutasyon tablom (8 mutasyon — hepsi uygulandı, ölçüldü, `git checkout --` ile geri alındı)

| # | Mutasyon | Dosya:satır | Koşturulan | Sonuç |
|---|---|---|---|---|
| Q1 | Düzeltme-öncesi `handlers.ts` tamamen geri yüklendi (B1 + N1 birlikte) | `handlers.ts` | `features-api.test.ts` | **KIRMIZI** (2 test; B1 testi **5023 ms zaman aşımı**) |
| Q2 | Yalnızca iç `try/catch` (yarı-başarı dalı) kaldırıldı, dış ağ korundu | `handlers.ts:134-160` | `features-api.test.ts` | **KIRMIZI** (`expected 200, got 500`) |
| Q3 | İstemci yarı-başarı dalı devre dışı (`if (false && …)`) | `useFeatures.ts:188` | `useFeatures.test.ts` | **KIRMIZI** (`outcome.kind` `success` değil) |
| Q4 | `onKeyDown={onTabKeyDown}` tamamen silindi (M9 tekrarı) | `App.tsx:87` | `App.interaction.test.tsx` + `App.test.tsx` | **KIRMIZI** (önceki turda 728/728+23/23 YEŞİL'di) |
| Q5 | İki sekme de `aria-controls="panel-timeline"` (M6b tekrarı) | `App.tsx:83` | `App.test.tsx` | **KIRMIZI** (önceki turda 728/728 YEŞİL'di) |
| Q6 | `focusTab()` gövdesi no-op (`void screen`) | `App.tsx:52` | `App.interaction.test.tsx` | **KIRMIZI** (`document.activeElement` taşınmadı) |
| Q7 | `App.tsx` düzeni düzeltme-öncesine döndürüldü, `focusTab` KORUNDU (B2 izolasyonu) | `App.tsx:69-96` | `npx playwright test -g "T3"` | **KIRMIZI** (`Received: 0`) |
| Q8 | `mergeCards` hash-eşit dalı `{ ...prevCard }` (M4 tekrarı) | `useFeatures.ts:56` | `useFeatures.test.ts` ×12 | **12/12 KIRMIZI** (önceki turda 11 koşuda 8 YEŞİL'di) |

**Yeşil kalan mutasyon sayısı: 0.** Önceki turda yeşil kalan dört mutasyonun (M4, M6b, M9 ve
klavye/odak yolu) **tamamı** artık çitli.

---

## 7. Regresyon denetimi (düzeltmenin ürettiği yan etki var mı?)

| Kontrol | Ölçüm | Sonuç |
|---|---|---|
| Geniş ekranda (≥640px) düzen değişti mi | 640/768/1024/1280/1920'de header **56 px** (= `h-14`), tek satır, başlık `x=16 y=14`, sekmeler `y=18`, Ayarlar `x=1185` | **Değişmedi** |
| Zaman çizelgesi ekranı | 1280 ve 375'te render doğru (CANLI rozeti, `0 olay/dk`, Duraklat, filtre şeridi, boş-durum metni); ekran görüntüleri ekli | **Sağlam** |
| Kanban panosu 1280 | 8 sütun, başlıklar `Yapılacak (todo)` biçiminde, kartlar diskteki duruma göre doğru sütunda (F-901→contract, F-902→fix) | **Sağlam** |
| Tarayıcı konsolu | `browser_console_messages` → **0 hata, 0 uyarı** | **Temiz** |
| Tailwind derleme çıktısı | Yeni düzen sınıflarının hepsi `dist` CSS'te; `tests/build-css.test.ts` 17/17 yeşil | **Sağlam** |
| Birim + E2E paketi | 732/732, 23/23, 1/1 (mutasyonlar geri alındıktan sonra tekrar koşuldu) | **Yeşil** |
| `shell.spec.ts` / `settings.spec.ts` | `npm run e2e` içinde yeşil | **Regresyon yok** |

---

## 8. Bulgular (0 bloklayıcı · 0 önemli · 5 not)

**N-1 — 403 `write_denied` metni anlamsal olarak yanıltıcı (sözleşmece onaylı).**
`handlers.ts:184` artık `'Dosya biçimi tanınamadı. Tekrar deneyin.'` dönüyor; bu, kök dışına
symlink'lenmiş bir dosya gibi bir **güvenlik reddini** "dosya biçimi" sorunu gibi anlatıyor.
Sözleşme §4.3 Karar 2 (`docs/qa/F-007-contract.md:500`) bu birleştirmeyi açıkça onaylamış, bu
yüzden **ihlal değil**. Küçük tutarsızlık: sözleşme satırı metni cümle içinde küçük harfle
(`… kaydedilemedi: dosya biçimi tanınamadı…`) yazıyor, uygulama `KanbanScreen.tsx:172`'de
`F-901 kaydedilemedi: Dosya biçimi tanınamadı. Tekrar deneyin.` üretiyor (cümle ortasında büyük
harf). Kozmetik.

**N-2 — Yarı-başarıdan sonra istemcinin `content_hash`'i bayat kalıyor; kurtarma chokidar
echo'suna bağlı.** Ölçüldü ve **çalışıyor** (fault açıkken ikinci taşıma başarılı oldu). Ancak
SSE bağlantısı kopmuşken yarı-başarı yaşanırsa, kullanıcının bir sonraki sürüklemesi hiçbir dış
değişiklik olmadığı hâlde 409 "dosya dışarıdan değişti" banner'ı görür. Bu birleşik durumun
(yarı-başarı + kopuk akış) çiti yok. Tek kullanıcılı yerel araçta kabul edilebilir; kayıt.

**N-3 — Echo çitinin senkronizasyon sinyali `lastSyncedAt = Date.now()` (ms çözünürlüğü).**
İki refetch aynı milisaniyeye düşerse `expect(lastSyncedAt).not.toBe(firstSyncedAt)` hiç
sağlanmaz ve test **zaman aşımıyla KIRMIZI** olur. Yön güvenli (yanlış-yeşil değil,
yanlış-kırmızı) ve 8/8 kontrol koşusunda hiç görülmedi; kayıt olarak duruyor.

**N-4 — vitest worker fork kararsızlığı bu turda tekrar görüldü (projede 4. kez).**
`npm run verify` ilk koşusunda `tests/integration/projects-api.test.ts` çalışırken worker
`exit code 3221226505` ile düştü (47/48 dosya, 722/732 test). Hemen tekrar koşulduğunda ve
turun sonunda tekrar koşulduğunda 0 / 48 / 732. Kod hatası değil, ama G4-1 öncesi CI güvenilirliği
için kayda değer: 3 tam koşunun **1'i** kararsızdı.

**N-5 — CEO ödevleri hâlâ açık (önceki turdan devir, developer sahipliği dışında).**
`grep -rn "lastTabScreen" tests/` = **0** (Ö5, sözleşmenin söz verdiği "Ayarlar açıkken tablist"
testi yazılmamış — davranış doğru, çit yok); `docs/03-ux.md:443` klavye akışı hâlâ
`Enter`/`Boşluk` ile başlatmayı anlatıyor (uygulama yalnızca `Space` ile başlatıyor);
`grep -c "sunucuya ulaşılamadı" docs/03-ux.md` = **0** (§4.3'ün yeni metinleri UX sözlüğüne
işlenmemiş); sözleşme:629'daki `#panel-settings` cümlesi hâlâ bayat. G4-1 öncesi kapanmalı.

---

## 9. Puanların gerekçesi

- **İşlevsellik 9 (önce 7):** B1'in dört maddesi de ölçülerek kapandı — yanıt geliyor (40 ms),
  süreç yaşıyor, yarı-başarı dürüst raporlanıyor, `pendingKeys` temizleniyor, üstelik echo ile
  kendiliğinden toparlanıyor. Ö1 hem jsdom'da hem gerçek tarayıcıda doğrulandı. Kırılan tek bir
  işlevsel yol bulamadım. 10 değil, çünkü yarı-başarının kurtarması dış bir mekanizmaya (SSE
  echo) bağlı ve o birleşimin çiti yok (N-2).
- **Özellik bütünlüğü 8 (önce 6):** T3 artık gerçekten sağlanıyor (280-1920px'te ölçüldü),
  T1'in klavye/odak yarısı gerçek çitlere kavuştu, `aria-controls` iki yönlü ölçülüyor. 10
  değil: Ö5'in söz verilen testi hâlâ yok (CEO ödevi) ve T6 F-008'e devredilmiş durumda.
- **Görsel/UX 8 (önce 6):** UX'in birincil aralığında (320-480px) gezinme tam görünür, yatay
  belge kaydırması yok, geniş ekran görünümü bitişik piksel düzeyinde değişmemiş, konsol temiz.
  10 değil: 403 metninin anlamı yanıltıcı (N-1) ve dar genişlikte başlık `MISSION …`'a düşüyor
  (kabul edilebilir tercih, ama marka görünürlüğü azalıyor).
- **Kod kalitesi 8 (önce 6):** 8 mutasyonun **8'i** kırmızı, yeşil kalan yok; hata yolu artık
  gerçek HTTP üzerinden fault-injection ile çitli; echo çiti 12/12 determinist. 10 değil:
  worker fork kararsızlığı (N-4) ve `Date.now()` tabanlı senkronizasyon sinyali (N-3) kalan
  kırılganlıklar.

---

## 10. Temizlik kanıtı

- **`git diff HEAD` → boş** (8 mutasyonun hepsi `git checkout --` ile geri alındı; her mutasyondan
  sonra ayrıca doğrulandı). `git status --porcelain` yalnızca bu raporun **5 untracked ekran
  görüntüsünü** gösteriyor.
- Geçici fault enjeksiyonu `handlers.ts`'ten kaldırıldı (`git checkout --` sonrası
  `grep MC_QA_FAULT src/` = 0). Geçici probe/test dosyası eklenmedi.
- Geçici fixture dizini (`…/scratchpad/qa007fix`, iki `.md` kart + izole `MC_DATA_DIR`)
  `fs.rmSync` ile silindi; **gerçek proje klasörlerine hiç yazılmadı** (`data/`, `docs/features/`
  dokunulmadı — tek istisna bu raporun kendisi ve `docs/qa/screens/`).
- `dist/` mutasyonlu koşudan kalan artık CSS ile bırakılmadı: temiz kaynaktan `npm run build`
  yeniden koşuldu, `dist/web/assets/` yalnızca 7 beklenen dosya içeriyor.
- **Süreç/port:** `tasklist /FI "IMAGENAME eq node.exe"` → 2 süreç, ikisi de Playwright MCP
  sunucusu (komut satırı doğrulandı: `@playwright/mcp`), uygulama süreci değil.
  `netstat -ano` → **7333/7334/7335/7433/7434 üzerinde LISTENING yok.** Fault sunucusu (pid 18340)
  ve temiz sunucu (pid 37364) `taskkill /T /F` ile ağaçlarıyla birlikte kapatıldı.

## 11. G4-1 öncesi kapanması istenenler (bloklayıcı değil, CEO ödevi)

1. Ö5 — `lastTabScreen` (Ayarlar açıkken tablist durumu) testi yazılsın; sözleşme:629'daki
   `#panel-settings` cümlesi gerçeğe göre düzeltilsin.
2. N3 — `docs/03-ux.md:443` klavye akışı gerçek tuş tasarımına (`Space` ile başlat) güncellensin;
   §4.3'ün iki yeni hata metni UX Türkçe sözlüğüne eklensin.
3. N-4 — vitest worker fork kararsızlığı için bir karar (yeniden deneme politikası veya
   `isolate`/pool ayarı) alınsın; şu an 3 koşunun 1'i kararsız.
