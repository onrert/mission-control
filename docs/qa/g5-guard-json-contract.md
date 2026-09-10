---
status: qa
---

# G5 — GUARD.ok'un JSON'a taşınması (Y1'in dördüncü yaması değil, tasarım değişikliği)

Kaynak: `docs/qa/G5-sozlesme-kararlari-2026-09-10-tur3.md` (KARAR: KALDI, ESKALE: true — aynı
kabul kriteri (Y1) üç ardışık turda "metnin ŞEKLİ kapsamı belirliyor" ailesinden farklı bir
boyutta yenildi). Kullanıcı kararı: dördüncü bir metin-ayrıştırma yaması **yok**; GUARD.ok'un
makineye giden kısmı serbest markdown olmaktan çıkıp JSON'a taşınıyor (rapor §8 madde 5,
`ADR-013` "beyaz liste zorunlu" ilkesinin bu kapıya uygulanması).

## Bu değişiklik neden var (tek cümle)

Üç turun ortak kök nedeni "serbest metinden makine kararı çıkarmak"tı; kaynağı (markdown
ayrıştırması) tamamen ortadan kaldırıp kapsamı tek, ayrıştırması belirsizliğe yer bırakmayan bir
JSON alanından (`scope`) okumak, başlık-kimliği-devralma sınıfını **yapısal olarak imkânsız**
kılıyor — artık "hangi satır başlık sayılır" sorusu yok, çünkü başlık kavramı yok.

## 1. Kapsam (bu turun dokunduğu iki dosya, nihai hâlleri scratchpad'de)

- `.claude/hooks/gate-check.cjs` — `parseGuardScope()` kaldırıldı, yerine `parseGuardDoc()`
  (JSON ayrıştırıcı) geldi. `.guard-state.json` tabanlı kısmi-tüketim izleme mekanizması
  tamamen kaldırıldı (bkz. §3).
- `.claude/hooks/_selftest.cjs` — markdown'a özgü vakalar (`y1-*`, `y1t2-*`, sentetik `(c)/(e)/(f)`)
  JSON karşılıklarına çevrildi; yeni JSON-saldırısı ve zaman-penceresi vakaları eklendi.

Diğer yedi hook dosyasına (`_common.cjs`, `block-dangerous.cjs`, `asset-guard.cjs`,
`post-format.cjs`, `send-event.cjs`, `session-start.cjs`, `stop-check.cjs`) hiç dokunulmuyor.

## 2. Yeni GUARD.ok biçimi

```json
{
  "scope": [".claude/hooks/gate-check.cjs", ".claude/hooks/_selftest.cjs"],
  "reason": "insan için serbest metin — HİÇBİR ZAMAN taranmaz",
  "created_at": "2026-09-10T19:05:00+03:00",
  "valid_minutes": 30
}
```

### 2.1 Ayrıştırma kuralları ve karar noktaları (brief §2.1)

1. **Dosyanın tamamı `JSON.parse` edilir.** Ayrıştırılamazsa (sözdizimi hatası) → fail-closed
   (boş kapsam, `GUARD.ok` SİLİNMEZ — kullanıcı/CEO düzeltip tekrar denesin diye; yalnızca süresi
   dolan token silinir, bkz. §2.2).
2. **Kök değer bir JSON object olmalı** (dizi/dize/sayı/null/boolean değil). Değilse fail-closed.
3. **`scope` yalnızca kaynak.** Kapsam SADECE `doc.scope` alanından okunur. `reason` dahil
   başka HİÇBİR alan hiçbir zaman ad için taranmaz — bu, üç turun ortak kusurunu (serbest
   metnin herhangi bir yerinde geçen bir adın kapsamı etkilemesi) kaynağında yok eder.
4. **`scope` dolu bir dize dizisi olmalı.** Dizi değilse, boşsa, ya da elemanlarından **biri
   bile** dize değilse (sayı/null/nesne/dizi/boolean) → **TÜM kapsam geçersiz** (fail-closed).
   Gerekçe: "belirsizlik her zaman sıfır erişime çözülür" ilkesinin JSON karşılığı; kısmi kabul
   (geçerli elemanları alıp geçersizleri atlamak) yeni bir ayrıştırma-yorumu tartışması açar.
