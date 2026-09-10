---
status: done
karar: GEÇTİ (docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md). Bu sözleşmenin mekanizması (kapalı biçimli liste maddeleri) sonradan JSON tasarımıyla yürürlükten kalktı; karar mekanizmaya değil, sözleşmenin çözmeyi vaat ettiği kusurun bugün kapalı olmasına dayanıyor.
---

# G5 Tur 5 — Y1 kapsam sızıntısı, tur 2 (kapalı biçim / beyaz liste düzeltmesi)

Kaynak: `docs/qa/G5-sozlesme-kararlari-2026-09-10-tur2.md` §2 (Y1, KALDI/BLOKLAYICI). Bu turun
tek işi bu bulguyu kapatmaktır. Y3 aynı raporda GEÇTİ aldı, bu turun kapsamı dışındadır. §3.4'teki
eşikli borç (katmanların kendi pozitif kontrolü yok) bu turda düzeltilmiyor, §5'te eşiğiyle
kayda geçiriliyor.

## Bu düzeltme neden var (tek cümle)

`GUARD.ok`'un kapsam bloğu "bir sonraki `##` başlığına ya da dosya sonuna kadar" tanımlandığı
için, o bloğun **nerede bittiğini** başlığa benzeyen HERHANGİ BİR ŞEY (başlıksız kuyruk düzyazı,
`# Gerekçe` h1, `**Gerekçe**` kalın sözde-başlık) belirleyebiliyordu — QA canlı bir CEO onay
metniyle, açıkça "kapsam dışıdır" diye reddedilen iki dosyanın sessizce (exit 0, kart yok)
yetkilendirildiğini gösterdi.

## Neden bu ikinci tur (sınıf uyarısı)

Bu çit **ikinci kez** yeniliyor; ikisi de aynı aile: "kodun/metnin nasıl biçimlendiği" sayılıyor.
`CLAUDE.md`'nin kayıtlı dersi ve QA'nın §2.5'i aynı şeyi söylüyor: desen eklemek (`#{1,}` da
başlık say, kalın satırı da başlık say...) dördüncü bir varyantla yenilir. Bu yüzden bu turda
**"nerede biter" sorusunu tamamen terk ediyoruz** ve **"hangi satırlar kapsam SAYILIR" sorusuna**
geçiyoruz (QA §2.5 Seçenek A: "kapalı biçim dayatması").

## Yeni mekanizma — adıyla

`parseGuardScope()` artık blok SINIRINI aramıyor. Bunun yerine:

1. `## Kapsam` başlığı tam olarak bir kez geçmeli (yok / >1 kez → fail-closed, davranış aynı).
2. Başlıktan sonra gelen satırlar sırayla taranır; **boş satırlar şeffaftır** (atlanır, hiçbir
   veri taşımadıkları için tarama onlardan etkilenmez).
3. İlk **boş olmayan** satır bir **liste maddesi** (`^\s*[-*]\s+...`) DEĞİLSE: kapsam boş
   döner (fail-closed) — "başlıktan hemen sonra liste gelmiyorsa" durumu budur.
4. Liste maddesi bulunduğunda, madde işaretinden sonraki içerik **KAPALI BİÇİME** uymak
   ZORUNDADIR: satırın tamamı (baştaki `-`/`*` ve boşluk hariç) tam olarak `` `ad.cjs` `` gibi
   **TEK bir backtick-alıntılı belirteçten** ibaret olmalıdır. Uymuyorsa (ör. içinde başka
   düzyazı, iki ad, "Not:" gibi ek metin varsa) → **TÜM kapsam** geçersiz sayılır ve boş küme
   döner (yalnızca o satır değil, o ana kadar toplanan adlar da dahil — belirsizlik her zaman
   sıfır erişime çözülür).
5. Liste maddesi OLMAYAN ilk boş-olmayan satırda tarama durur — o satırın başlık/kalın/tablo/
   yatay çizgi/düzyazı olması ÖNEMSİZDİR, çünkü hiçbiri liste maddesi değildir. Bu, "başlığa
   benzeyen şey" oyununu yapısal olarak bitirir: kalan metin hiç ayrıştırılmıyor.
6. Toplanan her belirteç önceki filtreden geçer (`^[\w-]+\.cjs$` ya da tam
   `.claude/settings.json`); uymayanlar sessizce hiçbir şey eklemez (kapsamı bozmaz, sadece o
   maddeyi katkısız bırakır).

