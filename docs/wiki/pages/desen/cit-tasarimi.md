---
type: desen
updated: 2026-09-10
sources: [docs/qa/F-009-2026-09-09.md, docs/qa/F-009-2026-09-09-tur2.md, docs/qa/F-009-2026-09-09-tur3.md, docs/qa/F-011-2026-09-10.md, docs/qa/F-011-2026-09-10-tur2.md, docs/qa/F-011-2026-09-10-tur3.md, docs/qa/F-011-2026-09-10-tur4.md, docs/qa/F-011-2026-09-10-tur5.md, docs/qa/F-011-2026-09-10-tur6.md, docs/qa/F-011-2026-09-10-tur7.md, docs/qa/test-skip-gate-2026-09-10.md, docs/qa/test-skip-gate-contract.md, docs/decisions/ADR-013-yazma-uclarinda-ozel-baslik-zorunlulugu.md, CLAUDE.md]
---

# Çit tasarımı — güvenlik/bütünlük testlerini (mutasyon testiyle) kırılmaz yapma

Bir "çit" (fence) — sızıntıyı, izinsiz yazmayı, ağ erişimini veya sessiz veri kaybını engellemesi
beklenen bir yapısal test/guard — yazmak kolaydır; onun **gerçekten** ölçtüğünü kanıtlamak zordur.
Bu sayfa Mission Control'ün Faz 2 kapanışında (F-008, F-009, F-011, "vitest sessiz test atlama
çiti" altyapı işi) **ölçülmüş** altı dersi topluyor. Hepsi mutasyon testiyle (çiti kırıp KIRMIZI
görüp görmediğini ölçmek) elde edildi — "41 test geçiyor" gibi bir sayı hiçbirinde tek başına
kanıt sayılmadı. İlgili: [[hata/claude-code-arac-tuzaklari]] [[desen/app-factory-hatti]].

## 1. Kara liste vs beyaz liste

Bir çit "bunlar yasak" (denylist/kara liste) diye kurulursa, saldırı yüzeyi = "henüz akla
gelmemiş her şey". "Bunlar hariç her şey yasak" (allowlist/beyaz liste) diye kurulursa, saldırı
yüzeyi = "izin verilen kümenin kendi kaçakları" — çok daha küçük bir küme.

**Ölçülmüş vaka:** Mission Control'ün transkript gizlilik çiti (`transcripts-privacy-guard.test.ts`)
önce bir kara liste olarak yazıldı: Windows yol deseni, sabit "ilgisiz proje" listesi, 200 karakter
eşiği. QA turu 1'de 12 sızdıran sonda (Türkçe kişisel metin, POSIX/UNC/`%USERPROFILE%` yol
biçimleri, JSON anahtarı olarak gizli veri, parçalanmış uzun metin, listede olmayan proje adı)
yazıldı — **12/12 çitten yeşil geçti** (`docs/qa/F-009-2026-09-09.md` B1). Düzeltme turunda kara
liste genişletildi (özyinelemeli tarama, ham satır metni, daha fazla yol biçimi) ve genişletilmiş
kara liste bir kez daha 12 yeni vektörle test edildi — **11/12 yine geçti** (e-posta, telefon,
Kiril/CJK metin, ROT13, `.gitattributes` muafiyetinin dosya adına değil yola bağlı olmaması;
`docs/qa/F-009-2026-09-09-tur2.md` Y1). Ancak `git commit ffe436c` ile mekanizma **denylist'ten
allowlist'e** çevrildi (yalnızca sabit bir onaylı-sözcük kümesindeki metinlere izin ver, geri
kalan her şeyi ihlal say). Kapanış turunda aynı sınıf vektörlerin (21 yeni sonda) **hiçbiri**
okunabilir Türkçe/İngilizce prompt metni geçiremedi; kalan kaçaklar yalnızca teorik bit-taşıma
kanallarıydı (≤3 haneli gruplara bölünmüş sayı, tek harf + iki nokta deseni, tokenizer'ın charset
dışı sayması) — pratik sızıntı sıfırlandı (`docs/qa/F-009-2026-09-09-tur3.md` Y1).

