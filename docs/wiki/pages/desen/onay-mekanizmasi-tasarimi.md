---
type: desen
updated: 2026-09-16
sources: [docs/qa/G5-guvenlik-denetimi-2026-09-10.md, docs/qa/G5-guvenlik-denetimi-2026-09-10-tur2.md, docs/qa/G5-guvenlik-denetimi-2026-09-10-tur3.md, docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md, docs/qa/G5-guvenlik-denetimi-2026-09-10-tur5.md, docs/qa/G5-sozlesme-kararlari-2026-09-10.md, docs/qa/G5-sozlesme-kararlari-2026-09-10-tur2.md, docs/qa/G5-sozlesme-kararlari-2026-09-10-tur3.md, docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md, docs/qa/G5-sozlesme-kararlari-2026-09-10-tur5.md, docs/qa/g5-guard-json-contract.md, docs/qa/g5-tur5-kapsam-ve-selftest-contract.md, docs/decisions/ADR-016-onay-dosyalarinin-korunmasi.md, docs/approvals/G5.ok, docs/approvals/G6.ok, docs/blockers.md, docs/progress.md]
---

# Onay mekanizması tasarımı — kullanıcı onayına dayanan güvenlik kapıları

Bir sistemde "kullanıcı onayladı mı?" sorusuna dayanan her kapı (izin kartı, tek kullanımlık
token, onay dosyası) çit tasarımından (bkz. [[desen/cit-tasarimi]]) ayrı bir problem sınıfı
taşır: buradaki tehdit modeli "kod yanlış mı" değil, **"kararı gerçekten kullanıcı mı verdi"**dir.
Bu sayfa Mission Control'ün G5 (güvenlik/kalite) kapısında — altı denetim turu ve sekiz sözleşmede
— **ölçülmüş** sekiz dersi topluyor; hepsi bu depoya özgü dosya adlarıyla kanıtlanmış ama dersin
kendisi taşınabilir. İlgili: [[desen/cit-tasarimi]] [[hata/claude-code-arac-tuzaklari]].

## 1. İlk soru "bu onayı kim yazabilir?" olmalı, mekanizmayı sertleştirmek ikinci sıradadır

Bir yetkilendirme mekanizması bir onay **artefaktına** (dosya, token, kayıt) dayanıyorsa, o
artefaktın **yazılabilirliği** mekanizmanın kendisinden daha temel bir sorudur. Artefaktı
kim/ne yazabiliyorsa, sistemin gerçek anahtarı odur — mekanizmanın geri kalanı ne kadar
sofistike olursa olsun.

**Ölçülmüş vaka:** Mission Control'ün tüm kapıları (`G0.ok`…`G6.ok`, `GUARD.ok`, `DANGER.ok`,
`PUSH.ok`) `docs/approvals/` altındaki dosyaların varlığına dayanıyordu. G5 denetiminin üçüncü
turu, hook'un kendi "serbest" yol listesinin (`gate-check.cjs`, `free` dizisi) `^docs\//i` deseniyle
**`docs/` dizininin tamamını** serbest bıraktığını buldu — yani `docs/approvals/` da dahil,
barındırılan bir oturum kendi onay dosyasını sıfırdan yazabiliyor, mevcut bir onayın kapsamını
tüketilmeden önce genişletebiliyor, ya da `.guard-state.json`'ı elle düzenleyip "tüketildi"
yalanını söyleyebiliyordu (`docs/qa/G5-guvenlik-denetimi-2026-09-10-tur3.md` §0.1,
`docs/decisions/ADR-016-onay-dosyalarinin-korunmasi.md`). Bu bulguya kadar yapılmış **bütün**
sertleştirme (kapsam ayrıştırma, token tüketimi, self-test) anlamsızdı — kapı, kendi anahtarını
üretebilen bir aktöre karşı kapı değildi.

**Çözüm deseni (üç bağımsız katman, `ADR-016`):** (A) artefakta yazma harness'in kendi izin
sistemine `ask` olarak devredilir (hook sessizce izin vermez), (B) kabuktan artefakta yönelik
yazma/silme bir kara liste ile sert engellenir (derinlik katmanı), (D) harness'in kendi
`permissions.ask` kuralı ikinci, bağımsız bir "sor" sinyali ekler. Üç katman da **aynı** temel
soruyu farklı yüzeylerden kapatıyor: artefaktı yalnızca kullanıcının kendi onay tıklaması
yazabilsin.