5. **Her `scope` elemanı beyaz listeye tam olarak uymalı:** `^\.claude\/hooks\/[\w-]+\.cjs$`
   ya da `^\.claude\/settings\.json$` (regex `i` bayrağıyla, harf duyarsız — bu depoda dört kez
   tuzak olan Windows harf duyarsızlığı kuralı). `\w` bayraksız (Unicode değil) olduğu için
   yalnızca ASCII harf/rakam/alt çizgi + tire kabul edilir; bu, ayrı bir Unicode-normalizasyon
   adımına gerek KALMADAN homoglif/aksanlı-karakter saldırılarını (§2.1 saldırı listesi madde
   "unicode normalizasyon") karakter sınıfı düzeyinde eler (bkz. test D-UNI). Eleman ayrıca
   **ters bölü içeremez** (açık kontrol, regex zaten reddeder ama okunabilirlik için ayrı
   kontrol tutuldu). Tam yol, `..`, mutlak yol, UNC, `\\?\` öneki gibi hiçbir varyant literal
   `.claude/hooks/` önekiyle **birebir** başlamadığı için otomatik reddedilir — **elemanlar
   yol olarak `resolve`/`realpath` edilmez**, sabit dizeler olarak karşılaştırılır (brief'in
   açık uyarısı: çözersen tur-4'te kapatılan junction/uzun-yol sınıfını geri açarsın).
6. **`created_at` zorunlu, ISO 8601 dize.** `Date.parse` ile ayrıştırılamazsa → fail-closed.
   `now + 60 sn` toleransından fazla **gelecekte** ise → fail-closed (brief'in "gelecekte" kuralı
   birebir; 60 saniyelik pay yalnızca yazan/okuyan saat farkı yuvarlamasını karşılamak için,
   güvenlik sınırını gevşetmiyor çünkü hâlâ dakikalar mertebesindeki bir manipülasyonu durduruyor).
7. **`valid_minutes` opsiyonel, sayı, > 0, ≤ 120.** Yoksa varsayılan **30**. Sayı değilse, ≤ 0
   ise, ya da **120'yi aşıyorsa** → fail-closed (sınırsız/aşırı uzun pencere yok). **Üst sınır
   120 dakika (2 saat) seçildi:** brief'in dürüst maliyet uyarısı gereği pencere kısa tutulmalı
   ama tek bir developer/QA turu saatlerce sürebiliyor (bu depoda kayıtlı, F-012 dokuz turda
   150-tur sınırına takıldı); 30 dk varsayılan çoğu tek-oturumluk hook bakımı için yeterli, 120 dk
   üst sınırı CEO'nun açıkça daha uzun bir pencere istediği (ör. çok adımlı bakım) durumlar için
   esneklik tanır ama "bir kez onayla, günlerce geçerli" senaryosunu engeller.
8. **Süre dolmuşsa (`now > created_at + valid_minutes`) → fail-closed VE dosya silinir** (§2.2).

### 2.2 Tüketim kuralı — zaman pencereli, kalıcı-yazma-değil

**Karar: token artık tek yazmada tüketilmiyor.** Süresi dolmadığı sürece, kapsamındaki HER
dosyaya **istenildiği kadar** yazılabilir (`.guard-state.json` ve "touched" izleme mantığı
tamamen kaldırıldı — yeni tasarımda gereksiz, çünkü tüketim artık zamana bağlı, yazma sayısına
değil). Bu, bugünkü onay-yorgunluğu kusurunun (bir düzeltmede üç dosya = üç onay) doğrudan
düzeltmesidir.

- **`.guard-state.json` kaldırıldı mı?** Evet — kod hiç yazmıyor/okumuyor. **Sert engel
  korundu** (`docs/approvals/.guard-state.json`'a hiçbir araç doğrudan yazamaz/silemez) —
  saf savunma-derinliği: eski sürümden kalma bir dosya varsa (ya da ileride birisi bu deseni
  geri getirirse) yine korumalı kalsın; maliyeti sıfır, kaldırmanın getirisi yok.
- **Süre dolmuş token ne zaman silinir?** `gate-check.cjs`, hedef `isGuarded` (yani
  `.claude/hooks/**` ya da `.claude/settings.json`) olduğunda GUARD.ok'u **her zaman** okur —
  hedef kapsamda olsun ya da olmasın. Süresi dolduğu bu ilk değerlendirmede fark edilir edilmez
  dosya silinir. Yani **kapsam dışı bir yazma denemesi de** süresi dolmuş bir token'ı temizler
  (brief'in açık sorusunun cevabı: EVET). Bu temizlik **tembeldir** (lazy) — hiçbir arka plan
  süreci yok, yalnızca bir sonraki guarded-yol değerlendirmesinde tetiklenir; tamamen ilgisiz bir
  dosyaya (ör. `src/foo.ts`) yazma GUARD.ok'a hiç bakmaz, süresi dolmuş token orada kalmaya devam
  eder (bu, eski `consume()`'un da zaten tembel olan davranışıyla tutarlı).
- **Dürüst maliyet (brief'in istediği açık beyan):** pencere boyunca token canlıdır — yani TEK
  bir kullanıcı onayı, o pencerede kapsamdaki dosyalara **birden fazla** yazmayı yetkilendirir.
  Bu **bilinçli bir gevşetme**: tehdit modeli yerel/tek-kullanıcı bir araç olduğu için (kullanıcı
  zaten dosya sistemine tam erişimli), riskin büyüklüğü "aynı kullanıcı aynı onaylı dosyaya iki
  kez yazabilir" kadardır — kapsam dışına hiçbir zaman sızma yoktur. Takas, onay yorgunluğunu
  gerçek anlamda azaltmakla bu küçük genişlemeyi kabul etmek arasındadır; CEO/kullanıcı ne zaman
  isterse `valid_minutes`'ı küçülterek (ör. 5) pencereyi daraltabilir.
- **Saat kayması / sistem saati geri alınması:** wall-clock tabanlı süre kontrolü, sistem saati
  geriye alınırsa token'ın efektif ömrünü yapay olarak uzatabilir. Bu **kabul edilen bir sınır**
  (yerel tek-kullanıcı araç; saat oynamasının kullanıcıya zaten sahip olduğu yetkiden (dosya
  sistemine tam erişim) fazlasını kazandırmaması) — `CLAUDE.md`'nin F-011 kapanışındaki "yerel
  tek kullanıcılı araç için orantısız" ilkesiyle aynı sınıf. Monotonik saat kullanılmadı çünkü
  her `gate-check.cjs` çağrısı ayrı bir process'tir (monotonik sayaç process'ler arası hayatta
  kalmaz); bu yüzden wall-clock kaçınılmaz.

### 2.3 Hata mesajları ve README

- Blok mesajları artık üç ayrı durumu ayırt eder: (a) GUARD.ok hiç yok, (b) ayrıştırılamadı
  (sözdizimi/şema hatası — **dosya silinmez**, kullanıcı düzeltip tekrar dener), (c) süresi
  dolmuş (**dosya silinir**), (d) ayrıştı ama hedef kapsamda değil (**ayrıştırılan kapsam
  listelenir**). Her mesajın sonuna beklenen JSON biçimini örnekle anlatan sabit bir yardım
  metni (`GUARD_FORMAT_HELP`) eklendi — kullanıcı/CEO tek denemede doğru yazabilsin diye
  (kayıtlı ders: token deneme-yanılmaya dayanmıyor).
- `docs/approvals/README.md`'ye GUARD.ok bölümü eklendi (bu turda düzenlenen TEK gerçek
  onaylar-dizini dosyası — brief'in açık istisnası): ne işe yarar, tam JSON örneği, alan
  açıklamaları, geçerlilik süresi varsayılanı/üst sınırı, "kapsam dışı yol reddedilir" ve
  "`scope` DIŞINDAKİ hiçbir alan taranmaz" kuralları.

## 3. JSON saldırı vektörleri — karar (brief §2.1 listesi)

| Vektör | Karar | Gerekçe |
|---|---|---|
| Yinelenen `"scope"` anahtarı | `JSON.parse` standart davranışı: **sonuncusu** geçerli olur. Ek kontrol EKLENMEDİ. | Etkili değer hâlâ beyaz listeden geçmek zorunda; "insanın gördüğü ilk `scope`" ile "makinenin okuduğu son `scope`" arasındaki görsel uyumsuzluk bir **okunabilirlik** sorunu, güvenlik açığı değil — hiçbir ek yetki kazandırmıyor. README'de bu davranış açıkça not edildi ki CEO belgeyi tek `scope` alanıyla yazsın. |
| `__proto__` / prototip kirlenmesi | Ek kontrol EKLENMEDİ, test ile doğrulandı. | `JSON.parse`, `__proto__` dahil tüm anahtarları `CreateDataProperty` ile **öz özellik (own property)** olarak yazar (ES2019+, V8'de doğrulandı) — nesnenin prototipini DEĞİŞTİRMEZ. Test D-PROTO bunu canlı ölçüyor: `__proto__` alanına konan sahte bir `scope` kapsamı hiçbir etkilemiyor. |
| `scope` dizi yerine dize | fail-closed | §2.1 madde 4. |
| İç içe nesne/dizi eleman | fail-closed (TÜM kapsam) | §2.1 madde 4 — tip kontrolü `typeof !== 'string'` her iç içe yapıyı da yakalar. |
| `null`/sayı/boolean eleman | fail-closed (TÜM kapsam) | Aynı tip kontrolü. |
| Çok büyük dosya | **8192 bayt üst sınır** (`MAX_GUARD_BYTES`), aşarsa `JSON.parse` denenmeden fail-closed. | Meşru bir GUARD.ok birkaç yüz bayttır (birkaç `scope` elemanı + kısa `reason`); 8 KB, uzun bir gerekçe paragrafı dahil cömert bir pay bırakırken DoS/aşırı bellek okumasını önler. |
| BOM | Baştaki U+FEFF **soyulur**, geri kalan JSON olarak ayrıştırılır (kabul). | Windows Not Defteri gibi editörler UTF-8 dosyalara BOM ekler; bu meşru bir yazım artefaktı — reddetmek aşırı-engelleme olurdu. Test C-BOM negatif kontrolü. |
| CRLF | JSON boşluk-toleranslıdır (jetonlar arası CRLF sorunsuz ayrıştırılır) — ek kod YOK. | `JSON.parse` zaten CR/LF'i jetonlar arasında boşluk sayar. Test C-CRLF negatif kontrolü. |
| `\u0000` (ham bayt, JSON metninde) | Dosya metninde **ham** NUL bayt varsa ayrıştırma öncesi açıkça reddedilir (`indexOf('\u0000')`). `scope` elemanı İÇİNDE **kaçışlı** `\u0000` (yani metnin kendisi `\u0000` altı karakteri, gerçek bayt değil) → normal JSON kaçış dizisi, `JSON.parse` başarıyla bir NUL içeren dizeye çözer, ama bu dize beyaz liste regex'ine UYMADIĞI için (sondaki NUL karakteri `.cjs$` sonrasına eklenir, ya da ortasına girerse `[\w-]` dışı olduğu için) o eleman reddedilir → TÜM kapsam geçersiz. | Çift katman: dosya bütünlüğü (ham bayt) + beyaz liste (kaçışlı biçim). Her iki durumda da sızıntı yok. Test D-NUL-RAW ve D-NUL-ESCAPED. |
| Unicode normalizasyon (görsel homoglif) | Ayrı bir NFC normalizasyon adımı **eklenmedi** — gerek yok. | `[\w-]` bayraksız regex ASCII-dışı HİÇBİR karakteri kabul etmez; Kiril/aksanlı/tam-genişlik bir "cjs" asla eşleşmez. Test D-UNI (Kiril `с` ile `gate-check.cjs` taklidi) bunu canlı doğruluyor. |
| `..`/mutlak yol/UNC/`\\?\` öneki | Otomatik reddedilir (regex tam eşleşme, `resolve` YOK). | §2.1 madde 5. Test D-TRAVERSAL, D-ABS, D-UNC, D-LONGPREFIX. |
| Ters bölü ayracı | Açık `indexOf('\\')` kontrolüyle reddedilir (regex zaten reddederdi, çift katman okunabilirlik için). | §2.1 madde 5. Test D-BACKSLASH. |

## 4. Test planı (`_selftest.cjs`)

Taban: **122 vaka**, hepsi geçiyor (mevcut rapor). Hiçbir davranışsal vaka kaybedilmeyecek:

- `dangerCases` (block-dangerous.cjs), Katman A (`approvalsAskCases`), K-A/K-B kanonikleştirme,
  fail-closed realpath probu, `gateCases`'in K1 temel testleri (GUARD.ok yokken engelli, harf
  varyantı, agents/**-agent-memory/**-src/** serbestliği) **DEĞİŞMEDEN** taşınıyor — bunlar
  scope-ayrıştırma biçiminden bağımsız.
- `writeGuardScope(names)` yardımcı fonksiyonu artık geçerli bir JSON belgesi üretir
  (`{"scope": [...], "created_at": <şimdi>, "valid_minutes": 30}`).
- `writeGuardRaw(content)` artık **ham metni** (JSON ya da kasıtlı bozuk herhangi bir şey)
  olduğu gibi yazar — adı korunuyor, davranışı ("ham içerik yaz") aynı, yalnızca içerik markdown
  yerine JSON/JSON-olmayan dizeler taşıyor.
- **Çevrilen vakalar (markdown'a özgü, artık anlamsız → JSON karşılığına çevrildi, NEDEN
  çevrildiği yorumda belirtilecek):**
  - `y1-a/b/c` (Kapsam/Gerekçe bölümü ayrımı) → **D-FIELD-ISOLATION**: `reason` alanında geçen
    bir ad kapsama girmiyor; `scope` alanındaki ad hâlâ kabul ediliyor. Çeviri nedeni: "bölüm"
    kavramı yok artık, tek alan var.
  - `y1-d` (başlık hiç yok → fail-closed) → **D-NO-SCOPE-FIELD**: `scope` alanı hiç yoksa
    fail-closed.
  - `y1-e` (başlık iki kez → belirsiz, fail-closed) → **D-DUP-KEY**: yinelenen `"scope"`
    anahtarı (§3) — artık "belirsiz" değil, JSON'un kendi kuralıyla çözülüyor (sonuncusu), ayrı
    bir test bunu doğruluyor.
  - `y1-f/g` (başlık harf/boşluk varyantı) → **KALDIRILDI** (anlamsız): JSON'da "başlık" yok,
    alan adı `scope` sabit ve case-sensitive JS property erişimiyle okunuyor (JSON alan adları
    zaten literal eşleşir, "varyant" kavramı yok).
  - `y1-h` (başlık var ama liste yok → fail-closed) → **D-EMPTY-ARRAY**: `scope: []` (boş dizi)
    → fail-closed.
  - `y1t2-a/b/c` (kuyruk düzyazı / h1 / kalın sözde-başlık sonrası ad sızıntısı) →
    **D-REASON-CANNOT-LEAK**: `reason` alanına gömülü, TAM bir eski-biçim `## Kapsam` bloğu +
    başka bir dosya adı → o ad kesinlikle reddedilir (turun bloklayıcı senaryosu, §5).
  - `y1t2-d` (gerçekçi CEO belgesi, "DOKUNULMAYACAK"/"KAPSAMI DIŞINDADIR" notları) →
    **D-REALISTIC-CEO-DOC**: aynı senaryo JSON'da yeniden kurulur (`reason` alanına doğal dilde
    aynı notlar yazılır), `scope` yalnızca tek dosyayı listeler.
  - `y1t2-e` (h3 sonrası ad) → gereksiz (h3 kavramı yok), **KALDIRILDI**.
  - `y1t2-f` (girintili madde kabul) → gereksiz (liste maddesi kavramı yok), **KALDIRILDI**.
  - `y1t2-g` (liste maddeleri arası boş satır şeffaf) → **D-MULTI-WRITE**: iki dosyalık kapsamda
    HER İKİSİNE de ayrı ayrı yazılabiliyor VE token hiçbirinde tükenmiyor (yeni tüketim modelinin
    doğrudan testi, §2.2).
  - `y1t2-h` (madde-biçimli dışlama notu → tüm kapsam geçersiz) → **D-MIXED-TYPE-ARRAY**:
    `scope` dizisinde bir geçerli + bir geçersiz (ör. sayı) eleman → TÜM kapsam geçersiz.
  - `y1t2-i` (tek satırda çoklu ad artık desteklenmiyor) → **KALDIRILDI** (JSON dizisinde zaten
    her eleman ayrı bir dize, "tek satırda çoklu ad" kavramı JSON'da hiç oluşamaz).
  - Sentetik `(c)` (harf varyantı + tüketim) → **D-CASE-VARIANT**: harf varyantıyla eşleşir AMA
    **tüketilmez** (yeni model).
  - Sentetik `(e)` (kapsam dışı, token harcanmaz) → **DEĞİŞMEDEN** taşınıyor (davranış aynı).
  - Sentetik `(f)` (iki dosyalık kapsam, ilk geçer+kalır, ikinci geçer+tükenir) →
    **D-MULTI-WRITE** ile birleştirildi (ikisi de geçer, ikisi de token'ı KALDIRIR — tüketim yok).
  - `gateCases`'teki "GUARD.ok ile gecer VE tuketilir" testleri (block-dangerous.cjs,
    settings.json) → **"GEÇER VE TÜKETİLMEZ"** olarak güncellendi (davranış değişikliği,
    §2.2'nin doğrudan sonucu).

- **Turun zorunlu bloklayıcı senaryosu (§2.2 rapor, "başlık kimliği artık yapısal olarak
  imkânsız"):** `reason` alanına harfiyen tur-3'ün sızdıran belgesi gömülür (`## Kapsam` +
  arşivlenmiş bir dosya adı içeren tam blok), `scope` yalnızca gerçek onaylı dosyayı listeler.
  Beklenen: gömülü addan biri **her zaman** reddedilir (kapsamda değil), `scope`'taki dosya
  kabul edilir. Bu, mekanizmanın **yapısal** garantisidir (ayrıştırıcı `reason`'a hiç bakmıyor),
  tek bir sondaya bağlı bir "kapandı" iddiası değil.

- **Yeni JSON saldırı/uç durum vakaları (§3 tablosu, her satır en az bir test):**
  D-DUP-KEY, D-PROTO, D-SCOPE-NOT-ARRAY, D-NESTED, D-NULL-ELEMENT, D-NUMBER-ELEMENT,
  D-OVERSIZED, C-BOM (kabul), C-CRLF (kabul), D-NUL-RAW, D-NUL-ESCAPED, D-UNI (Kiril homoglif),
  D-TRAVERSAL (`../evil.cjs`), D-ABS (`C:/evil.cjs`), D-UNC (`\\\\server\\share\\x.cjs`),
  D-LONGPREFIX (`\\\\?\\C:\\...`), D-BACKSLASH (`.claude\\hooks\\x.cjs`), D-ROOT-NOT-OBJECT
  (kök dizi/dize/null), D-SYNTAX-ERROR (bozuk JSON).

- **Zaman penceresi vakaları (§2.2, gerçek 30 dk BEKLENMEDEN — `created_at` geçmişe yazılarak
  test edilebilir kılındı, brief'in önerdiği ikinci yöntem):**
  T-FRESH (created_at=şimdi, varsayılan pencere → kabul), T-EXPIRED-DEFAULT (created_at=41 dk
  önce, varsayılan 30 dk → red + **dosya silinir**), T-BOUNDARY-VALID (created_at=29 dk 59 sn
  önce → kabul), T-BOUNDARY-EXPIRED (created_at=30 dk 1 sn önce → red+silinir),
  T-CUSTOM-WINDOW (valid_minutes=90, created_at=60 dk önce → kabul), T-OVER-MAX
  (valid_minutes=121 → fail-closed, created_at şimdi olsa bile), T-NEGATIVE-MINUTES
  (valid_minutes=0 ve -5 → fail-closed), T-NON-NUMERIC-MINUTES (valid_minutes="30" dize →
  fail-closed), T-FUTURE (created_at=şimdi+10 dk → fail-closed), T-CLOCK-SKEW-TOLERATED
  (created_at=şimdi+30 sn → KABUL, 60 sn tolerans içinde), T-NO-CREATED-AT (alan yok →
  fail-closed), T-BAD-CREATED-AT (ayrıştırılamayan dize → fail-closed), T-EXPIRED-OUT-OF-SCOPE
  (süresi dolmuş token + kapsam DIŞI bir hedefe yazma denemesi → yine dosya silinir, brief'in
  açık sorusunun testi), T-REGRESSION-MULTI-WRITE (aynı dosyaya pencere içinde İKİ kez yazma →
  ikisi de kabul, token her ikisinde de KALIR — bugünkü kusurun regresyon testi).

- **Aşırı engelleme negatif kontrolleri (geçerli belge reddedilmemeli):** C-VALID-MINIMAL
  (yalnızca `scope`+`created_at`, `valid_minutes` yok → varsayılan uygulanır, kabul),
  C-VALID-WITH-REASON (uzun, çok satırlı `reason` içeren geçerli belge → kabul),
  C-VALID-TWO-SCOPE (iki elemanlı `scope`, ikisine de yazılabilir).

## 5. Mutasyon kanıtı planı (en az dört, brief zorunlu kılıyor)

1. **[TUR 5'te DÜZELTİLDİ — bkz. §11] Beyaz liste kontrolünü kaldıran mutasyon** (`normalizeScopeEntry`
   her dizeyi olduğu gibi kabul etsin) → **YANLIŞ ÖLÇÜLMÜŞTÜ.** Bu turun ilk hâli
   D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/D-BACKSLASH/D-UNI'nin kırmızı vereceğini iddia ediyordu;
   qa-evaluator ölçtü (G5-sozlesme-kararlari-2026-09-10-tur4.md §1.5) ve **0 kırmızı** çıktı — bu
   altı vakanın hepsi `scope`'a HEDEFTEN FARKLI bir değer yazıyor, yani kapsam ÜYELİK kontrolü
   (`parsed.scope.has(relLower)`) tek başına reddediyor; beyaz liste kaldırılsa da AYNI ŞEKİLDE
   reddeder. Doğru mutasyon kanıtı ve doğru (ayırt edici) test vakaları için **§11**'e bakın.
2. **`scope` dışındaki alanları da tarayan mutasyon** (eski kusuru geri getirir — `reason`
   içindeki backtick'li/`.cjs` biten dizeleri de kapsama ekleyen bir "yardımcı" ekle) →
   D-REASON-CANNOT-LEAK ve y1t2-a/b/c karşılığı (D-FIELD-ISOLATION) KIRMIZI.
3. **Zaman penceresi kontrolünü kaldıran mutasyon** (`expiresAt` kontrolünü `if (false)`
   yap) → T-EXPIRED-DEFAULT, T-BOUNDARY-EXPIRED, T-OVER-MAX, T-FUTURE, T-NEGATIVE-MINUTES
   KIRMIZI.
4. **Düzeltmeyi birebir eski hâline döndüren mutasyon** — `parseGuardDoc`'u eski
   `parseGuardScope` (markdown, `## Kapsam` başlık arayan) ile değiştir → JSON-biçimli
   `writeGuardScope` çıktısı artık `## Kapsam` başlığı taşımadığı için NEREDEYSE TÜM
   `gateCases`/D-*/T-* vakaları KIRMIZI (geniş kaskad beklenir, sayı raporda verilecek).

