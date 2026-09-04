KARAR: GEÇTİ
ESKALE: false

# F-002 QA — düzeltme turu 1 doğrulaması (qa-evaluator, 2026-09-04)

Dar doğrulama turu. Kapsam: B1 + Ö1-Ö4'ün kapanışı, düzeltmelerin ürettiği regresyon,
gün sınırı/saat dilimi sorusu. Yeniden açılmayanlar (kapsam sızması, N1/N4, AC-7, AC-4
fiziksel sıra, developer'ın mutasyon 2 düzeltmesi) ve tartışmaya kapalı olanlar
(ADR-008 iki karar, CEO kararı R-1) **incelenmedi**.

Değerlendirilen düzeltme commit'leri: `23fc2b7` · `262d57e` · `fb242b7` · `13f52ac` · `7c72858`.
Kapsam dışı (yalnızca etkisi gözlemlendi): `9ae23bf`, `8cdd6de`, `1dde768`.

**Karar gerekçesi (tek cümle):** Bloklayıcı B1 gerçekten kapandı — kendi kurduğum arıza
senaryosunda istemci her seferinde yanıt aldı (503), süreç yaşadı, kuyruk zehirlenmedi ve
engel kalkar kalkmaz sonraki istekler 202 ile diske yazıldı; Ö1-Ö4'ün dördü de artık
**ölçen** testlerle çitleniyor (kendi 7 bağımsız mutasyonumun tamamı kırmızı verdi, geçen
turda yeşil kalan Ö2/Ö3 çitleri dahil) ve geriye yalnızca NOT seviyesinde maddeler kaldı.

**Arşiv notu:** Önceki tur raporunun içeriği zaten `docs/qa/F-002-2026-09-04.md` dosyasında
birebir korunuyordu (`diff` ile doğrulandı: IDENTICAL). Bu yüzden onu ikinci kez "fix1" adıyla
kopyalamak yerine, **bu** düzeltme turu raporu `F-002-fix1-2026-09-04.md` adını aldı;
hiçbir içerik kaybolmadı.

---

## 1. Çalıştırdığım komutlar ve gerçek çıktıları

| Komut | Çıkış kodu | Çıktı |
|---|---|---|
| `npm run verify` (tur başı) | **0** | `Test Files 12 passed (12)` · `Tests 146 passed (146)` · `vite build ✓ built in 919ms` |
| `npm run e2e` | **0** | `1 passed (5.7s)` — `shell.spec.ts` |
| `npm run e2e:dev` | **0** | `1 passed (4.7s)` — `dev-shell.spec.ts` |
| `TZ=UTC npx vitest run` | **0** | `146 passed (146)` |
| `TZ=Etc/GMT+12 npx vitest run` (UTC−12) | **0** | `146 passed (146)` |
| `TZ=Pacific/Kiritimati npx vitest run` (UTC+14) | **0** | `146 passed (146)` |
| `npm run verify` (tüm mutasyonlar geri alındıktan sonra) | **0** | `12/12 dosya · 146/146 test · built in 1.21s` |

Blockers'ta sorulan CI borcu **kendiliğinden kapanmış**: `tests/ci-workflow.test.ts`'in
ADR-009 (Windows-only) uyumsuzluğu CEO'nun `1dde768` commit'iyle giderilmiş; `npm run verify`
artık tam yeşil (12/12 dosya). Bu, F-002'nin kararına etki etmedi, yalnızca engel kalktı.

---

## 2. B1 senaryosunun gerçek gözlemi (kendi kurduğum senaryo, testten bağımsız)

Geçici `MC_DATA_DIR`, `createServer(0, dir)`, gün dosyası yolunda (`<dir>/events/2026-09-04.jsonl`)
**gerçek bir dizin** oluşturuldu, `npx tsx` ile çalıştırıldı:

```
[1] engel kuruldu, dayFile bir dizin: true
[2.0] HATA YOLU status=503 body={"success":false,"error":{"code":"storage_unavailable","message":"Olay şu anda saklanamadı."}}
[2.1] HATA YOLU status=503 ... (aynı)
[2.2] HATA YOLU status=503 ... (aynı)
[3] surec yasiyor mu? EVET (pid 15240)
[4] engel kaldirildi
[5] SAGLIKLI status=202 body={"success":true,"data":{"id":"3-a6c405","seq":3,...}}
[6] SAGLIKLI-2 status=202 body={"success":true,"data":{"id":"4-f8f6f4","seq":4,...}}
[7] EKSIK ALAN status=202 body={... "flags":["missing_fields"]}
[8] JSON DEGIL status=202 body={... "flags":["parse_error"]}
[9] DISKTEKI SATIR SAYISI = 4   (seq 3,4,5,6 — fiziksel sırayla)
[10] health: {... "corrupt_lines":0,"write_errors":3}
```

Sonuç, brifingin dört şartını da karşılıyor:
1. **İstemci her zaman yanıt aldı** — üç arızalı istekte de 5 sn'lik timeout'a düşmedi (eski
   davranış: `AbortError`, 6 sn asılı kalma).
2. **Süreç yaşadı** — arızadan sonra health, GET ve dört yeni POST çalıştı; `unhandledRejection`
   ile `exit(1)` yok.
3. **Kuyruk zehirlenmedi** — arızadan **sonraki** istekler 202 aldı ve satırları **diskten**
   okundu (4 satır, geçerli JSON, fiziksel sıra artan).
4. **503 kararının yan etkisi yok** — eksik alanlı olay hâlâ `202 + missing_fields`, JSON
   olmayan gövde hâlâ `202 + parse_error`. Bu, brifingin "bozulduysa BLOKLAYICI" dediği
   noktadır; **bozulmamış**.

**503 kararı savunulabilir mi → EVET, onaylıyorum.** Gerekçe: (a) PRD F1/AC5'in "5xx dönmez"
kuralı payload toleransını korumak için vardır ve bu davranış kanıtlandığı gibi aynen duruyor;
(b) olay gerçekten diske yazılamamışken 202 ("kabul edildi") dönmek istemciyi ve F-003'ün SSE
tüketicisini yanıltırdı — sessiz veri kaybı, dürüst hata yolundan daha kötüdür; (c) 503 RFC 9110
anlamıyla eşleşiyor (geçici kaynak sorunu) ve mevcut `ApiResponse`/`ErrorCode` zarfına
`src/shared/types.ts:37`'de temiz biçimde eklenmiş; (d) karar `docs/qa/F-002-contract.md:987-1019`'a
gerekçesiyle dokümante edilmiş, sözleşme §4.2'nin "asla 5xx" cümlesi açıkça daraltılmış.

---

## 3. Kapanış tablosu

| # | Durum | Kanıt |
|---|---|---|
| **B1** — kuyruk zehirlenmesi / yanıtsız istek / süreç ölümü | **KAPANDI** | Kod: `src/server/store/jsonl-store.ts:201-215` (`writeResult` ayrı izlenir, `queue` hata dalında hatayı yutup devam eder) + `src/features/events/server/ingest.ts:54-79` (`try/catch` → 503). Gözlem: §2'deki senaryo. Testler: `tests/integration/events-api.test.ts:314-349` (503 → engel kalkar → 202 → diskte 1 satır) ve `tests/server/store/jsonl-store.test.ts:205+`. Kendi M1/M2 mutasyonlarım ikisini de kırmızı verdirdi. |
| **Ö1** — `.seq` semantiği / olaysız restart'ta kayma | **KAPANDI** | Tek semantik: "bir sonraki atanacak seq" — yazar `jsonl-store.ts:157` (init) ve `:216` (append), okur `jsonl-store.ts:155-156` (`Math.max(fileSeq + 1, dotSeq ?? 0)`). Kendi ölçümüm: 3 olay → **5 olaysız restart** → `.seq` her seferinde `3` (hiç değişmedi) → sonraki olayın seq'i **3** → diskteki dizi `[0,1,2,3]`. Ayrıca `.seq=50` elle yazıldığında yeni olay `50` (ileri `.seq` kazanıyor), `.seq` silindiğinde `51` (JSONL kazanıyor). Test: `jsonl-store.test.ts:185-203`. Repo'daki kirli `data/events/.seq` temizlenmiş (şu an tek baytlık `0`). |
| **Ö2** — `DAY_FILE_PATTERN` çiti ölçülmüyordu | **KAPANDI** | Test `tests/server/store/retention.test.ts:123-143` (`notlar.txt` + `.seq` konur, `pruneByDays` sonrası ikisi de durur). Kendi M4 mutasyonum (çit hem `retention.ts:39`'dan hem `:48`'den kaldırıldı) → **kırmızı**: `expected [ '.seq', '2026-08-01.jsonl' ] to deeply equal [ '2026-08-01.jsonl' ]`. Geçen tur bu mutasyon 133/133 **yeşil** kalıyordu. |
| **Ö3** — `check-ports` varsayılana düşme totolojisi | **KAPANDI** | Yeni testler `tests/scripts/check-ports.test.ts:71-98` gerçek 7333/7334'ü meşgul edip script'in o sabitlere düştüğünü kanıtlıyor. Kendi M5 mutasyonum (`scripts/check-ports.mjs:12-14` geçersizde `0` döner) → **iki test kırmızı** (`expected +0 not to be +0`). Geçen tur aynı mutasyon 4/4 yeşildi. |
| **Ö4** — `no-external-host` çiti yeni kod köküne kör | **KAPANDI** | `tests/no-external-host.test.ts:24-29` artık `src/features/**` (`.ts/.tsx`) ve `scripts/**` (`.mjs`) yürüyor. Kendi M6 mutasyonum (iki köke birer dış host literali kondu) → **iki test kırmızı**, dosyalar geri alındı. `query.ts`'in taban URL'si `http://127.0.0.1`'e çevrilmiş (yanlış pozitif üretmiyor, davranış değişmedi). |

---

## 4. Kendi mutasyon tablom (developer'ın listesinden bağımsız, 7 adet)

| # | Mutasyon (dosya:satır) | Kırmızı veren test | Hata mesajının ilk satırı | Geri alındı |
|---|---|---|---|---|
| M1 | `jsonl-store.ts:203-214` — `queue`'nun hata dalı silindi (reddedilen promise zincirde kalır) | `events-api.test.ts` › B1 **ve** `jsonl-store.test.ts` › B1 | `AssertionError: expected 0 to be greater than or equal to 1` (+ vitest `Unhandled Rejection: EISDIR`) | ✅ evet |
| M2 | `jsonl-store.ts:210` — hata dalı sayar+loglar ama `throw err` ile kuyruğu **yeniden zehirler** | `events-api.test.ts` › B1 | `AssertionError: expected 503 to be 202` | ✅ evet |
| M3 | `jsonl-store.ts:216` — `append`'in `.seq` yazımı `nextSeq + 1` (semantik bir ileri kayar) | `jsonl-store.test.ts` › `.seq restart arasında ASLA artmaz` **ve** `events-api.test.ts` › AC-5 | `AssertionError: expected 4 to be 3` / `expected 151 to be 150` | ✅ evet |
| M4 | `retention.ts:39,48` — `DAY_FILE_PATTERN` çiti hem listeden hem `safeDelete`'ten kaldırıldı | `retention.test.ts` › desen çiti (Ö2) | `AssertionError: expected [ '.seq', '2026-08-01.jsonl' ] to deeply equal [ '2026-08-01.jsonl' ]` | ✅ evet |
| M5 | `check-ports.mjs:12-14` — geçersiz portta varsayılan yerine `0` | `check-ports.test.ts` › Ö3 × 2 | `AssertionError: expected +0 not to be +0` | ✅ evet |
| M6 | `src/features/events/server/__qa_probe.ts` (yeni) + `scripts/check-ports.mjs` sonuna dış host literali | `no-external-host.test.ts` × 2 | `AssertionError: expected [ Array(1) ] to be null` | ✅ evet (dosya silindi, script `git checkout`) |
| M7 | `jsonl-store.ts:19` — `dayFileName` UTC yerine **yerel** tarih (`getFullYear/getMonth/getDate`) | `jsonl-store.test.ts` › `UTC tarihinden YYYY-MM-DD.jsonl üretir` | `AssertionError: expected '2026-09-05.jsonl' to be '2026-09-04.jsonl'` | ✅ evet |

**Yeşil kalan mutasyon: YOK (0/7).** Geçen turun iki "ölçmeyen test" bulgusu (Ö2, Ö3) artık
gerçekten ölçüyor.

---

## 5. Gün sınırı / saat dilimi değerlendirmesi → **NOT (kusur bulunamadı)**

Brifingin öncülü ("gün dosyası adı yerel tarihe göre üretiliyor") **doğrulanmadı — kod
UTC kullanıyor**: `src/server/store/jsonl-store.ts:19` `date.toISOString().slice(0, 10)`.
`grep -rn "toISOString|getFullYear|getMonth|getDate()|toLocaleDate"` taraması, `src/`,
`tests/` ve `scripts/` altında **tek bir yerel-tarih çağrısı** göstermiyor; `normalize.ts:96,126`
de `ts` alanını `toISOString()` ile yazıyor. Append, açılış taraması (`listDayFiles` +
sözlük sırası), retention'ın aktif dosyası ve cutoff'u (`retention.ts:75-76`) aynı tek
fonksiyondan (`dayFileName`) besleniyor — üç yer arasında saat dilimi ayrışması yok.

Ampirik kanıt: tüm süit üç ayrı saat diliminde koştu — `TZ=UTC`, `TZ=Etc/GMT+12` (UTC−12) ve
`TZ=Pacific/Kiritimati` (UTC+14) — üçünde de **146/146 yeşil** (yerel makine UTC+3,
`getTimezoneOffset() = -180`). Ayrıca M7 mutasyonu (UTC → yerel) `jsonl-store.test.ts:26-29`'u
kırmızı verdiriyor, yani UTC semantiği test tarafından **çitlenmiş**.

Gün geçişinde kayıp/yanlış dosya riski: `append` gün adını çağrı anında hesaplar, yazma
kuyrukta gecikse bile dosya yolu sabittir → olay kaybolmaz, yalnızca gecikmiş yazım bir önceki
güne düşer (o dosya retention'da 30 gün korunur). Yeni günün ilk dosyası oluşana kadar
`loadRingAndSeq` en yeni dosyanın son geçerli satırından, ona güvenemezse `.seq`'ten
(`Math.max`) besleniyor → seq tekrarı yok. **Somut kusur bulunamadı; GEÇTİ bu maddeye
takılmadı.** (CI'daki eski `expected 9 to be 10` Linux hatası, Ö1'in düzeltilen `.seq` kayma
hatasının deseniyle birebir aynı karakterde; düzeltmeden sonra hiçbir TZ'de tekrar etmiyor.)

---

## 6. Kalan bulgular (hepsi NOT seviyesi — bloklayıcı yok)

| # | Şiddet | Bulgu | Kanıt / tekrar üretme | Dosya:satır |
|---|---|---|---|---|
| N-1 | **NOT (yeni — düzeltmenin görünür kıldığı tutarsızlık)** | Yazma başarısız olup istemciye **503** dönüldüğünde olay ring buffer'da **kalıyor** ve `GET /api/events` onu saklanmış gibi gösteriyor (`next_seq` de ilerliyor). Süreç yeniden başlayınca olay kaybolur → hayalet okuma. Veri **kaybı değil** (olay zaten hiç yazılmadı) ve hiçbir AC bunu ölçmüyor; developer `docs/progress.md`'de bilinçli olarak kapsam dışı bıraktığını bildirmiş. **F-003 (SSE) bunu ele almak zorunda:** aksi hâlde hiç saklanmamış bir olay canlı akışa yayınlanır. | Gün dosyası yolunda dizin → POST → `503`; hemen ardından `GET /api/events?limit=100` → `{"success":true,"data":[{...,"seq":0,...}],"meta":{"total":1,"next_seq":1}}` (diskte hiçbir şey yok). | `src/server/store/jsonl-store.ts:194-196` (`ring.push` yazmadan önce, optimistic) |
| N-2 | NOT (kozmetik regresyon) | `23fc2b7` düzeltmesinde 5 satırlık açıklama bloğu **iki kez** yapıştırılmış (birebir tekrar). Zararsız ama kod hijyeni. | `grep -n "QA düzeltme turu 1 (B1): bu append" src/server/store/jsonl-store.ts` → `202` ve `207`. | `src/server/store/jsonl-store.ts:202-211` |
| N-3 | NOT (bayat yorum) | `handleIngest`'in doküman bloğu hâlâ "Asla 5xx dönmez (PRD F1/AC5)" diyor; fonksiyon artık 503 dönebiliyor (aynı dosyanın `:64-77`'si bunu açıklıyor). Çelişkili yorum ileride yanlış yönlendirir. | `src/features/events/server/ingest.ts:17` | `src/features/events/server/ingest.ts:17` |
| N-4 | NOT (önceki turdan devreden) | Retention'ın `EPERM`/`EBUSY` dalı (R4) hâlâ hiçbir test tarafından tetiklenmiyor; sözleşmede kabul edilmiş davranış. | `src/server/store/retention.ts:54-57`. | `src/server/store/retention.ts:54-57` |
| N-5 | NOT (önceki turdan devreden, kabul edilmiş) | N-a (`::1` beyaz liste ölü girdisi), N-b (`eslint.config.js` sözleşme listesinde yok), N-c (`since_seq=-1` boş sonuçta `next_seq:0`), N-d (AC-4 "500 eşzamanlı" adlandırması) düzeltilmedi — brifing yalnızca B1/Ö1-Ö4'ü istediği için **doğru karar**. | `docs/progress.md` düzeltme turu kaydı. | — |

Yazma hatasında tüketilen `seq`'in bir daha verilmemesi (JSONL'de seyrek boşluk) sözleşme ve
`progress.md`'de açıkça kabul edilmiş bilinçli bir karardır; bulgu olarak açmıyorum.

---

## 7. Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **8** | B1'in üç belirtisi de (asılı istek, süreç ölümü, zehirli kuyruk) kendi senaryomda kapalı; `.seq` artık 5 olaysız restart'ta hiç kaymıyor, bir olayda tam bir artıyor; payload toleransı (202 + `missing_fields`/`parse_error`) bozulmamış; 146 test + iki e2e + üç saat diliminde yeşil. 10 değil: arıza anında ring/GET tutarsızlığı (N-1) duruyor. |
| Özellik bütünlüğü | **8** | İstenen beş düzeltmenin **beşi de** kapandı, hiçbiri kapsam genişletmesine kaçmadı (NOT'lar bilinçli olarak elde bırakılmış), 503 kararı sözleşmeye gerekçesiyle işlenmiş, blockers'taki CI sorusu da kapanmış. Eksik: N-1 ve N-4 gibi kenar davranışlar hâlâ ölçüsüz. |
| Görsel/UX | **8** | Yeni UI yüzeyi yok; e2e (1280 kabuk) ve dev-e2e yeşil, konsol hatası yok. Asıl kazanım API hata deneyiminde: istemci artık timeout'a düşmüyor, Türkçe ve dürüst bir 503 gövdesi alıyor; `/api/health.write_errors` ile arıza gözlemlenebilir. |
| Kod kalitesi (test + hata yönetimi) | **8** | **7/7 bağımsız mutasyonum kırmızı verdi** — geçen turda ölçmeyen iki çit (Ö2, Ö3) artık gerçekten ölçüyor; hata yolu artık hem store hem handler seviyesinde yakalanıyor, sayaç + log + health alanı var. 10 değil: kopyala-yapıştır yorum tekrarı (N-2), bayat doküman bloğu (N-3), ring'in optimistic push'u ve `EPERM` dalı testsiz. |

**Karar kuralı:** Bloklayıcı yok, dört boyut da ≥ 7 → **GEÇTİ**. Feature notu `status: done`.

---

## 8. Çalışma ağacı ve süreç temizliği kanıtı

```
$ git diff HEAD -- src/ tests/ scripts/ package.json
(bos = tek satir degisiklik yok)

$ git status --porcelain
?? .claude/launch.json        <- bu turun urunu DEGIL (QA oncesi mevcut, arac dosyasi)

$ npm run verify   -> 12/12 dosya, 146/146 test, build OK, exit 0
```

Uyguladığım **7 mutasyonun tamamı geri alındı** (`git checkout --` ile birebir); M6'nın
oluşturduğu `src/features/events/server/__qa_probe.ts` silindi; üç geçici `tsx` probe dosyası
(`qa-b1-probe.mts`, `qa-seq-probe.mts`, `qa-ring-probe.mts`) silindi.

**Yetim süreç kontrolü:** tur sonunda çalışan `node.exe` süreçleri yalnızca PID 34544 ve 29928 —
`Win32_Process.CommandLine` ile doğrulandı: ikisi de bu QA oturumunun Playwright MCP aracı
(başlangıç saati 22:29, ilk komutumdan önce), uygulama süreci değil. `netstat`'ta 7333/7334/
7433/7434 portlarında **LISTENING yok** (yalnızca e2e koşusundan kalan TIME_WAIT girdileri).
Başlattığım tüm sunucular probe script'lerinin sonunda `server.close()` + `process.exit(0)` ile
kapandı, geçici `MC_DATA_DIR`'ler silindi.