Aynı ilkenin bağımsız bir emsali `ADR-013`'ün eki: `POST /api/events` ucunun `Content-Type`
kontrolü **allowlist** olarak tasarlandı (yalnızca `application/json` kabul), çünkü QA denylist
alternatifini ölçtü — denylist olsaydı `multipart/form-data` gibi CORS-güvenli bir tip preflight'ı
atlayıp gövdesi JSON olmasa bile isteği geçirirdi.

**Genel kural:** bir güvenlik/gizlilik çiti "yasaklı desenler" listesi olarak kuruluyorsa, ilk
mutasyon turunda muhtemelen yenilecektir — liste her zaman eksiktir. Mümkünse allowlist'e çevir;
mümkün değilse (ör. rastgele metin içinde her şeyi yasaklı sayamazsın), her yeni sonda turunda
listenin büyümesini **beklenen** bir maliyet olarak planla, tek turda "kapandı" deme.

## 2. Sözdizimi analizi vs davranış gözlemi

Bir çit "hangi kodun yazıldığına" (statik/sözdizimi analizi: regex, AST, import grafiği) bakarak
karar veriyorsa, her zaman "aynı yeteneği farklı yazma biçimi" ile yenilebilir. Bir çit "kod
çalışırken ne yaptığına" (davranış/çalışma zamanı gözlemi: gerçek API çağrısını yakalamak)
bakıyorsa, sözdizimi ne olursa olsun aynı davranışa düşer.

**Ölçülmüş vaka — F-011'in ağ çiti (`hiçbir ağ isteği atılmaz` garantisi), sırasıyla dört
mekanizmada yenildi:**

1. **Dizge/regex taraması** (`no-external-host.test.ts`, yalnızca `http(s)://` metin
   literallerini arıyor) — `http.get(...)`, `net.connect(...)`, `dns.lookup(...)`,
   `execFileSync('curl', ...)` gibi URL literali içermeyen çağrıların **6/8'i** bu taramayı hiç
   görmedi (`docs/qa/F-011-2026-09-10.md` Ö5).
2. **Modül-adı whitelist'i + regex tabanlı statik import taraması**
   (`network-capability-guard.test.ts`, yalnızca `import … from '<spec>'` biçimini görüyor) —
   önceki 8 vektörün 8'i de kapandı, ama `export { get } from 'node:http'` (sıradan bir
   re-export, gizleme yok) taramanın hiç bilmediği bir sözdizimiydi ve ürün kodunun gerçek
   giriş noktasından **canlı bir HTTP isteği** çıkardı, 1295/1299 test yeşilken
   (`docs/qa/F-011-2026-09-10-tur3.md` X1).
3. **AST tabanlı statik tarama** (`export … from` ailesi dahil) — bu ailenin tamamı kapandı, ama
   bu kez çözücünün **`.mts`/`.cts`/`.js`→`.ts` eşlemesini bilmemesi** yeni bir kaçış açtı:
   mevcut bir import'a yalnızca `.js` uzantısı eklemek, o dosyanın **tüm alt grafiğini**
   taramadan düşürdü ve içine konan ağ çağrısı görünmez oldu, `npm run verify` tamamen yeşil
   kalırken (`docs/qa/F-011-2026-09-10-tur4.md` §2.3).