**Genel kural:** bir yetkilendirme mekanizması tasarlarken ilk adım mekanizmanın mantığını
(kapsam kontrolü, tekrar kullanım engeli, süre sınırı) sağlamlaştırmak değil, "bu onayı taşıyan
artefaktı kim yazabilir?" sorusuna eksiksiz cevap vermektir. Bu soru cevapsızsa geri kalan her
sertleştirme, üzerine inşa edildiği zemin çökük olduğu için değersizdir.

## 2. Serbest metinden makine kararı çıkarma, üç yamada da yenilir — kaynağı kaldır

İnsan tarafından okunan/yazılan bir belge (gerekçe, açıklama, yorum) aynı zamanda **makinenin
karar verdiği** bir alanı da taşıyorsa, o alanı metinden çıkarma denemesi neredeyse her zaman
kazanılamaz bir oyundur — insan diline "nerede biter" sınırı koymak, insan dilini taklit etmekten
daha kolay değildir.

**Ölçülmüş vaka:** `GUARD.ok`'un kapsamı (hangi dosyaların yazılabileceği), onay belgesinin insan
için yazılmış serbest metninden okunuyordu. Üç ayrı düzeltme, üç ayrı turda yenildi:

| Tur | Mekanizma | Nasıl yenildi |
|---|---|---|
| 1 | Metnin tamamındaki ters tırnaklı adlar | Gerekçede "bu KAPSAM DIŞI" diye açıkça reddedilen bir ad bile kapsama giriyordu |
| 2 | `## Kapsam` başlığından bir sonraki `##`'a kadar olan blok | Başlıksız kuyruk düzyazı, `# h1`, `**kalın**` sözde-başlıklarla blok sınırı taklit edilebiliyordu |
| 3 | Başlıktan hemen sonraki kapalı biçimli liste maddeleri | **Başlık kimliğinin devralınması**: kullanıcının yazdığı `## Kapsam (2 dosya)` birebir `## Kapsam` ile eşleşmediği için başlık sayılmıyor, belgenin **başka bir yerindeki** (arşiv alıntısı, kod bloğu örneği) birebir `## Kapsam` satırı kimliği devralıyordu — sonuç onaylanan iki dosyanın reddedilmesi, "kapsam dışı" denen bir arşiv dosyasının kabul edilmesiydi |

(`docs/qa/G5-sozlesme-kararlari-2026-09-10.md`, `-tur2.md`, `-tur3.md`; `docs/blockers.md`
"Y1 üç turda kapanmadı".)

**Çözüm — dördüncü yama değil, kaynağın değiştirilmesi:** Kullanıcı kararıyla `GUARD.ok` markdown
olmaktan çıkıp bir JSON belgesi oldu; kapsam yalnızca `scope` alanından okunuyor, gerekçe/açıklama
alanı **hiçbir zaman** taranmıyor, beyaz listeye uymayan tek bir eleman tüm kapsamı geçersiz
kılıyor (`docs/qa/g5-guard-json-contract.md`). Bu, deponun kendi kayıtlı dersinin ("aynı çit
ikinci kez yenildiyse desen ekleme, tasarımı değiştir", bkz. [[desen/cit-tasarimi]] §1) üçüncü
tekrarda tetiklenmiş hâli.

**Genel kural:** bir belge hem insana açıklama hem makineye girdi taşıyorsa, makinenin okuduğu
kısmı **yapısal olarak ayrık** bir alana (ayrı bir alan, ayrı bir dosya, sabit şemalı bir bölüm)
koy — aynı serbest metnin bir alt kümesini "biçimsel olarak" ayırmaya çalışma. Aynı sınıf ikinci
kez yenildiyse üçüncü bir yama denemeden kaynağı değiştir.

## 3. Kayıpsız ayrıştırma zorunluluğu — JSON'a geçmek tek başına yetmez

Serbest metni yapısal bir formata (JSON, YAML) taşımak §2'yi kapatır ama yeni bir varsayımı
gün yüzüne çıkarır: seçilen ayrıştırıcının **kendisi** veri kaybetmiyor mu?

**Ölçülmüş vaka:** `JSON.parse`, ECMA-404/RFC 8259 gereği yinelenen anahtarlarda **sessizce
sonuncuyu alır** — bu bir hata değil, standart. Yani bir `GUARD.ok` belgesi iki kez `"scope"`
anahtarı taşırsa, belgeyi okuyan bir insan (veya basit bir görüntüleyici) ilkini görebilirken
`JSON.parse` ikincisini yetkilendirir — aynı §2 sınıfının yeni kılığı: belge bir şey gösterir,
makine başkasını uygular. Kapatma yolu `JSON.parse`'a **ek olarak** çalışan, kendi başına
özyinelemeli bir ham-metin tarayıcısıydı (`scanForDuplicateKeys`) — ama bu tarayıcının kendisi de
`JSON.parse`'dan **daha gevşek** davranırsa (ör. derin iç içe belgede `RangeError` ile erken
patlayıp devre dışı kalırsa) aynı sınıf üçüncü kez açılabilirdi; bu risk açık derinlik sınırı ve
ayrıştırılmış `catch` mantığıyla kapatıldı, bağımsız bir oracle'la (bkz.
[[desen/cit-tasarimi]] §7) doğrulandı.