## Karar noktaları (brief §3, gerekçeli)

- **Liste bloğu içindeki boş satırlar → tarama devam eder.** Blank satırlar hiçbir belirteç
  taşımadığından atlanması güvenlidir; sızıntı riski yalnızca "boş olmayan ama liste-dışı"
  satırlardan gelir, onlar zaten yukarıdaki 5. maddeyle durduruluyor.
- **Bir madde satırında birden fazla backtick'li ad → ARTIK DESTEKLENMİYOR.** Önceki sürüm
  `` `a.cjs` ve `b.cjs` `` gibi tek satırda çoklu adı kabul ediyordu; bu turda KAPALI BİÇİM
  kuralı bunu bilerek reddeder (satır "tam olarak tek belirteç" değilse tüm kapsam geçersiz).
  Gerekçe: çoklu-ad + bağlaç ayrıştırması ekstra bir yüzey açar ("ve", virgül, "and"...) ve
  QA'nın az önce yendiği sınıfın aynısı; bunun yerine CEO her dosya için ayrı bir madde yazar —
  yazması bir satır, okuması tek bakışta doğrulanabilir.
- **İç içe/girintili liste maddeleri → kabul edilir.** Regex baştaki boşluğa bakmaz; girinti
  güvenlik anlamı taşımaz, yalnızca biçim tercihidir; reddetmek gereksiz aşırı-kısıtlama olurdu.
- **Başlıktan hemen sonra liste gelmiyorsa (araya düzyazı girmişse) → boş kapsam.** Zaten 3.
  maddenin doğrudan sonucu.
- **Bir madde satırı KAPALI BİÇİME uymuyorsa (ör. "- Not: `x.cjs` kapsam dışıdır" gibi bir
  DIŞLAMA notu madde işaretiyle yazılmışsa) → TÜM kapsam geçersiz, o ana kadar toplanan geçerli
  adlar da dahil.** Bu, brief'in sormadığı ama sandbox'ta bulduğum yeni bir sızıntı adayıydı:
  eğer yalnızca o satırı atlayıp taramayı bitirseydik, önceki geçerli maddeler kabul edilirdi
  ve CEO'nun "bu madde bir dışlama notu, kapsam değil" niyeti korunurdu — ama bu, madde-biçimi
  içinde serbest metne izin vermenin ilk adımı olurdu. Fail-closed yönünde karar: biçimi bozan
  HERHANGİ bir liste maddesi belgeyi bütünüyle geçersiz kılar. Test: (y1t2-h).
- **Mevcut korunan davranışlar bozulmadı:** tek `## Kapsam` başlığı zorunlu (aynı), harf/boşluk
  varyantları tanınır (aynı, `kapsamHeaderRe` değişmedi), blok boşsa fail-closed (aynı sonuç,
  artık "liste hiç başlamadı" yoluyla).

## Geriye dönük uyum — CEO'nun bundan sonra nasıl yazması gerektiği

`_selftest.cjs`'in `writeGuardScope()` yardımcı fonksiyonu ŞU AN her dosya adını backtick'e alıp
**tek bir düzyazı satırında** `" ve "` ile birleştiriyordu (`` `a.cjs` ve `b.cjs` ``, madde
işareti YOK). Bu, yeni kapalı biçimle **artık geçersiz bir GUARD.ok** üretir (tüm kapsam boş
döner). `writeGuardScope()` bu turda her ad için ayrı bir madde satırı üretecek şekilde
güncelleniyor.

CEO onay metni artık şöyle yazılmalı (tek örnek):

```
## Kapsam

- `gate-check.cjs`
- `block-dangerous.cjs`

## Gerekçe

Y1 kapsam sınırı düzeltmesi, tur 2. `_selftest.cjs` bu değişiklikte YER ALMIYOR — bilerek,
kapsam dışı bırakıldı.
```

Yalnızca `## Kapsam` başlığının **hemen ardından**, madde işaretiyle (`-` veya `*`) başlayan ve
her satırda **tek** backtick'li dosya adı taşıyan satırlar kapsam sayılır. Gerekçe bölümünde
geçen hiçbir ad (kapsamda olsun olmasın) hiçbir zaman ayrıştırılmaz — CEO orada istediği kadar
dosya adı anabilir, güvenlik kararını etkilemez.

## Test planı

