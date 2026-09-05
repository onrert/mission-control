# F-003 QA raporu — düzeltme turu 1 doğrulaması (qa-evaluator, 2026-09-05)

KARAR: GEÇTİ
ESKALE: false

Feature: F-003 — SSE akışı + canlı zaman çizelgesi ekranı + filtreler
İncelenen commit: `084b5e5` (düzeltme turu: `1b4ff8f`, `7f5a711`, `325b0a9`, `cb0b096`, `084b5e5`)
Önceki tur: `docs/qa/F-003-2026-09-05.md` (KALDI — B1, B2, Ö1-Ö4)
Kapsam: **dar doğrulama turu** — yalnızca B1/B2/Ö1/Ö2/Ö3/Ö4 + M4/M5/M6 kapanışı ve düzeltmenin
ürettiği regresyon. Önceki turda onaylanan bölümler (kapsam denetimi, güvenlik taraması,
`role="tab"`, CI job'ı, `MC_DATA_DIR` izolasyonu, 3 zayıf testin düzeltmesi) yeniden açılmadı.

## Puanlar

| Boyut | Önceki | Şimdi | Gerekçe |
|---|---|---|---|
| İşlevsellik | 6 | **8** | Kaydırma ile oto-dondurma artık **üretimde gerçekten çalışıyor** — kendi tarayıcımda ölçtüm: `scrollHeight 1590 > clientHeight 508`, `mouse.wheel` sonrası `scrollTop 500`, olay listeye girmedi, "7 yeni olay ↑ En üste git" rozeti çıktı, rozete tıklayınca `scrollTop 0` + olay göründü. AC1-AC6 altı kriterin altısı da bağımsız kanıtlı. |
| Özellik bütünlüğü | 5 | **8** | AC5'in **iki yolu da** kanıtlandı: geçici kopma → "Yeniden bağlanıyor" (gerçek süreç kill/restart) ve kalıcı başarısızlık → "Bağlantı koptu" + bir daha denememe (gerçek Chromium ağ katmanında 403). AC6'nın kaydırma yarısı gerçek `mouse.wheel`/`scrollTop` ile E2E'de. Feature notu AC5/AC6 metinleri kanıtla uyumlu hâle getirilmiş. |
| Görsel/UX | 2 | **8** | Üretim CSS'i 8.5 kB → **14.9 kB**; önceki turda 0/9 olan `features/**` sınıflarının **9/9'u** üretiliyor. `sr-only` bölge gerçekten gizli (`1×1 px`, `clip-path: inset(50%)`), `overflow-y: auto` hesaplanıyor. Çipler/sütunlar/aralıklar UX doc ekran-1 düzeninde. Düşülen 2 puan: NOT-D (satırda tarih yok) ve mobil genişlikte üst çubuğun yatay kaydırmaya düşmesi. |
| Kod kalitesi | 5 | **8** | 326 test / 27 dosya. **Altı mutasyonumun altısı da KIRMIZI** — geçen turda tam yeşil kalan M5 ve M6 dahil, kısmi kalan M4 dahil. Stil çiti gerçek `vite build` çıktısını denetliyor (kaynak metnini değil). Düşülen 2 puan: NOT-A (çit 69 sınıftan 5'ini örnekliyor) ve NOT-B (çit vitest içinde ikinci bir tam build koşturuyor). |

Dört boyutun dördü de ≥ 7, açık BLOKLAYICI/ÖNEMLİ yok → **GEÇTİ**.

## 1. Komutlar ve gerçek çıktılar (hepsini kendim koşturdum)

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` (mutasyon öncesi) | **0** | `Test Files 27 passed (27)` / `Tests 326 passed (326)` / `vite build ✓ built in 1.00s` |
| `npm run e2e` | **0** | `9 passed (15.6s)` — 9/9 test adı çıktıda listelendi |
| `npm run e2e:dev` | **0** | `1 passed (4.8s)` |
| `npm run verify` (tüm mutasyonlar geri alındıktan sonra) | **0** | `Test Files 27 passed (27)` / `Tests 326 passed (326)` / `✓ built in 1.03s` |
| `npm run e2e` (kapanış) | **0** | `9 passed (15.7s)` |
| `npm run e2e:dev` (kapanış) | **0** | `1 passed (4.4s)` |

CEO'nun bildirdiği 27 dosya / 326 test / 9 e2e sayıları **doğrulandı**. `verify` çıktısındaki
`EISDIR ... 503` satırları önceki turda olduğu gibi kasıtlı fault-injection'dan geliyor.
Üretim CSS'i `dist/web/assets/index-QUhkDr8K.css` **14.92 kB** (önceki tur: 8545 bayt) —
JS paketi 211.33 kB, önceki turla aynı sınıfta; stil düzeltmesi JS'i büyütmedi.

## 2. Bulgu kapanış tablosu

| # | Bulgu | Durum | Kanıt |
|---|---|---|---|
| **B1** | `features/**` Tailwind sınıfları üretilmiyor | **KAPANDI** | `src/web/index.css:8` `@source "../features/events/web";` · üretilen CSS'te `sr-only`/`gap-3`/`overflow-y-auto`/`rounded-full`/`text-amber-300`/`min-h-8`/`animate-pulse`/`bg-amber-950`/`px-3` = **9/9 VAR** (önceki tur 0/9) · canlı: `getComputedStyle(list).overflowY === "auto"`, `sr-only` bölge `1×1 px`, `clip-path: inset(50%)` · regresyon çiti `tests/build-css.test.ts` |
| **B2** | Kaydırma ile oto-dondurma üretimde çalışmıyor + sıfır test | **KAPANDI** | Canlı ölçüm (1280×800, 43 satır): `scrollHeight 1590 / clientHeight 508`, wheel → `scrollTop 500`, POST edilen olay `probeVisible 0`, rozet `"5 yeni olay ↑ En üste git"`, rozete tıklama → `scrollTop 0`, `probeVisible 1`, rozet kayboldu · E2E `tests/e2e/timeline.spec.ts:170-231` gerçek `page.mouse.wheel(0,400)` + `el.scrollTop` + `expect(scrollHeight).toBeGreaterThan(clientHeight)` |
| **Ö1** | `since_seq` çiti totoloji (URL literal) | **KAPANDI** | `src/web/lib/useEventStream.ts:24-26` `export function buildInitialLoadUrl` · `tests/integration/events-api.test.ts:493-494` URL'i **istemciden türetiyor** (`buildInitialLoadUrl('/api/events')`), literal değil |
| **Ö2** | AC5 rozet assert'i ters + yanlış "CEO/QA'ya bildirildi" yorumu | **KAPANDI** | Yorum silinmiş: `grep -rn "bildirildi" src/ tests/` → **0 eşleşme** · yeni `tests/e2e/timeline.spec.ts:429-448` kalıcı yolu (`page.route` ile 403 → "Bağlantı koptu" + `streamRequestCount === 1`) ölçüyor · feature notu `docs/features/F-003-sse-zaman-cizelgesi.md:26-38` iki yolu ayrı ayrı yazıyor ve doğru testleri kanıt gösteriyor |
| **Ö3** | `/api/stream` Host çitinin testi yok | **KAPANDI** | `tests/integration/sse-stream.test.ts:229-233` ham `node:http` soketiyle `Host: evil.com` → 403 `forbidden_origin`; `:235-239` pozitif regresyon testi |
| **Ö4** | AC5 E2E'si `Last-Event-ID` telafisini ölçmüyor | **KAPANDI** | `tests/e2e/timeline.spec.ts:388-399` kesinti **sırasında** aynı `MC_DATA_DIR`'e yazan geçici (`createServer(0, tempDir)`) sunucuyla gerçek bir olay üretiliyor; yeniden başlatmadan sonra o olayın satırı assert ediliyor. Bu olay istemcinin belleğinde YOK — yalnızca sunucu telafisiyle gelebilir (mutasyon E kanıtı) |
| **M4** | `since_seq` mutasyonu kısmi yeşildi | **KAPANDI** | Mutasyon D → `AssertionError: expected 400 to be 200`, `verify` içindeki entegrasyon testi artık KIRMIZI |
| **M5** | Kaydırma mutasyonu tam yeşildi | **KAPANDI** | Mutasyon B → E2E KIRMIZI |
| **M6** | `/api/stream` Host mutasyonu tam yeşildi | **KAPANDI** | Mutasyon C → entegrasyon testi KIRMIZI |

Ayrıca önceki turun **NOT-1**'i (aria-live testi yok) da kapandı:
`tests/features/events/web/TimelineScreen.test.tsx:259-275` — tek `aria-live="polite"` bölge +
`sr-only` sınıfı + 4 durumun metin eşlemesi.

## 3. Kendi mutasyon turum (6/6 KIRMIZI)

| # | Mutasyon | Dosya:satır | Kırmızı veren test | Hata mesajının ilk satırı | Geri alındı |
|---|---|---|---|---|---|
| A | `@source "../features/events/web";` satırı silindi (B1 düzeltmesinin iptali) | `src/web/index.css:8` | `tests/build-css.test.ts` — **5/5 test** | `AssertionError: expected '/*! tailwindcss v4.3.3 | MIT License …' to contain 'text-amber-300'` | Evet |
| B | `stream.setScrolledAway(el.scrollTop > 0)` → `setScrolledAway(false)` (özelliğin tam iptali) | `src/features/events/web/TimelineScreen.tsx:114` | `timeline.spec.ts:170` AC6 (kaydırma) | `Error: expect(locator).toHaveCount(expected) failed … Expected: 0 Received: 1` | Evet |
| C | `/api/stream` Host kontrolünden muaf tutuldu | `src/server/index.ts:237` | `sse-stream.test.ts` D13 | `FAIL … D13: yabancı Host başlığıyla GET /api/stream 403 forbidden_origin döner` (13 passed / 1 failed) | Evet |
| D | `buildInitialLoadUrl`'a `since_seq=-1` geri kondu | `src/web/lib/useEventStream.ts:25` | `events-api.test.ts` CEO çiti | `AssertionError: expected 400 to be 200 // Object.is equality` | Evet |
| E | `Last-Event-ID` replay dalı devre dışı (`false &&`) | `src/server/sse/stream.ts:84` | `timeline.spec.ts:327` AC5 | `Error: expect(locator).toBeVisible() failed … hasText: 'ac5-during-outage-…' … element(s) not found` | Evet |
| F | `readyState === CLOSED → 'disconnected'` dalı tamamen silindi | `src/web/lib/useEventStream.ts:159` | `timeline.spec.ts:429` AC5 (kalıcı hata) | `Expected substring: "Bağlantı koptu" / Received string: "Yeniden bağlanıyor"` | Evet |

Mutasyonlar önceden alınan yedeklerden birebir geri alındı; her geri alma sonrası
`git diff --stat` boş doğrulandı. Önceki turda **tam yeşil** kalan M5 (=B) ve M6 (=C) ile
**kısmi** kalan M4 (=D) artık kırmızı veriyor. Kendi mutasyonlarımda **yeşil kalan yok.**

Ek gözlem (A mutasyonu): çitin "eski dist'ten kalan CSS'i okuyup tesadüfen yeşil kalma"
totolojisi **yok** — mutasyonlu koşuda `dist/web/assets` içinde tek dosya vardı ve içeriği
yalnızca `App.tsx` sınıflarını taşıyordu (`vite.config.ts:12` `emptyOutDir: true` gerçekten
çalışıyor).

## 4. Stil çiti denetimi

`tests/build-css.test.ts:42-48` beş sınıf denetliyor. Her birinin **yalnızca**
`src/features/events/web/**`'de geçtiğini kendim doğruladım
(`grep -rn <sınıf> src/web/` → **hepsi 0 eşleşme**):

| Sınıf | `src/web/**` (Vite kökü) | `src/features/events/web/**` | Tesadüfi yeşil riski |
|---|---|---|---|
| `sr-only` | 0 eşleşme | `TimelineScreen.tsx` | Yok |
| `gap-3` | 0 eşleşme | `ScreenErrorBoundary.tsx`, `TimelineRow.tsx`, `TimelineScreen.tsx` | Yok — `src/web`'de `gap-3*` ön ekli hiçbir sınıf yok (`gap-4`/`gap-6` var, alt dize eşleşmesi olmaz) |
| `overflow-y-auto` | 0 eşleşme | `EventDetailPanel.tsx`, `TimelineScreen.tsx` | Yok — `src/web`'de yalnızca `overflow-x-auto` var |
| `rounded-full` | 0 eşleşme | `FilterChips.tsx`, `TimelineScreen.tsx` | Yok |
| `text-amber-300` | 0 eşleşme | `FilterChips.tsx`, `projectColor.ts`, `TimelineRow.tsx`, `TimelineScreen.tsx` | Yok — `src/web` `text-amber-400` kullanıyor; tema değişkeni `--color-amber-300` farklı dize |

Önceki turda çiti tesadüfen yeşil bırakan `bg-zinc-950` (hem `App.tsx` hem
`TimelineScreen.tsx`'te geçiyordu) **listede yok** — doğru seçim. Sınıf örneklemesi geçerli.

Sınırı: `src/features/events/web/**` 83 farklı sınıf kullanıyor, bunların **69'u** `src/web`'de
hiç geçmiyor; çit bu 69'un 5'ini örnekliyor. Yani çit **dizin seviyesinde** bir kanaryadır
(gerçekleşen arıza modu buydu), tek bir sınıfın düşmesini yakalamaz. Bkz. NOT-A.

## 5. Görsel teyit (gerçek sunucu + gerçek tarayıcı)

`npm run build` + `npm start` (7333, gerçek `data/`), kendi POST'larım ve F-004 hook'unun canlı
olaylarıyla. Ekran görüntüleri:

- `docs/qa/screens/F-003-fix1-qa-2026-09-05.png` (1280×800, normal durum)
- `docs/qa/screens/F-003-fix1-qa-kaydirma-dondurma-2026-09-05.png` (dondurulmuş durum + rozet)
- `docs/qa/screens/F-003-fix1-qa-mobil-2026-09-05.png` (390×780)

Gözlem:
- Üst çubuk: `MISSION CONTROL` marka adı **kaynakta literal büyük harf** (CSS `uppercase` yok),
  Türkçe locale bozulması yok. `Zaman Çizelgesi` vurgulu, `Kanban`/`Ayarlar` sönük.
- `CANLI` göstergesi, `18 olay/dk` sayacı ve **çerçeveli/dolgulu "Duraklat" butonu** ayrı ayrı,
  aralarında boşlukla. Önceki turdaki `12 olay/dkDuraklat` bitişikliği gitmiş.
- Filtre çipleri yuvarlak, çerçeveli, aralıklı; `Proje: / Agent: / Tip:` etiketleri ayrı satırda;
  "Filtreleri temizle" bağlantısı ortada.
- Satır düzeni sütunlu: saat · renkli proje çipi · agent · araç · özet. Proje başına renk
  ayrımı çalışıyor. Grup başlıkları ("qa-evaluator → 12 araç çağrısı (…)") açılır üçgenle.
- `sr-only` canlı bölge **ekranda görünmüyor** (önceki turda sol üstte "Bağlı" yazıyordu);
  DOM'da metni doğru (`"Bağlı"`).
- Sağda gerçek kaydırma çubuğu var — kap kaydırılabilir.
- Türkçe sözlük UX doc'la uyumlu: "Duraklat", "Devam et", "N yeni olay ↑ En üste git",
  "Filtreleri temizle", "Bağlı"/"Yeniden bağlanıyor"/"Bağlantı koptu".
- 390 px'te çipler sarıyor, üst çubuk yatay kaydırmaya düşüyor, satırlar kırpılıyor —
  okunabilir, bozulma yok (PRD'de mobil hedefi yok).

Not: ekran görüntüsündeki `— unknown —` satırları **benim** bozuk JSON gönderen curl
denememden geldi (kabuk `\d` kaçışını bozdu); sunucu bunları F-002 tasarımı gereği
`flags: ["parse_error"]`, `hook_event_name: "unknown"` olarak kaydetti. Ürün kusuru değil.

## 6. Regresyon taraması

| Kontrol | Sonuç |
|---|---|
| `npm run verify` | 0 — 27/27 dosya, 326/326 test |
| `npm run e2e` / `e2e:dev` | 0 / 0 — 9 + 1 |
| Mevcut renk assert'leri (`shell.spec.ts` tema testi) | Geçiyor — stil düzeltmesi bozmadı |
| Paket boyutu | CSS 8.5 → 14.9 kB (beklenen artış, eksik sınıfların üretilmesi); JS 211.33 kB değişmedi |
| `src/features/events/server/query.ts` | Düzeltme diff'inde **yok** — sunucu tarafı filtreleme sızmadı |
| Düzeltme kapsamı | `git diff cc33199..HEAD` → 15 dosya; ürün kodunda yalnızca `src/web/index.css` (+7) ve `src/web/lib/useEventStream.ts` (+21/-7). Gerisi test + doküman + ekran görüntüsü. Kapsam dışı ürün değişikliği **yok**. |
| Mutasyon artığı | `git diff HEAD` boş; `grep -rn "mutasyon\|TODO\|FIXME\|HACK" src/` yalnızca açıklayıcı yorumlar |

## 7. NOT'lar (GEÇTİ'yi engellemez)

- **NOT-A (yeni):** `tests/build-css.test.ts` `features/**`'te kullanılan 69 özgün sınıfın
  yalnızca 5'ini örnekliyor. Dizin seviyesindeki arızayı (gerçekleşen kusur) yakalar; tek bir
  sınıfın düşmesini yakalamaz. Yeni bir `src/features/<x>/web/` dizini eklendiğinde `@source`
  satırı **ve** bu çit elle güncellenmeli — aksi hâlde aynı hata bir sonraki ekranda sessizce
  tekrarlanır. İleride: sınıf listesi yerine kaynaktaki `className` dizelerinden türetilen
  otomatik bir çit.
- **NOT-B (yeni):** `tests/build-css.test.ts` `beforeAll` içinde `execFileSync` ile **tam bir
  `vite build`** koşturuyor (60 sn timeout). `npm run verify` böylece iki kez build ediyor
  (`test` içinde + `build` adımında). Şu an ucuz (~1 sn) ama `dist/web`'i paylaşan başka bir
  komut aynı anda koşarsa yarış riski var; `emptyOutDir: true` bu dizini siliyor.
- **NOT-C (devam, önceki turdan):** NOT-2 (vitest worker çökmesi `0xC0000409`) ve NOT-3
  (`npm run e2e` sessiz `exit 127`) bu turda **hiç tekrarlanmadı** (6 tam koşu). Kapatılmadı,
  flaky risk olarak açık kalıyor.
- **NOT-D (devam, önceki turdan):** Satırda yalnızca saat gösteriliyor, tarih yok. Canlıda
  dünkü `08:23` olayları bugünküyle aynı biçimde görünüyor. UX doc bunu açıkça istemiyor.
- **NOT-E (yeni, düşük):** AC5 E2E'si "kesinti sırasındaki olay geldi" diyor; bu, telafinin
  `Last-Event-ID` **replay** yoluyla mı yoksa `resync` → tam yeniden yükleme yoluyla mı geldiğini
  ayırt etmiyor (ikisi de kayıpsızdır). Mutasyon E replay dalını kapatınca test kırmızı verdiği
  için çit gerçek; yapısal ayrım entegrasyon katmanında (`sse-stream.test.ts`) zaten var.

## 8. Çalışma ağacı, süreç ve port kanıtı

```
git diff HEAD --stat   -> (bos)
git status --porcelain -> ?? docs/qa/screens/F-003-fix1-qa-2026-09-05.png
                          ?? docs/qa/screens/F-003-fix1-qa-kaydirma-dondurma-2026-09-05.png
                          ?? docs/qa/screens/F-003-fix1-qa-mobil-2026-09-05.png
```

Ürün kodunda **kalıcı hiçbir değişiklik yok**; yalnızca bu raporun ekran görüntüsü kanıtları
ve rapor dosyaları eklendi. Commit atılmadı, `git push` çalıştırılmadı, `install-hook`
çalıştırılmadı.

Süreç ve port:
- Taban çizgisi (tur başı): 2 `node.exe` (PID **11152**, **9472** — Claude/MCP), hiçbir port LISTENING.
- Görsel teyit sunucusu (`npm start`, PID 20172, 7333) `taskkill /F /T` ile kapatıldı: `SUCCESS`.
- Kapanış: `tasklist` → yine tam olarak aynı 2 `node.exe` (11152, 9472);
  `netstat` → **7333/7334/7335/7433/7434 hiçbirinde LISTENING yok**.
- **Yetim süreç bırakılmadı.**
