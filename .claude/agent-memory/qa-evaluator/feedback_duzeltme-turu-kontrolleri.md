---
name: duzeltme-turu-kontrolleri
description: Dar düzeltme turu QA'sında zorunlu kontroller — brief'in öncülünü doğrula, önceki turda YEŞİL kalan mutasyonları tekrar dene, düzeltmenin görünür kıldığı yeni tutarsızlığı ara
metadata:
  type: feedback
---

Dar "düzeltme turu doğrulaması" briefinde şu üç kontrol her seferinde iş çıkardı:

1. **Brief'in öncülünü kodda doğrula.** F-002 fix1 turunda brief "gün dosyası adı yerel tarihe
   göre üretiliyor" diyordu; kod aslında `toISOString()` ile **UTC** kullanıyordu. Öncülü
   doğrulamadan analiz yazsaydım rapor yanlış olurdu.
2. **Önceki turda YEŞİL kalan mutasyonları birebir tekrar uygula.** "Test eklendi" demek
   ölçüyor demek değil; yeni testi değil, eski çiti kırarak dene.
3. **Düzeltmenin görünür kıldığı davranışı ara.** Süreç eskiden çöktüğü için gözlemlenemeyen
   yollar, düzeltmeden sonra ilk kez gözlemlenebilir olur (F-002: 503 dönen olay ring'de kalıp
   `GET /api/events`'te hayalet olarak görünüyor).

4. **Dosyadaki bölüm SIRASINA bak.** Developer düzeltme yanıtı, sonradan eklenen bir CEO
   kararından ÖNCE geliyorsa o karar sözleşmeye işlenmemiştir — F-004 tur 2'de CEO'nun iki
   kademeli zamanlama assert'i (sert kapı >1000 ms + scriptin iç ölçümü) hiçbir bölüme
   girmemişti, sözleşme hâlâ CEO'nun kırılgan bulduğu tek kademeli `elapsedMs < 400`'ü
   taşıyordu.
5. **Mutasyon senaryosunu MUTASYONLU hâlde de elle yürüt.** "En az 5 kez damlatan sunucu" gibi
   ÜST SINIRI olmayan değil, ALT sınırı olan ifadeler mutasyona kaçış yolu bırakır: F-004'te
   5 damla bitince idle bekçisi devreye girip mutasyonu yeşile döndürüyordu. Sayıları
   (aralık · eşik · toplam) hem normal hem mutasyonlu yolda yaz.
6. **İki ayrı düzeltmeyi birbirine karşı sına.** Aynı turda kapatılan iki bulgu çelişebilir:
   F-004'te parse-hatası gövdesinin `raw_text = MC_MAX_PAYLOAD karakter` tanımı, aynı turda
   eklenen kırpma zarfını tetikleyip `raw_text`'i düşürüyor ve yeni eklenen testi yapısal
   olarak kırmızı doğuruyordu.

7. **Zamanlama eşiği doğrulaması: testi kopyala, depo dışında ölç.** Bir düzeltme "X ms eşiği"
   getirdiyse test yardımcısını scratchpad'e birebir kopyalayıp 20+ örnek al — hem doğru kod hem
   mutasyonlu kod için. Sonra eşik iki dağılımın **boşluğunun ortasında mı** diye bak (F-004 fix1:
   doğru 147-184 / mutasyonlu 114-133, eşik 145 → üst uca 12 ms, alt uca 2 ms). Yükü de üret
   (`node -e "busy loop"` ×CPU sayısı, kendini sonlandıran süreyle). Kırılmıyorsa NOT ver, KALDI
   verme. Ayrıca **hangi assert'in önce geldiğine** bak: yük altında ilk kırılan eski
   `elapsedMs < 1000` kapısıydı, yeni eşik değil.

**Why:** Düzeltme turları dar tutulduğu için yeniden inceleme yapılmaz; kaçan kusur bir daha
bakılmayan bölgede kalır. **How to apply:** Kapanış tablosunu yazmadan önce bu üç kontrolü
uygula; kanıtı komut çıktısı + dosya:satır ile ver. Ayrıca arşivleme yaparken önceki raporun
zaten tarihli bir kopyası var mı diye bak (`diff -q`) — ikinci kez yanlış adla kopyalama.

İlgili: [[kod-turu-kontrolleri]], [[sozlesme-turu-kontrolleri]]