Her mutasyon **elle** geri alınacak (`Edit` ile ters işlem), `git checkout`/`git restore`
KULLANILMAYACAK (kayıtlı ders — mutasyon commit'siz iş üstünde yapılırsa checkout komşu
değişiklikleri de siler; bu turda zaten dosyalar scratchpad'de, gerçek depoya hiç yazılmıyor,
ama disiplin aynı şekilde uygulanacak: sandbox kopyasında mutasyon uygulanıp ölçülüp, sonra
kaynak taslaktan yeniden kopyalanarak "geri alınacak", asla `git` komutuyla değil).

## 6. Kurulum sırası — ZORUNLU

**Önce `_selftest.cjs`, EN SON `gate-check.cjs`.** PreToolUse hook'u diskteki `gate-check.cjs`'i
çalışma anında çalıştırır. `gate-check.cjs` son yazılmazsa, `_selftest.cjs`'in yazılması dahil
iki yazma da **eski (markdown) ayrıştırıcıyla** değerlendirilir — CEO'nun elindeki onay
(muhtemelen zaten markdown biçiminde, çünkü yeni JSON kuralı henüz devrede değil) kabul edilir,
ama `gate-check.cjs` yazıldıktan SONRA aynı GUARD.ok artık JSON beklendiği için geçersiz kalır ve
kurulum ortada kalabilir. Doğru sıra: `_selftest.cjs` önce (bu dosya `.claude/hooks/**`'te
GUARD.ok kapsamına göre korunuyor ama henüz gate-check.cjs eski olduğu için CEO'nun elindeki
mevcut/markdown GUARD.ok ile geçer), SONRA `gate-check.cjs` (bu yazmadan itibaren JSON kuralı
devreye girer — CEO bu ikinci yazma için **yeni bir JSON biçimli GUARD.ok** hazırlamış olmalı).

