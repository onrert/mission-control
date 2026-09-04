KARAR: KALDI
ESKALE: false

# F-002 QA — kod turu (qa-evaluator, 2026-09-04)

Feature: `docs/features/F-002-olay-alma-jsonl-depo.md` · Sözleşme: `docs/qa/F-002-contract.md`
(bağlayıcı hâli = **CEO kararı R-1**, port bileşeni yok sayılır) · ADR-008 (+ eki).
Değerlendirilen commit'ler: `d6d68d7`, `7110403`, `fe02fe6`, `9018c5a`, `d15e29f`.

**Karar gerekçesi (tek cümle):** 8 kabul kriterinin tamamı mutlu yolda çalışıyor ve kanıtları
gerçek, ama ana yazma yolunda hiç hata yakalama yok — tek bir disk yazma hatası sunucuyu
öldürüyor, istemciye hiç yanıt dönmüyor ve yazma kuyruğu kalıcı olarak zehirleniyor; ayrıca
`.seq` yazar/okur semantiği tutarsız olduğu için her olaysız yeniden başlatmada `seq` bir
kayıyor (gerçek `data/events/.seq` şu an **9**, hiç olay kaydedilmemişken).

---

## 1. Çalıştırdığım komutlar ve gerçek çıktıları

| Komut | Çıkış kodu | Çıktı |
|---|---|---|
| `npm run verify` | **0** | `Test Files 12 passed (12)` · `Tests 133 passed (133)` · `vite build ✓ built in 916ms` — developer'ın 133 test/12 dosya bildirimi **teyit edildi** |
| `npm run e2e` | **0** | `1 passed (4.5s)` — `shell.spec.ts` |
| `npm run e2e:dev` | **0** | `1 passed (4.6s)` — `dev-shell.spec.ts` |
| `npm audit` | **0** | `found 0 vulnerabilities` |
| `npm run verify` (tüm mutasyonlar geri alındıktan sonra) | **0** | `12/12 dosya · 133/133 test · built in 915ms` |

Elle API dumanı (`curl`, çalışan `npm start`, port 7533, geçici `MC_DATA_DIR`):

```
1) Saglikli POST:   {"success":true,"data":{"id":"0-bc47a3","seq":0,"flags":[]}} [HTTP 202]
2) Eksik alanli:    {"success":true,"data":{"id":"1-9d3ef1","seq":1,"flags":["missing_fields"]}} [HTTP 202]
3) JSON olmayan:    {"success":true,"data":{"id":"2-7754cb","seq":2,"flags":["parse_error"]}} [HTTP 202]
4) Host: evil.com   {"success":false,"error":{"code":"forbidden_origin",...}} [HTTP 403]
5) Origin: evil.com {"success":false,"error":{"code":"forbidden_origin",...}} [HTTP 403]
6) GET /api/events?limit=2 → 200, seq artan, raw korunmuş
7) Diskteki JSONL satırı GET yanıtıyla birebir aynı
```

Ekran görüntüleri (F-002 yeni UI getirmiyor, regresyon kontrolü):
`docs/qa/screens/F-002-desktop-1280.png` · `docs/qa/screens/F-002-mobile-390.png` —
başlık literal **MISSION CONTROL** (Türkçe `İ` regresyonu yok), koyu tema, konsol hatası yok.

---

## 2. Kabul kriteri kanıt tablosu