**Genel kural:** makineye giden kararı taşıyan bir formata geçerken "bu ayrıştırıcı/format
sessizce veri düşürür mü (yinelenen anahtar, üstel gösterim, aşırı derinlik, BOM/kontrol
karakteri)?" diye sor. Standart kütüphanenin "doğru" davranışı (`JSON.parse`'ın son-değer-kazanır
kuralı gibi) senin tehdit modelin için **yanlış** davranış olabilir.

## 4. Kullanıcıya karar verdiren yüzey, gösterdiğinden farklısını yapmamalı

Bir onay ekranının/kartının **tüm** güvenlik varsayımı "kullanıcı gördüğünü onaylıyor" ise, o
yüzeyin gösterdiği ile arka planda gerçekleşecek olan **birebir aynı** olmak zorundadır. Aksi
hâlde altındaki bütün katmanlar (izin sistemi, kara liste, ADR'ler) tek bir kusurla çürür.

**Ölçülmüş vaka:** Kullanıcıya gösterilen izin kartının komut önizlemesi (`buildInputPreview`)
500 karakterde kırpılıyordu; ama onaylandığında SDK'ya giden ve gerçekten çalışan komut
**kırpılmamış tam hâliydi**. Kısa komutlarda bu görünmüyordu (kart tamdı) ama payload 500
karakterlik zararsız bir dolgunun **arkasına** gizlenirse kullanıcıya hiçbir iz görünmüyordu —
"kullanıcı komutu okur, sonra onaylar" garantisi, komut 500 karakteri geçtiği an **yanlış** hâle
geliyordu; bu, o güne kadar bulunan HTTP-yolu ve Katman-B-atlatma bulgularının **teorik**ten
**pratiğe** geçmesini sağlayan çarpandı (`docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md`
§4-Ek3). Kapatma yolu kırpmayı **kaldırmak** oldu; sert bir üst sınır aşılırsa sessizce kesmek
yerine açık bir uyarı gösterilip onay düğmesi devre dışı bırakılıyor (`docs/approvals/G5.ok`
"Kapanan kritikler" madde 3).

**Genel kural:** bir onay yüzeyi bir teknik zorunluluktan (uzunluk, performans) dolayı gösterimi
kısaltmak zorundaysa, kısalan kısmı **sessizce** atma — ya sınırı kaldır, ya "tam metin
gösterilemiyor" deyip onayı devre dışı bırak. Gösterilenle yapılacak olan arasındaki her fark,
üstündeki tüm güvenlik varsayımlarını geçersiz kılabilecek bir çarpandır.

## 5. Onay yorgunluğu kapıyı öldürür — onayın birimi "bir değişiklik" olmalı, "bir yazma" değil

Tek kullanımlık onayın (token) tüketim biriminin ne olduğu, kapının kendi var olma gerekçesini
(onay yorgunluğunu önlemek) doğrudan etkiler.

**Ölçülmüş vaka:** Token her **yazmada** tüketiliyordu; bir dosyanın iki kez düzenlenmesi
gerektiğinde ortada bitiyor, yeni onay isteniyordu. Bunun somut maliyeti G5'in kendi Y1
düzeltmesinde ölçüldü: **tek bir güvenlik düzeltmesi beş ayrı kullanıcı onayı** harcadı
(`docs/blockers.md` "2026-09-10 — onayın birimi"). Kullanıcıyı art arda onaya alıştırmak, onay
yorgunluğu üretir — ve onay yorgunluğu zaten bu kapının **birincil** var olma gerekçesiydi
(kullanıcının okumadan onaylamayı öğrenmesini önlemek). Yani kapı, kendi tasarımıyla kendi
gerekçesini çürütüyordu.

**Kapatma yolu:** tüketimi **zaman penceresine** bağlamak — bir kullanıcı onayı, aynı kapsam
içinde pencere boyunca **birden fazla** yazmayı yetkilendirir. Bu, deponun kod yorumlarında ve
belgelerinde "tek kullanımlık" ifadesinin artık **yanlış** bir zihinsel model taşıdığı anlamına
geliyor; bu ifadeyi güncellemek ayrı bir eşikli borç olarak kaydedildi
(`docs/blockers.md` B-3).

**Genel kural:** bir onay/token tasarlarken "bir kullanıcı onayı kaç işlemi kapsıyor?" sorusuna
baştan cevap ver. Birim "bir dosya yazması" gibi çok dar seçilirse, kapı gerçek kullanım
altında kullanıcıyı arka arkaya onaya zorlar ve bu, kapının kendisini gevşetme baskısı üretir.

## 6. Güvenlik testi, koruduğu şeyi tahrip etmemeli

Bir güvenlik mekanizmasının kendi doğruluğunu sınayan test/self-test, gerçek/canlı bir onay
durumuyla karşılaştığında o durumu **bozmamalıdır** — özellikle süreç kuralı bu testi rutin
bakımın bir parçası olarak (hook değiştikten sonra "her zaman" çalıştır diye) tanımlıyorsa.

**Ölçülmüş vaka:** `_selftest.cjs`, kendi doğrulama akışının bir parçası olarak gerçek
`docs/approvals/GUARD.ok` (ve `PUSH.ok`/`DANGER.ok`) dosyalarını **siliyordu** — kullanıcının
henüz tüketmediği, gerçek bir onayı ayrım yapmadan yok ediyordu
(`docs/qa/g5-tur5-kapsam-ve-selftest-contract.md` "Y3 neden var"). Süreç kuralı ise tam olarak
bu testi hook değişikliğinden sonra çalıştırmayı **zorunlu** kılıyordu — yani korumanın kendisi,
rutin kullanımda korunanı yiyordu.

**Kapatma yolu (iki bağımsız katman):** (1) **emniyet kemeri** — betik başka hiçbir şey
yapmadan önce çağıranın gerçek `process.cwd()`'sindeki onay dosyalarından biri var mı diye
bakar; varsa net bir hata mesajıyla `process.exit(3)` verir, hiçbir dosyaya dokunmadan durur;
(2) **sandbox izolasyonu** — testin kendisi izole bir geçici dizinde koşar, gerçek `docs/
approvals/`'a hiç değmez. İkisi ayrı ayrı mutasyon testiyle doğrulandı (pending onay varken
self-test → exit 3, dosya içeriği birebir aynı kalıyor; pending yokken → normal 106/106).

