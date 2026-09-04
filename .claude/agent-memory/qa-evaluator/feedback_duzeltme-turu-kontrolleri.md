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

**Why:** Düzeltme turları dar tutulduğu için yeniden inceleme yapılmaz; kaçan kusur bir daha
bakılmayan bölgede kalır. **How to apply:** Kapanış tablosunu yazmadan önce bu üç kontrolü
uygula; kanıtı komut çıktısı + dosya:satır ile ver. Ayrıca arşivleme yaparken önceki raporun
zaten tarihli bir kopyası var mı diye bak (`diff -q`) — ikinci kez yanlış adla kopyalama.

İlgili: [[kod-turu-kontrolleri]], [[sozlesme-turu-kontrolleri]]