| AC | Sonuç | Kanıt (dosya:satır / komut çıktısı) — kanıt gerçekten AC'yi ölçüyor mu |
|---|---|---|
| AC-1 geçerli olay → 2xx + JSONL satırı | **GEÇTİ** | `tests/integration/events-api.test.ts:91-124` — 202 + `readDayFileLines` ile **diskten** okuma (`:109-113`), ring'den değil. Elle curl 1) + 7) teyit etti. Kanıt yolu doğru (diskten). |
| AC-2 eksik/bilinmeyen alan → 5xx yok, `missing_fields` | **GEÇTİ** | `events-api.test.ts:126-135` (202 + flag) ve `:137-168` 9 patolojik gövde tablo testi (`status < 500`). Mutasyon M4 ile ölçtüğü doğrulandı (4 test kırmızı). |
| AC-3 `raw` korunur | **GEÇTİ** | `events-api.test.ts:188-207` — bilinmeyen `custom_marker` alanı hem **diskteki satırda** hem GET yanıtında; `normalize.test.ts:74,86` kırpma/koruma. Disk round-trip gerçek. |
| AC-4 yükte ≥%99 sırayla | **GEÇTİ** | `events-api.test.ts:209-225` — 500 POST, hepsi 202, **fiziksel satır sırası** `toEqual([0..499])`. Ölçtüğü M5 mutasyonuyla kanıtlandı (kırmızı). Not: istemci ajanı `maxSockets:50` (`:42`) — "500 eşzamanlı" adlandırması gerçeği tam yansıtmıyor (NOT-e). |
| AC-5 restart → ≥100 olay geri yüklenir | **GEÇTİ** | `events-api.test.ts:281-326` — aynı `dataDir`'e karşı iki `createServer` örneği, `GET ?limit=1000` ≥100, ayrıca bootstrap wiring kanıtı (`:322` yeni POST `seq === 150`). |
| AC-6 retention yalnızca panelin kendi gün dosyaları | **KISMEN** | Gün/adet budama + `isInsideDataRoot` tablo testi (`retention.test.ts:14-82`, `:98-121`, `:138-159`) gerçek ve M1 mutasyonuyla kırmızı verdi. **AMA** ikinci savunma katmanı olan dosya-adı deseni çiti hiçbir test tarafından ölçülmüyor (M8 → 133/133 yeşil, Bulgu Ö2); sözleşme §3 madde 3 bu testi açıkça vaat etmişti. |
| AC-7 eşzamanlı POST'ta satır bozulması yok | **GEÇTİ** | `events-api.test.ts:227-243` (300 POST, her satır geçerli JSON, tekrarsız seq) + `jsonl-store.test.ts:195-226` mock tabanlı kuyruk sırası testi (M5 ile ölçtüğü doğrulandı). |
| AC-8 Host/Origin → 403 | **GEÇTİ** | `health.test.ts:64-89` (R-1 tablo testi: portsuz/efemeral/`[::1]`/`evil.com`/`192.168.*`), `:186-200` yabancı `Host` → 403, `events-api.test.ts:245-278` cross-origin/Origin-yok/aynı-origin. M3 (guard **çağrısının** kaldırılması) ile wiring'in de ölçüldüğü kanıtlandı. Kod CEO kararı R-1'e birebir uyuyor (`src/server/index.ts:74-105`: port parametresi yok, `webPort` özel durumu yok). |

---

## 3. Kendi mutasyon tablom (developer'ın listesinden bağımsız)