4. **Çalışma zamanı davranış gözlemi** (sentinel — `net`/`http`/`https`/`tls`/`dns`/`fetch`/
   `WebSocket`'in modül nesnelerini kuşatıp gerçek çağrıyı kaydetmek) — bu katman devreye
   girdikten sonra **hiçbir yeni sözdizimsel biçim çiti bir daha yenmedi**: `export … from`,
   `.js` uzantı kaçışı, şablonlu `import()`, `globalThis['fet'+'ch']`, `new WebSocket(...)` gibi
   21 farklı yazım denendi ve **21'i de KIRMIZI verdi** (`docs/qa/F-011-2026-09-10-tur5.md` §1,
   §3). Davranış gözlemi devreye girdiği turdan sonra kalan üç tur (5→6→7) artık yeni bir
   sözdizimi aramadı; tartışma tamamen **mekanizmanın kendi ölçülebilirliğine** kaydı (bkz. §3).

**Genel kural:** bir yetenek (ağ erişimi, dosya yazma, dış süreç başlatma) "hangi API çağrılırsa
çağrılsın aynı çalışma zamanı ilkesine düşer" özelliğine sahipse (ör. Node'da her ağ yolu
sonunda `net.connect`'e düşer), sözdizimi taramasında ısrar etmek yerine o ortak noktayı
kuşatan bir davranış gözlemcisi yaz. Sözdizimi taraması hâlâ değerlidir (erken uyarı, daha
okunaklı hata mesajı) ama **birincil** savunma olarak sunulmamalı.

## 3. Her çitin kendi pozitif kontrolü olmalı

Bir çit "mutasyonu yakalıyor" demek başka, "çitin **kendisi** çalışıyor mu" diye ayrı bir test
olması başka. İkincisi olmadan, çit sessizce devre dışı kalabilir ve hiçbir test bunu fark etmez.

**Ölçülmüş vaka — aynı bulgu iki farklı katmanda üst üste tekrarladı (F-011):**
- Round 5'te: sentinel katmanının `patch()` fonksiyonunu tamamen no-op yapan bir mutasyon
  (`M7`) **52/52 test yeşil** bıraktı — dosyada sentinel'in kasıtlı olarak tetiklenip
  yakalandığını iddia eden **tek bir pozitif test bile yoktu** (`docs/qa/F-011-2026-09-10-tur5.md`
  §2.1). Düzeltme: sentinel kuruluyken `http.get`/`new WebSocket`/`globalThis.fetch` kasten
  çağrılıp `calls` dizisinin doluluğunun iddia edilmesi (~10 satır); bu mutasyonu KIRMIZI yaptı.
- Round 6-7'de: sentinel'in kendisi bir üst katmanla (`process.binding`'i modül yüklenmeden önce
  yakalayan "precapture" sarmalayıcı) güçlendirildi ve **bu yeni katman için de** aynı boşluk
  çıktı: sarmalayıcının kayıt satırını silen mutasyon (`P1`) veya sarmalamayı hiç yapmayan
  mutasyon (`P2`) **54/54 test yeşil** bıraktı ve 26 gerçek TCP bağlantısı sızdırdı
  (`docs/qa/F-011-2026-09-10-tur7.md` §2.4). QA bunu bloklayıcı saymadı çünkü brief'in ölçütü
  "modül yerindeyken pratik sızıntı" idi ve modülün kendisi mutasyona uğratılmıştı — ama borç
  olarak aynı düzeltmeyi (~6 satırlık pozitif kontrol) gerektirdiğini açıkça kaydetti.

**Genel kural:** her yeni savunma katmanı eklendiğinde, o katmanın **kendi modülünü** hedefleyen
bir mutasyon (katmanı tamamen devre dışı bırak) ayrıca koşturulmalı. "Katman X'in mutasyonu
katman Y'yi kırdı" bir kanıt değildir; "katman X'in kendi devre-dışı-bırakma mutasyonu katman
X'in testini kırdı" kanıttır.

## 4. Kaskad kırmızı ≠ her nokta ölçülüyor

Büyük bir mutasyon (bir bütün mekanizmayı etkisizleştirmek) çok sayıda testi kırmızı yapabilir;
bu, mekanizmanın **alt parçalarının her birinin** ayrı ayrı çitli olduğu anlamına gelmez.