**Genel kural:** kalıcı bir artefaktın (onay dosyası, kayıt defteri, kullanıcı verisi) yolunu
kullanan her test ya (a) tamamen izole bir çalışma alanında koşmalı, ya da (b) gerçek artefakt
mevcutsa **hiçbir şeye dokunmadan** reddedip durmalı. "Test rutin bakımın parçası, her zaman
çalıştır" kuralı, testin kendisinin **güvenli** olduğu varsayımına dayanır — bu varsayım ayrıca
doğrulanmalı.

## 7. Kapatmadan önce ölçekte ve izole doğrula

Bir güvenlik sınırını değiştiren aday, gerçek dosyalara/hook'lara uygulanıp "artık iyi görünüyor"
denmeden önce, izole bir ortamda ve büyük ölçekte sınanabiliyorsa sınanmalı — küçük elle yazılmış
birkaç vakayla "GEÇTİ" demek, bu depoda tekrar tekrar yetersiz çıktı.

**Ölçülmüş vaka:** G5'in JSON tasarımı kapanış turunda (tur 5), aday önce gerçek dosyalara
dokunmadan, depo dışı bir **aynada** (mirror) kuruldu; adayın yinelenen-anahtar tarayıcısı
**180.582 belgelik** bir korpusla ve yalnızca geçerli JSON üreten hedefli bir fuzz'la üretilen
**8.979.165** ek belgeyle (toplam ~9,16 milyon) CPython'un bağımsız ayrıştırıcısına karşı
sınandı; sıfır fail-open ölçüldü (bkz. [[desen/cit-tasarimi]] §7 — bağımsız oracle detayı).
Aynı disiplin bir tur önce (tur 4) daha küçük ölçekte de işe yaramıştı: kurulu aday, henüz
"GEÇTİ" almadan, yük taşıyan bir kontrolün (`normalizeScopeEntry`) sıfır test kapsamına sahip
olduğu ortaya çıktığı için **KALDI** aldı (`docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md`
§1) — yani "kurulu kod çalışıyor" ölçümü tek başına yeterli sayılmadı, sözleşmenin kendi kabul
kanıtı sorgulandı ve yanlış çıktı.