## 7. Kısıtlara uyum (bu tur, kod yazılmadan önce taahhüt)

- `.claude/hooks/**`'e gerçek yazma **denenmeyecek** (§0a) — nihai dosyalar yalnızca
  scratchpad'e yazılacak, doğrulama repo dışı bir `repo-sim/` ağacında yapılacak (gerçek
  `.claude/hooks/*.cjs` dosyaları yalnızca OKUNUP değiştirilmeden oraya kopyalanacak).
- `docs/approvals/*` gerçek dosyalarına dokunulmayacak; tur başı/sonu SHA-256 (README dahil,
  README için önce/sonra ayrı) raporlanacak.
- `docs/qa/latest.md` yazılmayacak; yalnızca bu yeni dosya (`g5-guard-json-contract.md`)
  yazılıp commit edilecek.
- `docs/progress.md`, `docs/blockers.md` yazılmayacak.
- `src/`, `tests/`, `scripts/`, `package.json`, `CLAUDE.md`, `data/` dokunulmayacak.
- `npm run test` / `npm run e2e` çalıştırılmayacak; yalnızca `node --check` ve sandbox
  self-test koşuları.
- Korunan komut adları Bash komut satırına gömülmeyecek; bu belge ve kod dosyaları `Write`
  aracıyla yazılacak.