**Ölçülmüş vaka:** F-009'un beyaz liste çitinde, "onaylı token kontrolünü tamamen etkisizleştir"
mutasyonu 54 testin **35'ini** kırmızıya çevirdi — kaskad etkisiyle güçlü bir sinyal gibi
görünüyor. Ama yedi alt deseni (BARE_NUMBER, ISO_TIMESTAMP, SYNTHETIC_UUID, SEMVER, DRIVE_LETTER,
MSG_ID, COLON_LITERAL) **tek tek** gevşeterek test ettiğimizde, üçü (BARE_NUMBER, ISO_TIMESTAMP,
SYNTHETIC_UUID) tek başına kırmızı verirken **dördü (SEMVER, DRIVE_LETTER, MSG_ID, COLON_LITERAL)
54/54 yeşil kaldı** — yani kaskad testi yalnızca "her şey birden bozulursa" senaryosunu
ölçüyordu, yedi deseninin dördünün **kendi başına** hiç çitli olmadığını gizliyordu
(`docs/qa/F-009-2026-09-09-tur3.md` Y2). DRIVE_LETTER'ın gevşetilmesi özellikle tehlikeliydi:
iki nokta ile biten her sözcüğü onaylı sayacak kadar geniş bir açık bırakıyordu.

**Genel kural:** bir mekanizma N bağımsız alt-desen/alt-kontrolden oluşuyorsa, "mekanizmayı
tamamen kapat" mutasyonu N testin kaçının kırıldığını göstermek için yeterli değildir — her
alt-deseni **tek başına** gevşeten N ayrı mutasyon koşturulmalı. Kaskad kırmızı bir üst sınır
verir ("en fazla bu kadarı çitli"), alt sınırı vermez.

## 5. İç tutarlılık vs dış referans

Bir bütünlük çiti yalnızca "raporlanan sayılar kendi içinde tutarlı mı" diye bakıyorsa (ör.
kategori toplamları genel toplama eşit mi), veri kaynağının **tamamı** aynı oranda küçülürse çit
hiçbir şey fark etmez — çünkü iç tutarlılık hâlâ sağlanıyordur. Dış, bağımsız bir referansla
(diskteki gerçek dosya sayısı, bağımsız bir sayaç) karşılaştırma olmadan "hepsi hesaba katıldı"
iddiası kanıtlanamaz.

**Ölçülmüş vaka:** Mission Control'ün test-atlama çiti (`scripts/verify-test-run.mjs`) vitest'in
kendi özet satırındaki kategori toplamının (`passed + skipped`) parantez içi toplamla eşleştiğini
kontrol ediyordu — bu, "bir dosya çökme sırasında yarım kaldı" sınıfını gerçekten yakaladı (canlı
bir worker çökmesinde üç sinyal de doğru tetiklendi, `docs/qa/test-skip-gate-2026-09-10.md` §2).
Ama bir test dosyası **komut satırından `--exclude` ile tamamen düşürüldüğünde**, vitest'in
kendi raporu iç tutarlıydı (`1307/1311`, toplam kendi içinde eşit) ve çit **hiçbir şey
söylemedi**: 1 dosya + 16 test buharlaştı, `npm run test` çıkış kodu **0** döndü (B1a). Aynı
teknikle **52 dosya / 685 test — suite'in %52'si** sessizce düşürüldüğünde de sonuç aynıydı
(B1b). Kapatma yolu iç tutarlılık kontrolünü **güçlendirmek değil**, ona **dış bir referans**
eklemekti: `vitest.config.ts`'in `include`/`exclude` desenlerini dosyadan okuyup diskteki gerçek
test dosyası sayısını `readdirSync` ile numaralandırmak ve vitest'in raporladığı dosya sayısıyla
karşılaştırmak (`docs/qa/test-skip-gate-contract.md` madde 2b). Bu depoda aynı desen daha önce
iki kez bağımsız olarak keşfedilmişti: `tests/build-css.test.ts` taranacak kaynak dizinlerini
dosya sisteminden numaralandırıyor, `e2e-config-guard` da E2E spec dosyalarını disk üzerinden
sayıp her birinin bir Playwright config'inde geçtiğini doğruluyor.