**Genel kural:** güvenlik sınırını değiştiren bir adayı üretime/gerçek dosyalara uygulamadan önce
(a) izole bir kopya/ayna üzerinde saldırı sondaları çalıştır, (b) mümkünse ölçeği büyüt (binlerce
değil milyonlarca vaka, fuzz), (c) sözleşmenin kabul kanıtını **bağımsız** biri (farklı bir
denetçi turu) yeniden sorgulasın. Küçük elle yazılmış birkaç vakanın yeşil vermesi, adayın hazır
olduğu anlamına gelmez.

## 8. Aşırı engelleme de bir güvenlik kusurudur

Bir kapının yanlış-pozitif maliyeti sıfır değildir; "güvenli tarafta kal, gerekirse fazla
engelle" tutumu, kullanıcıyı kapıyı gevşetmeye iten bir baskı üretir — bu da nihayetinde kapının
kendisinin sökülmesiyle sonuçlanabilir.

**Ölçülmüş vaka:** `block-dangerous.cjs`'in komut taraması (Katman B, tüm komutu tek metin
olarak tarayan bir kara liste) aynı gün **yedi kez** masum bir işi kilitledi (CEO'da üç, QA'da
dört) — biri salt-okunur bir listeleme çağrısıydı, sonuncusu ise **tam olarak bu olayı anlatan
düzeltme metninin kendisiydi** (`docs/blockers.md` B-6, `docs/qa/G5-sozlesme-kararlari-2026-09-10-tur5.md`
§0). Bu bir atlatma değildi — kapı doğru yönde hata yapıyordu — ama token deneme-yanılmaya
dayanmadığı için (bkz. §5) her yanlış pozitif kullanıcıyı kapıyı gevşetmeye iten gerçek bir
baskı üretiyordu.

**Genel kural:** bir kapı tasarlarken yalnızca "kaç gerçek saldırıyı yakaladı"yı değil, "kaç
meşru işi kilitledi"yi de ölç ve kaydet. Yanlış pozitif oranı yüksekse (bu depoda tek bir günde
yedi kez), "güvenli taraf" savunması yeterli değildir — kapı, kendi maliyetiyle kendi geleceğini
tehlikeye atıyor demektir; mesaj/kapsam iyileştirmesiyle (ör. hangi biçimin kabul edildiğini
açıkça söylemek) bu maliyet düşürülmeli.

## 9. Derinlik katmanını sertleştirmeden önce ön kapının kapalı olduğunu ölç — bu ders YEDİ tura mal oldu

`block-dangerous.cjs` (metin tarayıcısı, bkz. [[desen/cit-tasarimi]] §9) yedi turda v0'dan v6'ya
sertleştirildi; her tur gerçek bir sızıntı ailesini kapattı. Sekizinci tura girmeden önce
qa-evaluator geri çekilip **ön kapıyı** ölçtü: `.claude/settings.json`'daki `Bash(npm run *)` izni,
`package.json`'un korumasız olmasıyla birleşince **bütün hook hattını anlamsız kılıyordu** —
`package.json`'a bir script yazıp `npm run evil` çalıştırmak hook'tan **exit 0** aldı,
`docs/approvals/G5.ok` **ve** `.claude/hooks/gate-check.cjs` silindi, sahte bir `GUARD.ok` yazıldı,
**tek bir izin kartı çıkmadan** (B5). `npm run` yolu kapatıldıktan sonra (allowlist:
`package.json`'daki gerçek 22 script adı, `install-hook` bilerek dışarıda; `package.json` ve
`.claude/**` `ask` listesine alındı) **ikinci, daha derin** bir aynı-sınıf açık ölçüldü:
`Write(src/**)` + `Bash(node *)` birlikte yine **sıfır izin kartıyla** tam yetki veriyordu — tek bir
`node src/tools/fmt.mjs` çağrısı `G5.ok`'u sildi, `gate-check.cjs`'i `process.exit(0);` yaptı **ve
sahte bir `GUARD.ok` yazdı**.