## 8. Kabul kriterleri (ölçülebilir)

1. Sandbox'ta `node .claude/hooks/_selftest.cjs` (repo-sim ağacında) **exit 0**, toplam vaka
   sayısı raporlanır (taban 122'den değişebilir, azalmaz-anlamsız-olanlar hariç).
2. Tur-3'ün bloklayıcı senaryosu (D-REASON-CANNOT-LEAK) KIRMIZI vermeden **geçer** (yani ad
   reddedilir) — kanıt çıkış koduyla.
3. T-REGRESSION-MULTI-WRITE geçer (aynı dosyaya iki yazma, token tükenmez).
4. **[TUR 5'te DÜZELTİLDİ] §5'teki dört mutasyonun her biri belirtilen testleri KIRMIZI'ya
   çevirir, geri alınca YEŞİL.** qa-evaluator ölçtü: mutasyon 1'in iddiası **yanlıştı** (0 kırmızı,
   §5 madde 1'e bakın). Doğru ölçüm ve doğru test vakaları için **§11**'e bakın: M1 kapanışı 6 yeni
   ayırt edici vaka ekliyor ve BUNLAR mutasyon 1'i doğru ölçüyor (6/6 kırmızı, geri alınca 6/6
   yeşil).
5. `docs/approvals/README.md` güncel ve tam örnekli (bu tur içinde commit edilir).
6. Gerçek `docs/approvals/*` dosyalarının (README hariç, README için ayrı) SHA-256'ları
   değişmemiş; `git status --short` temiz (yalnızca bu contract dosyası + README + scratchpad
   dışı hiçbir iz yok).

## 9. P7b kapanışı (bu tur) — kayıpsız ayrıştırma zorunluluğu

CEO'nun bağımsız sondası (`scratchpad/probe-json-guard.mjs`), tur-5'in "yinelenen `scope`
anahtarı güvenlik açığı değil, JSON'un kendi kuralı (sonuncusu geçerli)" kararının (§3 tablosu,
madde 1) **yanlış** olduğunu kanıtladı: P7b, `evil-payload.cjs` gibi beyaz listeye uyan bir adın
**ikinci** (görünmeyen) `scope` anahtarında yer alınca sessizce KABUL edildiğini ölçtü
(`exit=0`). Bu, Y1 ailesiyle aynı sınıfta (belge insana bir şey söylüyor, makine başkasını
yetkilendiriyor) ama farklı bir mekanizmada (başlık kimliği yerine JSON anahtar kimliği) dördüncü
bir tekrar. Kullanıcı kararı: beşinci bir yama değil, **kayıpsız ayrıştırma zorunluluğu** —
`JSON.parse`'a ulaşmadan, `JSON.parse`'ın sessizce veri kaybettiği hiçbir yapıyı (en az yinelenen
anahtar) belgede barındırmama kuralı.

### 9.1 Seçilen mekanizma — adıyla

**Küçük, elle yazılmış, RFC 8259'u birebir uygulayan bir ham-metin tarayıcısı**
(`scanForDuplicateKeys`, `gate-check.cjs`). `JSON.parse`'DAN ÖNCE çalışır; SÖZDİZİMSEL OLARAK
GEÇERLİ bir belgede HER SEVİYEDE (kök + her iç içe nesne, kendi başına) yinelenen bir anahtar
bulursa belgeyi **tamamen** geçersiz sayar (fail-closed, dosya silinmez). Tarayıcı sözdizimsel
olarak GEÇERSİZ bir girdide kendi hatasını fırlatabilir — bu durumda sessizce vazgeçer (`null`
döner) ve asıl `JSON.parse` kendi "geçerli JSON değil" hatasını verir; tarayıcının TEK
sorumluluğu geçerli bir belgede JSON.parse'ın kaybedeceği bir yinelenmeyi ONDAN ÖNCE yakalamak.

Alınan karar noktaları:

1. **Hangi seviyede reddedilir?** HER seviye (yalnızca kök değil). Gerekçe: belirsizlik her
   zaman sıfır erişime çözülür ilkesinin burada da geçerli olması — kök temiz olsa bile iç içe
   bir yapıdaki (örn. `reason` bir JSON object olarak yazılmışsa) bir yinelenmeyi göz ardı etmek,
   aynı sınıfın bir sonraki alanda yenilmesine kapı bırakır (D-DUP-KEY-NESTED testiyle kanıtlı).
2. **Dize içindeki "anahtar gibi" metin anahtar sayılır mı?** HAYIR. Tarayıcı gerçek bir JSON
   durum makinesi olduğu için (`parseString` yalnızca STRING TOKENİ içindeyken kaçış dizilerini
   çözer, dışına asla "yapı" gözüyle bakmaz) `"reason": "\"scope\": [...]"` gibi bir değer asla
   yinelenen anahtar sayılmaz (D-DUP-KEY-STRING-DECOY testiyle kanıtlı — aşırı engelleme yok).
3. **Bilinmeyen kök anahtar ne olur?** Kapalı liste (`scope`, `reason`, `approved_by`,
   `created_at`, `valid_minutes`) — dışındaki HERHANGİ bir kök alan (yazım hatası dahil) belgeyi
   geçersiz kılar (D-UNKNOWN-ROOT-KEY). Bunun **istenmeyen ama doğru** bir yan etkisi: `__proto__`
   `JSON.parse` tarafından öz-özellik olarak yazıldığı için (`Object.keys(doc)` onu görür,
   önceki turlarda ölçülmüştü) artık kapalı listede olmadığından TEK BAŞINA belgeyi geçersiz
   kılıyor — D-PROTO testi bunu doğruluyor (evil scope zaten etkisizdi, şimdi safe scope da aynı
   belgede reddediliyor; `__proto__` OLMADAN aynı safe scope'un normal kabul edildiği ayrı bir
   izolasyon testiyle (D-PROTO-ISOLATION) bu regresyon riskten ayrıştırıldı).
4. **Unicode kaçışlı anahtar (`scope`) `scope` sayılır mı?** EVET, TEK BAŞINA kullanılırsa
   (D-UNICODE-ESCAPED-KEY-SINGLE) — bu bir saldırı değil, aynı anahtarı yazmanın JSON-yasal başka
   bir yolu, `JSON.parse` zaten "scope" olarak çözer. Ama literal `"scope"` İLE AYNI ANDA
   kullanılırsa (D-UNICODE-ESCAPED-KEY-DUP) tarayıcı anahtarları RAW METİN olarak değil DECODE
   EDİLMİŞ (canonical) hâlleriyle karşılaştırdığı için bu bir YİNELENEN ANAHTARDIR ve reddedilir.
