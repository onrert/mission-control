---
name: statik-cit-denetimi
description: Statik guard/çit testlerini denetleme yöntemi — AC'nin kanıt cümlesini teste karşı doğrula, çitin kendi muafiyetlerine mutasyon at, desen listesini aile bazında sızdır
metadata:
  type: feedback
---

Bir feature'ın kabul kriteri "statik tarama testi doğrular" diyorsa, o cümleyi **teste karşı**
doğrula — F-006 kod turunda iki bloklayıcının ikisi de buradan çıktı.

1. **AC'nin "Kanıt:" satırındaki dosya adını aç ve o testin gerçekten o iddiayı ölçüp
   ölçmediğine bak.** F-006'da AC3 ("silme işlevi yok") kanıt olarak `no-write-gate-bypass.test.ts`
   gösteriyordu; o test `write-gate.ts`'i **dosya-seviyesinde muaf tutuyordu** (tek istisnası).
   Yani AC'nin çiti taradığı kümede hiç yoktu. AC5 ("statik tarama testi doğrular") için ise
   böyle bir tarama hiç yazılmamıştı. İkisi de tek `grep` ile ortaya çıktı.
2. **Çitin MUAFİYETİNE mutasyon at, çitin kendisine değil.** Muaf dosyaya gerçek bir yetenek ekle
   (F-006: `setFeatureStatus` içine `fs.unlinkSync(targetPath)`) → 539/539 yeşil kaldı. Developer'ın
   mutasyonları hep taranan tarafı hedefler; muaf taraf hiç sınanmaz.
3. **Desen listesini AİLE bazında sızdır, tek desen bazında değil.** Liste `writeFileSync(`,
   `writeFile(`, `writeSync(` içeriyorsa `fs.write(fd,…)`, `fs.writev(`, `fs.writevSync(`
   ailenin geri kalanıdır ve kaçar. `fs.open(p,'w',cb)` + `fs.write(fd,…)` tam işlevsel bir
   yazma yoludur. Ayrıca listede **nesne-önekli tek bir desen** varsa (`'fs.rm('`) o desen
   `fsp.rm(`/`promises.rm(` ile atlanır — F-005 D28 dersinin birebir tekrarı.
   Yöntem: 8-10 satırlık gerçek çağrı parçacığını taranan bir dosyaya sırayla ekle,
   yalnızca o test dosyasını koştur, tabloyu rapora yaz.

**Why:** Statik çit "yazıldı" ile "iddia ettiği şeyi tarıyor" arasındaki fark, feature'ın
deliverable'ının kendisi olduğu durumlarda (AC7 gibi) doğrudan AC ihlalidir; ve yanlış güven
üretir — sonraki tur "guard var" diye bakmaz.

**How to apply:** Guard içeren her feature'da üç adımı da koş; kanıtı "mutasyon → test sayısı →
yeşil/kırmızı" tablosu olarak ver. Bkz. [[kod-turu-kontrolleri]] madde 6, [[duzeltme-turu-kontrolleri]]
madde 19.