| # | Mutasyon (dosya:satır) | Kırmızı veren test | Hata mesajının ilk satırı | Geri alındı |
|---|---|---|---|---|
| M1 | `retention.ts:27` — `path.relative` kontrolü yerine `resolvedTarget.startsWith(resolvedRoot)` (yol kaçış çiti) | `retention.test.ts` › kardeş önek tuzağı **ve** karışık ayraç | `AssertionError: expected true to be false // Object.is equality` | ✅ evet |
| M2 | `jsonl-store.ts:132` — `fileSeq` en son geçerli satır yerine **ilk** satırdan (seq dayanıklılığı) | `jsonl-store.test.ts` › `.seq dosyası JSONLden eskiyse JSONL kazanır (Math.max)` | `AssertionError: expected 1 to be 3 // Object.is equality` | ✅ evet |
| M3 | `index.ts:205` — Host/Origin guard **çağrısı** devre dışı (saf fonksiyonlar bozulmadan) | `health.test.ts` › yabancı Host → 403 **ve** `events-api.test.ts` › AC-8 cross-origin | `AssertionError: expected 200 to be 403` / `expected 202 to be 403` | ✅ evet |
| M4 | `normalize.ts:112` — `missing_fields` hiç eklenmiyor | `normalize.test.ts` × 3 + `events-api.test.ts` › AC-2 | `AssertionError: expected [] to include 'missing_fields'` | ✅ evet |
| M5 | `jsonl-store.ts:185-188` — yazma kuyruğu kaldırıldı (doğrudan `appendFile`) | `jsonl-store.test.ts` › kuyruk kanıtı **ve** `events-api.test.ts` › AC-4 | `AssertionError: expected [ 1, 3, 5, 7, 9, +0, 2, 4, 6, 8 ] to deeply equal [ +0, 1, …, 9 ]` | ✅ evet |
| M6 | `App.tsx:5` — kök kap `bg-zinc-950` → `bg-zinc-900` (N1) | `tests/e2e/shell.spec.ts:88` (`#root > div` ölçümü) | `expect(rootBgRgb).toEqual(tokenRgb)` — `- 9,11 / + 24,27` | ✅ evet |
| **M7** | `check-ports.mjs:12-14` — geçersiz/boş port varsayılana düşmek yerine `0` döndürüyor | **HİÇBİRİ** | — | ✅ evet |
| **M8** | `retention.ts:40,49` — `DAY_FILE_PATTERN` çiti hem listeden hem `safeDelete`'ten kaldırıldı | **HİÇBİRİ** (`133/133 passed`) | — | ✅ evet |

**Yeşil kalan 2 mutasyon = ölçmeyen test = bulgu** (Ö2, Ö3). M8'in gerçek sonucu ayrıca somut
olarak gösterildi: mutasyon altında `pruneByDays` çıktısı `SILINEN: [".seq","2026-01-01.jsonl"]`
— yani çit kaldırılınca depo dosyası siliniyor ve **hiçbir test bunu görmüyor**.

### Developer'ın "mutasyon 2 itirafı" denetimi → **GEÇERLİ**

Developer, yazma kuyruğunu kaldırdığında fiziksel yazma testinin yeşil kaldığını bildirmiş ve
mock tabanlı bir sıralama testi eklemişti. M5 ile kendim doğruladım:
- `jsonl-store.test.ts:179-193` (200 × ≥256 KB fiziksel test) mutasyon altında **yeşil kaldı**
  (`1 failed | 12 passed`) → developer'ın itirafı **doğru**, o test kuyruğu ölçmüyor.
- Eklediği mock tabanlı sıra testi (`:195-226`) mutasyon altında **kırmızı** verdi
  (`[1,3,5,7,9,0,2,4,6,8]` ≠ `[0..9]`) → düzeltme **gerçekten yakalıyor**, bloklayıcı değil.
- Bonus: `events-api.test.ts` AC-4 (500 POST, fiziksel satır sırası) da bu makinede kırmızı
  verdi (`[0,1,3,2,5,6,4,9,8,…]`) — yani kuyruğun iki bağımsız kanıtı var.

---

## 4. N1 / N4 doğrulaması (kâğıt üstünde değil, gerçek gözlem)

**N1 — tema testi kök bileşene kör.** KAPANDI (kısmen, F-002 kapsamı kadar).
`tests/e2e/shell.spec.ts:62-89` artık `#root > div` zeminini de canvas/piksel tekniğiyle
ölçüyor. M6 mutasyonuyla doğruladım: `App.tsx`'in kök kabını `bg-zinc-900` yapıp `body`'ye
dokunmadım → `npm run e2e` **1 failed**, `shell.spec.ts:88` `expect(rootBgRgb).toEqual(tokenRgb)`.
Geri alındı. Panel-yüzeyi yarısının F-003'e devri feature notuna ve `progress.md`'ye işlenmiş.

**N4 — dev port çakışması.** KAPANDI. Gerçek gözlem (sahte `http` dinleyici 127.0.0.1:7333'ü
tuttu, ardından `npm run dev` spawn edildi, 12 sn izlendi):