**Sonuç — `ADR-016`'nın 2026-09-15 güncellemesi:** *"asıl savunma kullanıcının izin kartıdır"*
öncülü **kısmen yanlıştı**; kart her zaman çıkmıyordu. Hook hattının konumu yeniden yazıldı:
**hook hattı bir KAZA ÖNLEYİCİDİR, bir SALDIRI ÖNLEYİCİ DEĞİLDİR.** Yanlışlıkla yazılmış bir komutu,
bir alt agent'ın dikkatsizliğini, kopyala-yapıştır bir zinciri yakalar; kasıtlı ve bilgili bir
aktöre karşı (yerel, kabuk erişimli bir agent tanımı gereği öyledir) **mutlak koruma yoktur ve
olamaz.** `Bash(node *)` **bilerek kapatılmadı** — arka planda koşan alt agent turları sonda/teşhis
betiklerini bu izinle çalıştırıyor, kaldırmak üretim hattını kilitler; `Write(tests/**)` +
`Bash(npm run test)` de aynı gerekçeyle (bir kod fabrikasının doğası) açık bırakıldı. Bunlar
**bilinçli, ölçülmüş tavizler** olarak `ADR-016`'ya yazıldı, gizlenmedi. G6 onayı bu açık kalan 24
canlı vektörü + izin açığını bilerek kabul edip yayına geçti (`docs/approvals/G6.ok`).

**Genel kural:** yedi turluk bir metin-tarayıcı sertleştirme kampanyasına girmeden önce (ya da
içindeyken, her turda) *"bu derinlik katmanı atlanabiliyor mu ve atlamanın maliyeti nedir?"* diye
sor ve **ölç** — izin sistemi/harness seviyesindeki bir açık varsa, kod-seviyesi tarayıcının
marjinal değeri sıfıra yakındır. Kayıtlı "bir kapı, kendi anahtarını üretebilene karşı kapı
değildir" kuralının izin-listesi hâli.

## 10. Güvenlik turlarının gizli maliyeti aşırı engellemedir — her turda ölç

Bir güvenlik hattını sertleştirirken kazanılan her "sızıntı kapandı" zaferinin görünmeyen bir
maliyeti vardır: gerçek iş akışını ne kadar kilitlediği. Bu ölçülmezse "daha güvenli" diye giderek
kullanılamaz bir hat kurulur.

**Ölçülmüş vaka:** v5 (beyaz liste, kutupluluk çevrildi) 34 komutluk gerçekçi bir iş-akışı
korpusunda **5/34 (%14,7)** yanlış pozitif üretti — `if`/`cd` gibi "eylemsiz" kabuk sözcüklerini
okuyucu listesine almanın bedeliydi. v6 (yazma-konumu analizi) **aynı korpusta 0/34 (%0,0)** ölçtü;
v5'in getirdiği iş akışı maliyeti tamamen geri alındı, güvenlik kazanımı (3640/3640, 0 regresyon)
korunarak (bkz. [[desen/cit-tasarimi]] §9). Aynı gün Katman B'nin komut taraması **yedi kez** masum
bir işi kilitledi (üçü CEO'da, dördü QA'da) — biri salt-okunur bir listeleme çağrısı, sonuncusu
**tam olarak bu olayı anlatan düzeltme metninin kendisiydi** (bkz.
[[hata/claude-code-arac-tuzaklari]] "korunan komut adını anan her metin").

**Genel kural:** her sertleştirme turunun kabul kriterine, gerçekten kullanılan komutlardan oluşan
bir **yanlış pozitif korpusu** ve sayısal bir üst sınır koy; korpus hayali olmasın, o oturumda
fiilen çalıştırılan komutlardan derlensin. Bir mekanizmanın "kaç saldırıyı yakaladığı" kadar "kaç
meşru işi kilitlediği" de sözleşmenin kabul kanıtı olmalı.

İlgili: [[desen/cit-tasarimi]] [[hata/claude-code-arac-tuzaklari]] [[desen/app-factory-hatti]] [[hata/olcum-kirliligi]]