4. **"Mimari fazlalık" savunmasını KABUL ET ama bedelini yazdır.** F-006'da developer'ın
   "yeşil kalan 3 mutasyon fazlalıktır" iddiası ölçümle **doğrulandı** (adım 2+3+6 aynı anda
   kaldırıldığında bile adım 8 tüm junction saldırılarını reddetti). Doğru tepki iddiayı çürütmeye
   çalışmak değil, (a) birleşik mutasyonu gerçekten koşmak, (b) developer'ın **gerekçesinin**
   doğru olup olmadığına bakmak (onunki "geometrik imkânsızlık"tı; gerçek neden
   `path.relative`'in kök referanslı olmasıydı), (c) "bu katmanların sıfır bağımsız test
   kapsaması var" cümlesini rapora koymak.

5. **Düzeltme turunda KALAN kaçakların şiddetini ADR'nin kendi kabul cümlesine göre kalibre et,
   sonra ikinci savunma hattını AMPİRİK olarak sına.** F-006 fix1'de 9 eski kaçağın 9'u da
   kapanmıştı ama 7 yeni biçim kaçtı. Şiddeti belirleyen üç şey oldu: (a) ADR-005'in
   "Sonuçlar/riskler" bölümü statik guard'ın `fs['write'+'File']` gibi **dolaylı çağrıları
   yakalamadığını adıyla kabul ediyordu** — ADR'de yazılı kabul edilmiş sınır BLOKLAYICI
   sayılamaz, aksi hâlde çit hiçbir zaman geçemez; (b) kaçan biçimleri **doğal** (kaza sınıfı:
   `import fsPromises from 'node:fs/promises'` + `fsPromises.rm(`) ve **kasıtlı gizleme**
   (`const w = fs.writeFileSync`) diye ayırmak; (c) **kaçan biçimle gerçek bir mutasyon yazıp
   ikinci savunma hattının (manifest testi) onu yakaladığını ölçmek** — yakalıyorsa NOT, yakalamıyorsa
   bloklayıcı. Ayrıca çitin *neden* daraltıldığına bak: F-006'da belirsiz adların (`write(`, `open(`)
   alıcıya bağlanması zorunluydu, çünkü `src/`'te meşru `process.stderr.write(` var — gevşetme
   talebi yanlış pozitif üretirdi. Bunu rapora yaz, yoksa sonraki tur "listeyi genişlet" der.

**Why:** Kapsam daraltarak geçirmek kadar, imkânsız bir bütünlük standardı dayatıp sonsuz tur
açmak da hatadır; ADR'nin yazılı kabul sınırı + ölçülmüş ikinci savunma hattı bu iki hatanın
arasındaki tek savunulabilir çizgidir.

6. **Kaynak-şekli (statik metin) çitini iki mutasyon BİÇİMİYLE birden sına: SİLME ve YORUMA ALMA.**
   F-009 tur 2'de M10 için konulan `expect(source).toMatch(/relFromRootRaw.startsWith/)` çiti,
   satırlar silinince KIRMIZI verdi ama aynı satırlar yorum işaretine alınınca (metin dosyada
   duruyor, koruma tamamen yok) 51/51 YEŞİL kaldı. Üçüncü biçim daha da ucuz: regex'i memnun eden
   bir TUZAK satır bırakıp gerçek kontrolü değiştirmek (M11) — yine yeşil, ve ölçülen davranış
   değişti. Dördüncüsü ters yönde: zararsız bir yeniden adlandırma çiti KIRMIZI yapıyor
   (yanlış pozitif). Kural: metin tabanlı her çitte dört ölçümü de koştur (sil / yoruma al /
   tuzak satır / eşdeğer yeniden yazım) ve tabloyu rapora koy.
7. **"Davranışla ayırt edilemez, o yüzden statik çit koydum" gerekçesini ÇÜRÜTMEYE çalış — genelde
   çürür.** F-009'da iki kapsama kontrolü için iddia edilmişti; iki senaryo bir dakikada ayırt etti:
   (a) kökün DIŞINDA ve VAR OLMAYAN aday → temiz kod 'outside-root', mutant 'not-found' (ön kontrol
   kalkınca akış dosya-varlığı kontrolüne düşüyor); (b) kökün kendisi bir bağlantı/junction
   üzerinden veriliyor → temiz kod 'outside-root', mutant ok:true. Yöntem: redde GEREKÇE kodu
   (reason) döndüren bir guard'da kesin-reason testleri zaten varsa aynı tekniği KALAN katmanlara
   uygula; her yol guard'ında "var olmayan yol" ve "kökün kendisi bağlantı üzerinden" varyantlarını
   dene.
8. **Metin tarayan gizlilik/sızıntı çitlerinde taramanın KAPSAMINI kelime kelime oku.** F-009 çiti
   yalnızca (i) çift tırnak arasındaki parçaları tarıyor ve (ii) beyaz liste kontrolünü yalnızca
   BOŞLUK İÇEREN dizgelere uyguluyordu. Sonuç üç serbest kanal: tırnaksız dosyalar (md/txt/nokta
   ile başlayanlar) tüm serbest-metin katmanından muaf; boşluksuz her dizge (e-posta, telefon,
   alt çizgili ad, satır sonu kaçışıyla ayrılmış kelimeler, ROT13) muaf; kaçışlı tırnak tek/çift
   parça hizalamasını kaydırıp içeriği görünmez yapıyor. Şiddeti GERÇEK veri kümesinde bu
   biçimlerin sıklığını sayarak kalibre et (F-009: 638 satırda e-posta biçimi, 282 satırda tek
   sayıda kaçışlı tırnak) — "teorik açık" ile "haftada bir gerçekleşecek açık" farkı budur.
9. **Markdown BÖLÜM SINIRINA dayanan ayrıştırıcıyı, "sonraki bölüm yoksa ne olur" ile yen.**
   G5 tur-2'de onay kapsamı ayrıştırıcısı düzeltildi: kapsam artık yalnızca `## Kapsam`
   başlığının bloğundan okunuyor, blok "bir sonraki `##` başlığına **ya da dosya sonuna**"
   kadar. Sözleşme "bölümden sonraki ad artık yapısal olarak imkânsız" diye kabul yazmıştı.
   22 sondanın 19'u tuttu, **3'ü sızdırdı** ve üçü de aynı boşluktan: sonraki bölüm `##` ile
   BAŞLAMIYORSA blok dosya sonuna kadar uzuyor ve o metni kapsam sayıyor —
   (a) başlıksız kuyruk düzyazı ("Not: `x.cjs` bu listeye dahil değildir"),
   (b) `# Gerekçe` (h1 — `###` güvenli yönde çalışıyordu, `#` düşünülmemişti),
   (c) `**Gerekçe**` kalın psödo-başlık.
   Kontrol listesi: başlık ÖNCESİ metin · başlık SONRASI ama sonraki başlıktan önce ·
   sonraki başlık h1/h3/kalın/başlıksız · aynı satırda içerik · iki nokta ekli başlık ·
   kod bloğuna gömülü sahte başlık · CRLF.
   **Gerçekçilik testi zorunlu:** sentetik sondalar "kenar durum" diye küçümsenir; hedef
   biçimde **gerçek bir belge** yaz (bu turda: tarih + onaylayan + `## Kapsam` listesi +
   altına "bu dosya kapsam dışıdır" notu) ve sızıntıyı onunla göster — itiraz kalmaz.

**Why:** Metin ŞEKLİ sayan çitler bu depoda beş kez yenildi; bölüm sınırı da bir şekil
sayımıdır, yalnızca daha ince. "Sonraki sınırlayıcı yoksa sona kadar" varsayımı her
sınır-tabanlı ayrıştırıcının kör noktası.

**How to apply:** Bir düzeltme "artık yalnızca X bölümünü okuyor" diyorsa, X'in BİTİŞ
koşulunu sorgula; bitiş "dosya sonu"na düşebiliyorsa en az üç farklı sonraki-bölüm biçimi
dene. Yama yerine kapalı biçim iste (yalnızca `- <ad>` satırları kabul, başka içerik →
fail-closed) — bkz. [[kod-turu-kontrolleri]] beyaz liste dersi.