```
[2] 7333 dogrudan yanit: 200 {"ok":true,"service":"foreign-intruder","instance_id":"FAKE"}
[3] npm run dev CIKTI, exit kodu = 1
[4] 12 sn sonra surec cikti mi? EVET (kod 1)
[5] 7334 (Vite) yanit: 0 HATA: ECONNREFUSED
[6] 7334/api/health (proxy) yanit: 0 HATA: ECONNREFUSED
[7] > mission-control@0.1.0 predev
    > node scripts/check-ports.mjs
    Hata: 7333 portu/portları zaten kullanımda. 'npm run dev' başlatılamıyor.
    Önce o portu tutan süreci kapatın veya MC_PORT/MC_WEB_PORT ile farklı port seçin.
```

Yani süreç **tümüyle** öldü, Vite hiç başlamadı, yabancı sürece proxy **oluşmadı**, yetim süreç
kalmadı. Sahte dinleyici kapatıldı. Ayrıca `scripts/check-ports.mjs:30-31` portları gerçekten
**env'den** okuyor (`process.env.MC_PORT` / `MC_WEB_PORT`, literal 7333 yok) — `e2e:dev`'in
7433/7434 ile yanlış pozitif vermemesinin nedeni bu. **Ancak** varsayılana düşme davranışı
test tarafından ölçülmüyor (Bulgu Ö3).

---

## 5. Kapsam denetimi — sızıntı YOK

`grep -rn "text/event-stream|EventSource|/api/stream|resync|write.gate|send-event|rotat|52428800" src/ scripts/`
→ yalnızca `index.ts:91`'deki bir **yorum** satırı ve `types.ts:14`'teki `project_id?` (asla
doldurulmuyor, dokümante edilmiş). Somut olarak:

- SSE / `/api/stream`: **yok** (`index.ts` yalnızca 4 dal: health, GET events, POST events, 404).
- Tam filtre seti: **yok** — `query.ts:35,44` yalnızca `since_seq` + `limit` okuyor.
- Hook scripti / proje kayıt defteri / yazma kapısı: **yok**.
- Yeni UI ekranı: **yok** — `src/web/App.tsx` F-002 commit'lerinde hiç değişmemiş.
- 50 MB rotasyonu: **yazılmamış** (ADR-008 karar 2'ye uygun); koşul karşılanmış —
  `dayFileName()` tek fonksiyon (`jsonl-store.ts:18`), append/açılış/retention hepsi onu çağırıyor.

Küçük sapma: `eslint.config.js` sözleşme §2.2'nin "değişecek dosyalar" listesinde yokken
değiştirilmiş (NOT-b).

## 6. Güvenlik hızlı taraması

- `data/` gitignore'lu: `git check-ignore -v data/events/.seq` → `.gitignore:6:data/`. ✅
- Testler gerçek `data/`'ya yazmıyor: `data/events/` içinde **yalnızca `.seq`** var, hiç
  `.jsonl` yok; tüm vitest testleri `tests/helpers/temp-data-dir.ts` ile `os.tmpdir()`
  kullanıyor. Gerçek `data/`'ya yalnızca prod E2E'nin `npm start`'ı dokunuyor. Developer'ın
  iddiası **doğrulandı**. `git status` bu dizinden hiçbir şey göstermiyor. ✅
- Sabit kodlanmış sır: `grep -rnEi "(api[_-]?key|secret|password|token|bearer)\s*[:=]\s*['\"]"`
  → **boş**. ✅
- `127.0.0.1` dışı ağ literali: yalnızca `query.ts:34` `'http://internal.invalid'` (URL
  ayrıştırma taban adresi, ağ isteği değil). Ama F-001'in guard'ı bu dizini hiç taramıyor
  (Bulgu Ö4). ⚠️
- Sunucu yalnızca `127.0.0.1`'e bağlanıyor (`index.ts:248`), `0.0.0.0`/`MC_HOST` yok
  (`tests/no-external-host.test.ts:60-68` guard'ı ile). ✅

---

## 7. Bulgular

| # | Şiddet | Bulgu | Tekrar üretme / kanıt | Muhtemel dosya:satır |
|---|---|---|---|---|
| B1 | **BLOKLAYICI** | Disk yazma hatasında: (a) istemciye **hiç yanıt dönmüyor** (asılı kalıyor), (b) `unhandledRejection` → Node varsayılanıyla **süreç exit 1 ile ölüyor**, (c) hata sonrası yazma kuyruğu **kalıcı zehirleniyor** — sonraki sağlıklı istekler de aynı hatayla düşüyor. | Geçici `dataDir` ile `createServer(0, dir)`; gün dosyası adında bir **dizin** oluştur; `POST /api/events`. **Beklenen:** hata yakalanır, istemci bir yanıt alır, sonraki istekler çalışır (mimari/PRD "asla 5xx" ve sözleşme R4'ün retention için uyguladığı disiplin). **Gerçek:** `YANIT YOK (6018 ms) AbortError` · `Error: EISDIR: illegal operation on a directory, write ... at async <anonymous> (src/features/events/server/ingest.ts:57:27)` · süreç `EXIT=1` · 2. sağlıklı istek de yanıtsız. | `src/server/store/jsonl-store.ts:185,188` (`queue = queue.then(...)`, `.catch()` yok — reddedilen promise zincirde kalıcı) + `src/features/events/server/ingest.ts:54-63` (`void (async () => …)`, `try/catch` yok, yanıt yolu yok) |
| Ö1 | **ÖNEMLİ** | `.seq` yazar/okur semantiği tutarsız → **her olaysız yeniden başlatmada `seq` bir kayıyor**. `append` `.seq`'e "son atanan seq"i, `init` ise "bir sonraki seq"i yazıyor; okuma tarafı `max(...)+1` yapıyor, yani her açılış `.seq`'i bir şişiriyor. | 3 olay yaz → 4 kez olaysız yeniden başlat → sonraki olayın seq'i **7** (beklenen 3); dosyadaki dizi `[0,1,2,7]`. **Repoda şimdiden görünüyor:** `data/events/.seq` = **9** olmasına rağmen hiç `.jsonl` yok (E2E/`npm start` koşuları her seferinde bir seq yaktı). `tsx watch` her dosya kaydında yeniden başlattığı için dev'de sürekli delik açılır; F-003'ün `since_seq`/`next_seq` boşluk tespiti yanlış çalışır. **Hiçbir test yakalamıyor** — tüm restart testleri iki restart arasına olay koyuyor. | `src/server/store/jsonl-store.ts:146` (`writeSeqBestEffort(nextSeq)`) vs `:186` (`writeSeqBestEffort(seq)`) vs okuma `:145` |
| Ö2 | **ÖNEMLİ** | AC-6'nın ikinci savunma katmanı (dosya adı deseni çiti) **hiçbir test tarafından ölçülmüyor**. | Mutasyon M8: `DAY_FILE_PATTERN` filtresi `listDayFilesAscending`'den ve `safeDelete`'ten kaldırıldı → `npm run test` **133/133 yeşil**. Somut sonuç: `pruneByDays` çıktısı `SILINEN: [".seq","2026-01-01.jsonl"]` — depo dosyası siliniyor, kimse görmüyor. Sözleşme §3 madde 3 son maddesi bu testi ("ayrı, küçük bir test") açıkça vaat etmişti. | `src/server/store/retention.ts:40,49` · eksik test: `tests/server/store/retention.test.ts` |
| Ö3 | **ÖNEMLİ** | `check-ports.mjs`'in **varsayılana düşme** davranışı ölçülmüyor — N2 riski (iki port çözücünün sessizce ayrışması) açık. | Mutasyon M7: geçersiz/boş değerde `defaultPort` yerine `0` döndür → `tests/scripts/check-ports.test.ts` **4/4 yeşil** (port 0 her zaman boş olduğu için test totoloji). Etki: geçersiz `MC_PORT` yolunda N4 kilidi sessizce devre dışı kalır. | `scripts/check-ports.mjs:12-14` · zayıf test: `tests/scripts/check-ports.test.ts:60-66` |
| Ö4 | **ÖNEMLİ** | F-001'in `no-external-host` ve bind guard'ları **F-002'nin açtığı yeni üretim kökünü (`src/features/**`) ve `scripts/**` hiç taramıyor** — çit yeni koda kör. | `tests/no-external-host.test.ts:23-26` yalnızca `src/web` + `src/server` yürüyor. Somut: `src/features/events/server/query.ts:34` `'http://internal.invalid'` literali taşıyor — kapsam genişletilse guard kırmızı verirdi (literalin kendisi zararsız, ama çitin deliği yük taşıyor). | `tests/no-external-host.test.ts:23-26` |
| N-a | NOT | `LOOPBACK_HOSTNAMES` içindeki köşeli-ayraçsız `'::1'` girdisine erişilemez: `lastIndexOf(':')` `::1` için hostname'i `':'` yapar. Pratik etki yok (HTTP `Host`'ta IPv6 köşeli parantezlidir) ama beyaz liste girişi ölü. | `isAllowedHost('::1')` → `false`. | `src/server/index.ts:67,82-84` |
| N-b | NOT | `eslint.config.js` sözleşme §2.2 "değişecek dosyalar" listesinde yokken değiştirilmiş (`scripts/**/*.mjs` globals). Gerekliydi, ama sözleşme/feature notuna işlenmemiş. | `git diff 96061d4..HEAD -- eslint.config.js` | `eslint.config.js:25-32` |
| N-c | NOT | `read()` boş sonuçta `since_seq === -1` için `next_seq: 0` dönüyor; sözleşme §4.3 "hiç olay dönmediyse `since_seq` aynen geri verilir" diyor. Küçük, gerekçelendirilebilir sapma ama sözleşmede yok. | `store.read(-1, 200)` boş ring'de → `nextSeq: 0`. | `src/server/store/jsonl-store.ts:194-195` |
| N-d | NOT | AC-4 testinin adı "500 eşzamanlı POST" ama istemci ajanı `maxSockets: 50` — istekler gerçekten aynı anda uçuşta değil. Kuyruk mutasyonunda yine de kırmızı verdiği için kanıt geçerli; yalnızca adlandırma gerçeği abartıyor. | `tests/integration/events-api.test.ts:42` | `tests/integration/events-api.test.ts:42,209` |
| N-e | NOT | Retention'ın `EPERM`/`EBUSY` (R4) davranışı hiç test edilmemiş — sözleşmede "kabul edilmiş" ama `safeDelete`'in `catch` dalı ölçülmüyor. | `src/server/store/retention.ts:54-57` hiçbir test tarafından tetiklenmiyor. | `src/server/store/retention.ts:54-57` |
| N-f | NOT | **F-002'nin hatası değil:** CI hiç koşmadı (henüz push yok) — F-001'den devralınan, kullanıcı tarafından kabul edilmiş borç. Karara etki etmedi. | `docs/progress.md`, F-001 kaydı "Açık borç". | `.github/workflows/ci.yml` |

---

## 8. Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **6** | Mutlu yol kusursuz (8/8 AC, elle curl turu, 133 test, e2e ve e2e:dev yeşil), ama hata yolunda uygulama çöküyor (B1) ve `seq` dayanıklılığı gerçek repo verisinde şimdiden bozuk (Ö1, `data/events/.seq` = 9). |
| Özellik bütünlüğü | **8** | Kapsam disiplini örnek: SSE/filtre/hook/yazma kapısı/rotasyon sızıntısı yok, ADR-008 ve CEO kararı R-1 birebir uygulanmış, N1 ve N4 borçları gerçekten kapanmış. Eksik: sözleşmenin açıkça vaat ettiği desen-çiti testi yazılmamış (Ö2). |
| Görsel/UX | **7** | Yeni yüzey yok; kabuk 1280 ve 390'da doğru render ediliyor, Türkçe `İ` regresyonu yok, hata mesajları Türkçe ve anlaşılır. Puanı düşüren: API yüzeyinin hata deneyimi — yazma hatasında istemci **yanıt alamıyor**, timeout'a düşüyor (B1). |
| Kod kalitesi (test + hata yönetimi) | **5** | Testler çoğu yerde gerçekten ölçüyor (6/8 kendi mutasyonum kırmızı verdi, mock tabanlı kuyruk testi geçerli), ama: ana yazma yolunda hiç `try/catch` yok, reddedilen kuyruk promise'i kalıcı, 2 mutasyon yeşil kaldı (Ö2, Ö3) ve F-001 güvenlik guard'ı yeni kod köküne genişletilmemiş (Ö4). |

**Karar kuralı:** İşlevsellik 6 < 7 ve Kod kalitesi 5 < 7, ayrıca bir BLOKLAYICI var → **KALDI**.

### Düzeltme turu için istenen (kapsam genişletmesi değil)

1. **B1** — `append`'in kuyruğunu hataya dayanıklı yap (`.catch` ile zinciri temizle, hatayı
   yut/logla) **ve** `ingest.ts`'in async gövdesini `try/catch`'e al, hata durumunda istemciye
   bir yanıt döndür. Kanıt: mevcut fault-injection senaryosu bir teste dönüşsün (gün dosyası
   adında dizin → istek yanıt alır, süreç yaşar, ikinci istek başarılı).
2. **Ö1** — `.seq`'in tek bir semantiği olsun (ya her yerde "son atanan seq" ya da her yerde
   "bir sonraki seq"). Kanıt testi: olaysız iki init'ten sonra ilk olayın `seq`'i beklenen
   değerde kalmalı.