`_selftest.cjs`'e eklenecek/güncellenecek vakalar (sandbox'ta geliştirilip doğrulanacak, gerçek
dosyaya CEO kuracak):

1. Mevcut **106** vaka yeşil kalmalı. `y1-a/b/c/f/g` fixture'ları düz satırdan madde-satırına
   (`` `x.cjs` `` → `` - `x.cjs` ``) çevrilecek çünkü eski biçim artık geçersiz — yorum bunun
   NEDENİNİ (biçim kapalı hale geldi) açıkça belirtecek. `y1-d`, `y1-e`, `y1-h` fixture'ları
   davranışsal olarak değişmiyor (zaten fail-closed bekleniyordu), gerekirse kozmetik güncelleme.
2. QA'nın üç sızdıran sondası birebir (G2/G3/G4 aile): kuyruk düzyazı, `# Gerekçe` (h1),
   `**Gerekçe**` (kalın) → hepsi kapsam DIŞI adı reddeder, kapsam İÇİ adı hâlâ kabul eder ve
   tüketir.
3. QA'nın gerçekçi CEO belgesi senaryosu birebir → iki "kapsam dışı" dosya reddedilir, tek
   "kapsam içi" dosya kabul edilir ve token tüketilir.
4. Regresyon: `### Gerekçe` (h3) sonrası ad hâlâ reddedilir (önceki sürümde bu zaten
   çalışıyordu, yeni mekanizmayla da çalıştığını kilitle).
5. Negatif kontrol (aşırı engelleme yok): girintili/iç içe madde satırı kabul edilir; liste
   bloğu içindeki tek bir boş satır taramayı bitirmez, sonraki madde de kabul edilir.
6. Yeni sızıntı adayı: madde-biçimindeki bir dışlama notu (`- Not: ...kapsam dışı: \`x.cjs\``)
   TÜM kapsamı geçersiz kılar — daha önce kabul edilecek geçerli bir ad bile artık reddedilir.
7. Çoklu-ad-tek-satır artık desteklenmiyor: `` - `a.cjs` ve `b.cjs` `` → tüm kapsam geçersiz.

## Mutasyon kanıtı (zorunlu, ikisi de)

- **M-A:** Yeni liste-tabanlı sınırı kaldırıp eski "bir sonraki `##`'ya kadar" mantığına
  dönen bir mutasyon → hangi vakalar KIRMIZI verdiği sayısıyla raporlanacak.
- **M-B:** Düzeltmeyi birebir ESKİ hâline (tur-1 sürümü, `blockEnd`/`anyHeaderRe`) döndüren
  mutasyon → QA'nın üç sondasının + gerçekçi CEO belgesi senaryosunun KIRMIZI olduğu
  gösterilecek. Her iki mutasyon da sandbox'ta, `git checkout`/`restore` KULLANILMADAN elle
  geri alınacak.

## Eşikli borç (bloklayıcı DEĞİL, bu turda düzeltilmiyor)

QA §3.4: Y3'ün iki koruma katmanı (emniyet kemeri + sandbox izolasyonu) kendi başına ölçülmüyor
— bekleyen onay yokken biri sökülse `_selftest.cjs` yine 106/106 verir. **Eşik:** bu, katmanın
SESSİZCE ölmesi anlamına gelir ve deponun en pahalı hata sınıfıdır. Kalıcı çözüm QA'nın önerdiği
gibi `_selftest.cjs`'i alt süreç olarak çalıştırıp sahte-bekleyen-onayla exit 3'ü VE dosya
bütünlüğünü ayrı ayrı assert eden bir vaka eklemek (kendi dosyasını dışlamayı unutmadan — fork
bomb dersi). Bu turun kapsamını büyütmemek için düzeltilmiyor; CEO `docs/blockers.md`'ye
işleyecek.

## Kabul kriteri

- Sandbox'ta güncellenmiş `_selftest.cjs` 106 + yeni vakaların TAMAMI yeşil, exit 0.
- QA'nın üç sondası + gerçekçi CEO belgesi artık reddediliyor (çıkış kodu 2, `.guard-state.json`
  dokunulmamış/token tüketilmemiş).
- İki mutasyon kanıtı (M-A, M-B) sayılarıyla raporda.
- Gerçek `docs/approvals/*` ve `.claude/hooks/*` dosyalarına bu tur boyunca hiç yazılmadı; SHA-256/
  MD5 tur başı = tur sonu.
