---
name: kod-turu-kontrolleri
description: Kod turu QA'sında en çok bulgu üreten üç teknik — hata yolu fault injection, "çitin testi var mı" mutasyonu, ve durum dosyası yazar/okur semantiği
metadata:
  type: feedback
---

Kod turunda (sözleşme turu değil) şu üç kontrol, testlerin hiç ölçmediği bulguları çıkarıyor:

1. **Hata yolunu fault injection ile zorla, mutlu yolu değil.** Testler mutlu yolu kanıtlar;
   sözleşmedeki "asla 5xx" gibi evrensel iddialar yalnızca I/O hatası enjekte edilerek
   sınanabilir. Ucuz teknik: gün dosyasının adında bir **dizin** oluştur → `appendFile`
   `EISDIR` verir. F-002'de bu, ana yazma yolunda hiç `try/catch` olmadığını ortaya çıkardı:
   istemci hiç yanıt almıyor, `unhandledRejection` süreci öldürüyor ve reddedilen kuyruk
   promise'i (`queue = queue.then(...)`, `.catch` yok) sonraki tüm istekleri kalıcı olarak
   bozuyor. Ayrıca: sözleşme aynı hata sınıfını (Windows EPERM/EBUSY) *başka* bir yol için
   (retention silme) öngörüp kapatmışsa, **ana yol neden kapatılmamış** diye sor.
2. **Her "güvenlik çiti" için ayrı bir mutasyon çalıştır — çitin testi var mı?** Bir kontrol
   iki katmanlıysa (ör. `isInsideDataRoot` kapsama kontrolü **ve** dosya adı deseni), her
   katmanı ayrı ayrı kaldır. F-002'de kapsama kontrolü kırmızı verdi ama desen çiti
   kaldırıldığında 133/133 test yeşil kaldı. Aynı şekilde "varsayılana düşer" testleri
   totoloji olabilir: geçersiz değeri `0`'a düşüren mutasyon, port 0 her zaman boş olduğu için
   yeşil kalıyor.
3. **Durum/checkpoint dosyalarında yazar ve okur semantiğini karşılaştır.** `.seq` gibi bir
   dosyaya bir yerde "son kullanılan değer", başka yerde "bir sonraki değer" yazılıyor ve okuma
   `max(...)+1` yapıyorsa, her açılış sayaç bir kayar. Testler bunu görmez çünkü hepsi iki
   yeniden başlatma arasına veri koyar. Kanıtı **olaysız arka arkaya restart** ile üret ve
   gerçek repo verisine bak (F-002: `data/events/.seq` = 9, hiç olay yokken).

**Why:** F-002 kod turunda bloklayıcı ve 3 önemli bulgunun tamamı bu üç teknikten çıktı;
developer'ın kendi 8 mutasyonu bunların hiçbirini yakalamamıştı çünkü hepsi "test var mı"
sorusunu değil "kod doğru mu" sorusunu ölçüyordu.

**How to apply:** Kendi mutasyon setini seçerken developer'ın listesini kopyalama; onun
listesindeki her madde zaten kırmızı verecek şekilde seçilmiştir. Bunun yerine (a) hiç
mutasyon planlanmamış kod yollarını, (b) çok katmanlı savunmaların ikinci katmanını,
(c) hata/`catch` dallarını hedefle. Bkz. [[sozlesme-turu-kontrolleri]].