3. **Ö2** — desen çiti için sözleşmenin vaat ettiği testi yaz (events dizinine `notlar.txt`
   koy, retention'dan sonra durduğunu ve `.seq`'in silinmediğini assert et).
4. **Ö3** — `check-ports.test.ts`'e varsayılan çözümlemeyi **gerçekten** ölçen bir vaka ekle
   (ör. geçersiz `MC_PORT` verilirken gerçek varsayılan portu dolu tutup non-zero exit bekle).
5. **Ö4** — `tests/no-external-host.test.ts`'in `walk` kapsamına `src/features` (ve tercihen
   `scripts`) ekle; çıkan bulguları çöz.

---

## 9. Çalışma ağacı ve süreç temizliği kanıtı

```
$ git diff HEAD --stat
(bos = degisiklik yok)

$ git status --porcelain
?? .playwright-mcp/                        <- Playwright MCP aracının kendi çıktısı (QA turu)
?? docs/qa/screens/F-002-desktop-1280.png  <- bu raporun kanıtı
?? docs/qa/screens/F-002-mobile-390.png    <- bu raporun kanıtı

$ grep -rn "MUTASYON" src/ scripts/ tests/
(bos = iz yok)

$ npm run verify   -> 12/12 dosya, 133/133 test, build OK, exit 0
```

Uyguladığım **8 mutasyonun tamamı geri alındı**; `src/`, `scripts/` ve `tests/` altında tek
satır değişiklik yok. Yalnızca bu raporun kendi çıktıları (2 ekran görüntüsü) ve aracın
`.playwright-mcp/` klasörü izlenmeyen dosya olarak duruyor — `.playwright-mcp/` `.gitignore`'a
eklenmeye aday (silmedim; silme kararı kullanıcıya ait).

**Yetim süreç kontrolü:** tur sonunda çalışan `node.exe` süreçleri yalnızca PID 31048 ve 10508
— ikisi de bu QA oturumunun kendi Playwright MCP aracı (tur başındakiyle aynı PID'ler, uygulama
süreci değil). 7333/7334/7433/7434/7533 portlarının hiçbiri dinlemede değil. Arka planda
başlattığım `npm start` (7533) ve `npm run dev` denemesi kapatıldı, sahte port dinleyicisi
kapatıldı.