**Genel kural:** "toplamlar kendi içinde tutarlı" bir çit, veri kaynağının **tamamının** aynı
oranda küçülmesine karşı kördür. Bütünlük iddiası taşıyan her sayaç için, sayının geldiği
kümenin **bağımsız bir yerden** (dosya sistemi, harici bir araç, önceden bilinen bir sabit)
doğrulanıp doğrulanmadığını sor.

## 6. Mimari sınır çizmek

Süreç-içi bir davranış gözlemcisi (monkey-patch), ilke olarak, **kendisinden daha erken**
değerlendirilmiş bir kodun aynı yeteneğe erişip orijinal referansı saklamasına karşı savunmasızdır
— bu bir kusur değil, matematiksel bir sınırdır. Bu sınırı kovalamaya devam etmek yerine, sınırı
**bilinçli olarak nerede çizdiğini** yazılı hâle getirmek gerekir; aksi hâlde "sertleştirme"
süreci hiç bitmez ve her tur yeni bir "daha erken yakalama" vektörü bulur.

**Ölçülmüş vaka:** F-011'in ağ çitinde, round 5-6'da art arda "sentinel kurulmadan önce global
bir referansı yakala" biçimli vektörler bulundu (`process.binding`'i modül yüklenirken
saklamak → sentinel hiç göremiyor, 111 gerçek TCP+HTTP isteği sessizce gitti). Round 7'de bu
sınıf, sentinel'den **daha önce** çalışan bir "precapture" katmanıyla kapatıldı (test dosyasının
ESM değerlendirme sırasında **ilk** import'u yapıldığı için ürün modülünden önce çalışıyor).
QA bu noktada, "precapture'dan önce yakalama gerektiren bir varyant var mı?" sorusunu **bilinçli
olarak aramadığını** ve bunun bir bulgu değil, **kabul edilmiş bir mimari sınır** olduğunu
gerekçesiyle yazdı: precapture, test dosyasının ilk satırı olduğu için ürün kodu yüzeyinde ondan
önce çalışan hiçbir nokta kalmamıştı; kalan tek nokta test çalıştırıcısının kendi katmanıydı
(vitest `setupFiles`, Node yükleyici kancası) — ve oraya kod koyabilen bir aktör zaten tüm test
altyapısını değiştirebilir, yani bu yol artık "ürün kodunun savunması" kapsamının dışına çıkar.
Tam koruma ancak işletim sistemi düzeyinde izolasyonla (ağsız kum havuzu, güvenlik duvarı)
sağlanır; yerel, tek kullanıcılı bir araç için bu orantısız sayıldı ve üç katmanlı savunma
derinliği (AST statik tarama + çalışma zamanı sentinel'i + modül-yükleme-zamanlı precapture)
yeterli kabul edilerek karar **GEÇTİ**'ye döndü (`docs/qa/F-011-2026-09-10-tur7.md` §4, §7).

**Genel kural:** bir savunma katmanını "daha erken yakalama" sınıfına karşı sonsuza kadar
güçlendirmek mümkün değildir. Sınırı bul (ör. "test dosyasının ilk import'u", "işlemin ilk
satırı"), o sınırın **ötesinin** kimin sorumluluğunda olduğunu (test altyapısı, işletim sistemi,
dağıtım ortamı) yazılı olarak kaydet ve kararı buna göre ver — sessizce "yeterince iyi" deyip
geçme, gerekçeyi belgeye yaz ki bir sonraki QA turu aynı sınırı tekrar keşfetmeye çalışmasın.

İlgili: [[hata/claude-code-arac-tuzaklari]] [[desen/app-factory-hatti]]