5. **Metnin sonunda artık veri / birden fazla JSON belgesi?** Ek kod GEREKMEDİ — `JSON.parse`
   zaten trailing-garbage ve ardışık çoklu belgeyi native olarak SyntaxError ile reddediyor
   (Node'da doğrulandı: `JSON.parse('{}xyz')` ve `JSON.parse('{}{}')` ikisi de fırlatır); bu
   davranış mevcut `try/catch` ile zaten fail-closed'a düşüyordu. D-TRAILING-GARBAGE ve
   D-MULTI-JSON-DOCS testleri bu native davranışı KİLİTLEMEK için eklendi (regresyon güvencesi).
6. **BOM, `NUL karakteri`?** Zaten önceki turda ele alınmıştı (BOM soyulur, ham NUL reddedilir) —
   değişiklik yok, mevcut C-BOM/D-NUL-RAW/D-NUL-ESCAPED testleri korunuyor.

### 9.2 Tarayıcının kendisi de bir metin ayrıştırıcısıdır — neden bu sefer farklı

Brief'in açık itirazı: üç tur boyunca markdown'ı "yorumlayan" bir mekanizma her seferinde yeni
bir sözdizimi boşluğuna yenildi; bu tarayıcı da bir metin ayrıştırıcısı olduğuna göre neden aynı
kaderi paylaşmasın? Cevap: **JSON'un grameri RFC 8259 ile SONLU ve TAM olarak tanımlıdır** —
markdown'da "bu bir başlık mı yoksa başlık gibi görünen bir düzyazı/alıntı/kod bloğu mu" türünde
YORUMA açık hiçbir durum yoktu bu proje için (üç turun kaybettiği tam olarak buydu: "## Kapsam"
hem gerçek başlık hem arşiv metni hem HTML yorumu içinde görünebiliyordu ve BAĞLAMA bakmadan
ayırt edilemiyordu). JSON'da bir `{` HER ZAMAN bir nesne açar, bir `"..."` HER ZAMAN (kaçış
kurallarıyla) bir dizedir — biçim TEK bir şekilde okunur, ikinci bir yorum yoktur. Tarayıcı bu
yüzden bir "sezgi" motoru değil, gramerin kendisini birebir uygulayan bir durum makinesidir;
doğruluğu 157 test vakasıyla (aralarında string-içi-sahte-anahtar, unicode kaçışlı anahtar, iç
içe nesne, çok baytlı/BOM'lu girdi, sözdizimsel hata) ve üç bağımsız mutasyonla (§10.3) ölçüldü.
Kabul edilen tek risk: tarayıcının KENDİ implementasyon hatası (RFC'yi yanlış uygulaması) —
bu, "gramerin belirsizliği" değil "kodun doğruluğu" sorunudur ve normal test kapsamıyla azaltılır
(markdown turlarındaki risk KATEGORİK olarak farklıydı: gramer YOKTU, "doğru" davranış tanımsızdı).

### 9.3 Reddedilen alternatif — round-trip (stringify) eşitliği

`JSON.parse` sonucunu `JSON.stringify` ile geri yazıp girdinin boşluk-normalize hâliyle
karşılaştırma REDDEDİLDİ: yinelenen anahtarı yakalardı ama sayı biçimlerinde (`30.0` →
`JSON.parse` sonrası `30` olarak stringify edilir → round-trip eşitsiz ama belge GEÇERLİ),
üstel gösterimde (`3e1`), ve anahtar SIRASINDA (`{"a":1,"b":2}` vs `{"b":2,"a":1}` — anlamca
aynı, metince farklı) YANLIŞ POZİTİF üretirdi — brief'in "aşırı engelleme yok" ilkesini ihlal
eder. Elle yazılan tarayıcı bunların HİÇBİRİNE dokunmaz, yalnızca anahtar KİMLİĞİNE bakar.

### 9.4 Yeni/güncellenen testler ve mutasyon kanıtı

Taban 145 → **157 vaka**, hepsi geçiyor (sandbox: `scratchpad/verify-json-repo/`, CEO'nun
sondası `probe-json-guard.mjs` 14/14). Eklenen/güncellenen vakalar: D-DUP-KEY (P7b'nin birebir
regresyonu — artık HEM görünen HEM gizlenen ad reddediliyor, "sonuncusu kazanır" beklentisi
tersine çevrildi), D-DUP-KEY-CREATED-AT, D-DUP-KEY-VALID-MINUTES, D-DUP-KEY-NESTED,
D-DUP-KEY-STRING-DECOY (+ isim sızdırmama kontrolü), D-UNKNOWN-ROOT-KEY,
D-UNKNOWN-ROOT-KEY-APPROVED-BY (negatif kontrol), D-TRAILING-GARBAGE, D-MULTI-JSON-DOCS,
D-UNICODE-ESCAPED-KEY-SINGLE (negatif kontrol), D-UNICODE-ESCAPED-KEY-DUP, D-PROTO (güncellendi:
artık belgenin TAMAMI reddediliyor) + D-PROTO-ISOLATION (yeni, regresyon izolasyonu).

Üç mutasyon (`git checkout` KULLANILMADI — sandbox kopyasında elle uygulanıp elle geri alındı):

1. **Yinelenen-anahtar kontrolünü kaldıran mutasyon** (`scanForDuplicateKeys` çağrısı `if
   (false)` ile devre dışı) → **5 test KIRMIZI**: D-DUP-KEY/P7b, D-DUP-KEY-CREATED-AT,
   D-DUP-KEY-VALID-MINUTES, D-DUP-KEY-NESTED, D-UNICODE-ESCAPED-KEY-DUP.
2. **Bilinmeyen-kök-anahtar kontrolünü kaldıran mutasyon** (döngü boş diziye çevrildi) → **2
   test KIRMIZI**: D-UNKNOWN-ROOT-KEY, D-PROTO.
3. **İkisini birden geri alan mutasyon** (P7b düzeltmesinin TAMAMI, düzeltme-öncesi davranışın
   birebir eşdeğeri) → **7 test KIRMIZI** (yukarıdaki iki kümenin BİRLEŞİMİ — kesişim yok, bu iki
   kontrolün birbirinden bağımsız çalıştığını da doğruluyor).

Her mutasyon ayrı bir sandbox dosyasında (`scratchpad/mutation-work/mutA|B|C-gate-check.cjs`)
uygulandı, `verify-json-repo`'ya kopyalanıp ölçüldü, sonra kaynak taslaktan (`scratchpad/
gate-check-json.cjs`) yeniden kopyalanarak geri alındı — `git checkout`/`git restore`
KULLANILMADI (kayıtlı ders: mutasyon commit'siz iş üstünde yapılırsa checkout komşu değişiklikleri
de siler; bu turda dosyalar zaten yalnızca scratchpad'de olduğu için risk yoktu, ama disiplin
aynı şekilde uygulandı).

### 9.5 Kurulum sırası — DEĞİŞMEDİ

§6'daki sıra (önce `_selftest.cjs`, EN SON `gate-check.cjs`) bu turda da geçerli ve
DEĞİŞMEDİ — bu turun değişikliği yalnızca `gate-check.cjs`'in İÇ mantığını (parseGuardDoc)
güçlendiriyor, kurulum sırasının gerekçesi (PreToolUse hook'u diskteki `gate-check.cjs`'i çalışma
anında çalıştırır) aynen geçerli.

## 10. Kalan risk ve kabul edilen sınırlar

- **Saat kayması (§2.2):** wall-clock tabanlı süre kontrolü sistem saati geriye alınırsa
  atlatılabilir. Kabul edilen sınır — yerel tek-kullanıcı araç, ek yetki kazandırmıyor.
- **Zaman penceresi takası (§2.2):** tek onay, pencere boyunca kapsamdaki dosyalara **birden
  fazla** yazmayı yetkilendiriyor. Bilinçli takas — onay yorgunluğunu azaltmak için kabul edildi.
- **`.guard-state.json`'un sert engeli artık ölü kod gibi görünebilir** (hiçbir yol onu
  yazmıyor) ama savunma-derinliği için korunuyor; gelecekte biri bu dosyayı gerçekten
  kullanılmayan bir kalıntı sayıp kaldırabilir — o zaman bu karar metni referans alınmalı.
  Yeniden ele alınma eşiği: `.claude/hooks/**` üzerinde çalışan bir sonraki güvenlik turu.
- **(GÜNCEL DEĞİL, tarihsel not) Eski §3 kararı:** "Yinelenen `\"scope\"` anahtarı güvenlik
  açığı değil, görsel kafa karışıklığı" kararı P7b sondasıyla **çürütüldü** ve §9'da kapatıldı —
  yinelenen anahtar artık HER SEVİYEDE fail-closed. Bu madde yalnızca kararın nasıl değiştiğinin
  izini bırakmak için tutuluyor, güncel davranış §9.1'dedir.
- **`.claude/settings.json` dışında ".claude/" altında `.claude/agents/**`/`.claude/agent-memory/**`
  hâlâ serbest** (bu turun kapsamı dışı, mevcut tasarım korunuyor, değiştirilmedi).
- **(§9'dan taşındı) `__proto__` kök anahtarının reddi bir yan etki, birincil hedef değil.**
  Kapalı liste "gizli alan" saldırılarını kapatmak için eklendi; `__proto__`'nun da bu listede
  olmaması (dolayısıyla otomatik reddi) tasarım gereği değil `Object.keys` davranışının doğal
  sonucu. Gelecekte `__proto__`'ya özel bir istisna eklenmek istenirse (örn. "bilinen ama zararsız"
  sayılırsa) bu, kapalı listenin GEVŞETİLMESİ anlamına gelir ve dikkatle değerlendirilmeli.
- **Tarayıcının kendi implementasyon doğruluğu, test kapsamına bağlıdır.** §9.2'nin savunduğu
  "JSON grameri kapalı bir problem" iddiası, tarayıcının RFC'yi DOĞRU uyguladığını varsayar; bu,
  157 test vakası ve 3 mutasyonla ölçüldü ama resmi bir JSON test-suite'i (örn. json.org'un
  test kümesi) karşı çalıştırılmadı — küçük bir kalıntı risk (kabul edilen sınır, yerel
  tek-kullanıcı aracın tehdit modeline göre orantısız bulunuyor).

## 11. TUR 5 kapanışı — M1 (beyaz liste çiti) ve M2 (tarayıcı fail-open) düzeltmeleri

Kaynak: `docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md` (KARAR: KALDI — kod kalitesi 6/10,
tek gerekçe §1.5'teki M1 bulgusu; diğer dört sözleşme GEÇTİ, Y1 kapandı). Bu tur yalnızca iki
maddeyi kapatır; M1/M2 dışındaki 6 çitsiz nokta (§1.6'daki 17 noktanın geri kalanı) kapsam dışı
bırakıldı, CEO'ya eşikleriyle raporlandı (bkz. developer raporu).

### 11.1 M1 — beyaz liste kontrolü artık ölçülüyor

**Kök neden (§5 madde 1'in neden yanlış olduğu):** D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/
D-BACKSLASH/D-UNI vakalarının hepsi `HOOK_FILE`'a (`.claude/hooks/block-dangerous.cjs`) yazmayı
deniyor ama `scope`'a HOOK_FILE'dan FARKLI bir değer (`../evil.cjs`, `C:/Temp/evil.cjs`, vb.)
yazıyordu. Kapsam ÜYELİK kontrolü (`parsed.scope.has(relLower)`) TEK BAŞINA reddediyor — beyaz
liste (`normalizeScopeEntry`) tamamen kaldırılsa bile AYNI ŞEKİLDE reddederdi. Yani bu 6 test
YANLIŞ NEDENLE yeşildi.

**Düzeltme:** `_selftest.cjs`'e 6 AYIRT EDİCİ vaka eklendi (`D-WHITELIST-SUBDIR/EXT-MD/EXT-JSON/
SPACE/DOUBLE-EXT/NESTED`, gate-check.cjs'e dokunulmadı — mekanizma zaten doğruydu, yalnızca test
kapsamı eksikti). Her vakada `scope` elemanı YAZILMAK İSTENEN HEDEFİN KANONİK YOLUNA TAM OLARAK
EŞİT (kapsam-üyelik kontrolü GEÇER) ama beyaz liste BİÇİMİNE UYMUYOR (alt dizin, `.cjs` dışı
uzantı, boşluk, çift uzantı, iki seviyeli alt dizin) — QA'nın §1.5 raporundaki ayırt edici
sondanın birebir karşılığı:

| Vektör | `scope`=hedef | Kurulu kod | Mutasyon (`normalizeScopeEntry` kaldırılınca) |
|---|---|---|---|
| D-WHITELIST-SUBDIR | `.claude/hooks/sub/evil.cjs` | exit 2 | exit 0 (SIZINTI) |
| D-WHITELIST-EXT-MD | `.claude/hooks/notes.md` | exit 2 | exit 0 (SIZINTI) |
| D-WHITELIST-EXT-JSON | `.claude/hooks/config.json` | exit 2 | exit 0 (SIZINTI) |
| D-WHITELIST-SPACE | `.claude/hooks/evil file.cjs` | exit 2 | exit 0 (SIZINTI) |
| D-WHITELIST-DOUBLE-EXT | `.claude/hooks/evil.payload.cjs` | exit 2 | exit 0 (SIZINTI) |
| D-WHITELIST-NESTED | `.claude/hooks/a/b/c.cjs` | exit 2 | exit 0 (SIZINTI) |

**Ölçülen mutasyon kanıtı** (sandbox: `scratchpad/verify-json-repo/`):
- Kurulu kod (düzeltme sonrası): self-test **165/165 yeşil**, exit 0 (baz 157 + 6 M1 + 2 M2).
- `normalizeScopeEntry` mutasyonu (her dizeyi olduğu gibi kabul et) → **tam olarak 6 KIRMIZI**
  (yukarıdaki 6 vaka), diğer 159 vaka DEĞİŞMEDEN yeşil kalıyor — eski D-TRAVERSAL/D-ABS/D-UNC/
  D-LONGPREFIX/D-BACKSLASH/D-UNI vakaları hâlâ yeşil (üyelik kontrolü onları zaten karşılıyor,
  §5 madde 1'in düzeltilmiş metni budur).
- Mutasyon elle geri alındı (kaynak taslaktan yeniden kopyalama, `git checkout` KULLANILMADI) →
  165/165 yeşil, `diff` ile kaynakla bayt-bayt aynı doğrulandı.

**§5 madde 1'in düzeltilmiş metni:** *"Beyaz liste kontrolünü kaldıran mutasyon
(`normalizeScopeEntry` her dizeyi olduğu gibi kabul etsin) → `scope`'u YAZILMAK İSTENEN HEDEFİN
KANONİK YOLUNA EŞİT ama beyaz liste biçimine UYMAYAN 6 ayırt edici vaka (D-WHITELIST-*) KIRMIZI
verir (6/6); eski D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/D-BACKSLASH/D-UNI vakaları YEŞİL KALIR
(onlar kapsam-üyelik kontrolünü ölçer, beyaz listeyi değil — bu iki kontrol BAĞIMSIZDIR)."*

### 11.2 M2 — yinelenen-anahtar tarayıcısı artık MAX_GUARD_BYTES'ten bağımsız fail-closed

**Kök sorun (QA §1.3):** `scanForDuplicateKeys` özyinelemeli bir JS fonksiyonu; kendi JS çağrı
yığını sınırına (~5074 seviye, QA ölçümü) çarpınca `RangeError` fırlatıyordu ve
`parseGuardDoc`'taki `catch (_) { dup = null; }` bunu SESSİZCE yutuyordu (fail-open) — yani
yinelenen-anahtar koruması yalnızca `MAX_GUARD_BYTES`'in (8192 bayt, YALNIZCA DoS gerekçesiyle
seçilmiş) o derinliğe erişmeye YETMEMESİNE güveniyordu (emniyet payı ~1.26x).

**Düzeltme (`gate-check.cjs`):**
1. Yeni `MAX_SCAN_DEPTH = 200` sabiti: `scanForDuplicateKeys` artık hem OBJECT hem ARRAY iç içe
   geçmesinde artan AYRI bir `depth` sayacı tutuyor (eski `level` sayacı yalnızca object'lerde
   artıyordu — QA'nın gerçek sızıntı denemesi DİZİ iç içe geçmesiyle yapılmıştı, bir derinlik
   sınırı `level` üzerinden yazılsaydı dizileri hiç yakalamazdı). 200 seviyeyi aşan herhangi bir
   değer `{ __scanDepthExceeded: true }` işaretli bir hata fırlatır.
2. `parseGuardDoc`'taki catch artık AYRIŞTIRILDI: yalnızca tarayıcının KENDİ sözdizim hatası
   (`e.__scanErr`, örn. yarım kalmış bir dize) sessizce yutulur (JSON.parse zaten aynı belgeyi
   reddedecek). Bunun DIŞINDAKİ her şey (derinlik sınırı aşımı DAHİL, gerçek bir RangeError
   DAHİL) artık "tarayıcı çalışamadı" sayılır ve belge FAIL-CLOSED reddedilir — dosya SİLİNMEZ.

**Ölçülen kanıt 1 — üretim sabitleriyle, `_selftest.cjs`'e eklenen kalıcı regresyon testleri**
(sandbox: `scratchpad/verify-json-repo/`):
- (D-SCANNER-DEPTH-OK, negatif kontrol) 50 seviye iç içe `reason` → kabul, `MAX_SCAN_DEPTH`'in
  çok altında, aşırı engelleme yok. **YEŞİL.**
- (D-SCANNER-DEPTH-EXCEEDED) 400 seviye iç içe `reason` (~800 bayt — `MAX_GUARD_BYTES`'in (8192)
  ÇOK altında, yani boyut sınırı devreye GİRMEDEN önce derinlik sınırı KENDİ BAŞINA tetiklenir) →
  fail-closed. **YEŞİL** (düzeltmeyle).
- Mutasyon (eski `catch (_) { dup = null; }` geri getirildi, derinlik sınırı KORUNDU) →
  D-SCANNER-DEPTH-EXCEEDED **KIRMIZI** (belge artık kabul ediliyor, exit 0) — TEK bu test kırmızı
  verdi, diğer 164 vaka değişmeden yeşil kaldı. Mutasyon elle geri alındı, `diff` ile kaynakla
  bayt-bayt aynı doğrulandı.

**Ölçülen kanıt 2 — gerçek `RangeError` senaryosu, yalnızca kanıt amaçlı geçici bir prob kopyasıyla
(`scratchpad/g5-tur5-work/rangeerror-probe/`, TESLİM EDİLEN dosyaların parçası DEĞİL):**
`MAX_SCAN_DEPTH=Infinity` ve `MAX_GUARD_BYTES=200000` olarak geçici biçimde büyütülmüş bir
kopyada (yalnızca gerçek çağrı-yığını sınırına ulaşabilmek için — üretim sabitleri bu turda
DEĞİŞMEDİ), 8000 seviye iç içe dizi içeren bir `reason` (16098 bayt) ile:
- **Düzeltmeyle:** `scanForDuplicateKeys` gerçek bir `RangeError: Maximum call stack size
  exceeded` fırlatıyor, yeni catch bunu yakalayıp **fail-closed reddediyor** (exit 2, GUARD.ok
  SİLİNMİYOR, hata mesajı "tarayici gerekli kontrolu TAMAMLAYAMADIGI icin ... FAIL-CLOSED
  reddedildi" diyor).
- **Eski catch'e (`catch (_) { dup = null; }`) geri dönülünce, AYNI belge:** `JSON.parse`
  tarayıcının atladığı yeri sorunsuz ayrıştırıyor, belge GEÇERLİ sayılıyor, **exit 0 (KABUL)** —
  QA'nın bulduğu sınıfın canlı kanıtı. Üretimde bu senaryoya `MAX_GUARD_BYTES=8192` ile
  ulaşılamıyor (QA'nın B-1 notu, emniyet payı ~1.26x) — bu prob, düzeltmenin `MAX_GUARD_BYTES`'in
  DEĞERİNDEN gerçekten bağımsız olduğunu (yalnızca `MAX_SCAN_DEPTH`'e değil) doğrulamak için.

**Sonuç:** iki bağımsız katman var — (a) `MAX_SCAN_DEPTH=200`, üretim bayt sınırının ÇOK altında
kendi başına tetiklenen kasıtlı bir sınır, (b) catch'in kendisi, tarayıcının HANGİ nedenle
çalışamadığından bağımsız olarak fail-closed. B-1 borcu (QA §1.9) bu turda KAPANDI: koruma artık
`MAX_GUARD_BYTES`'in değerine gizlice bağımlı değil.

### 11.3 Doğrulama özeti (bu tur)

- Sandbox self-test (`scratchpad/verify-json-repo/`): **165/165 yeşil**, exit 0 (157 taban + 6 M1
  + 2 M2).
- CEO'nun bağımsız sondası (`scratchpad/probe-json-guard.mjs`), final `gate-check.cjs` ile:
  **14/14 GEÇTİ**, exit 0.
- Gerçek `docs/approvals/*` (G0–G4-2, 6 dosya) SHA-256'ları tur başı/sonu **değişmedi**;
  `git status --short` bu commit dışında temiz.
- `node --check` iki teslim dosyasında da temiz; ham NUL bayt sayısı iki dosyada da **0**.
- Yetim `node.exe` süreci bırakılmadı (tur sonu `tasklist` kontrolü: eşleşme yok).
- **Ayrıca bu turda düzeltildi:** bu dosyanın (§9.1 madde 6) 2026-09-10 turundan kalma HAM bir NUL
  baytı (kaçış dizisi taşıma sırasında oluşmuş, CLAUDE.md'nin kayıtlı "kaçış dizisi tuzağı"
  dersiyle aynı sınıf) metinsel bir açıklamayla değiştirildi — dosya artık `git`'in ikili
  sayacağı bir bayt içermiyor.

### 11.4 Teslim dosyaları

- `scratchpad/gate-check-m2.cjs` → hedef `.claude/hooks/gate-check.cjs` (M2 fix; M1 için kod
  değişikliği YOK, mekanizma zaten doğruydu).
- `scratchpad/selftest-m1.cjs` → hedef `.claude/hooks/_selftest.cjs` (M1 + M2 test vakalarının
  ikisini de içerir — tek `_selftest.cjs` hedefi olduğu için).
- Kurulum sırası serbest (brief §5, token artık zaman pencereli, yazma başına tükenmiyor) — yine
  de önerilen sıra: önce `_selftest.cjs`, sonra `gate-check.cjs` (§6'daki gerekçe hâlâ geçerli:
  PreToolUse hook'u diskteki `gate-check.cjs`'i çalışma anında çalıştırır).
