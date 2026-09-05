---
name: kod-turu-kontrolleri
description: Kod turu QA'sında en çok bulgu üreten teknikler — hata yolu fault injection (her yeni yazma yolunda tekrarla), "çitin testi var mı" mutasyonu, checkpoint yazar/okur semantiği, derleme çıktısını sınıf sınıf ölçme, statik guard'ın yorumu vs. taradığı, UX'in birincil viewport'unda ölçme
metadata:
  type: feedback
---

Kod turunda (sözleşme turu değil) şu kontroller, testlerin hiç ölçmediği bulguları çıkarıyor:

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
   kaldırıldığında 133/133 test yeşil kaldı. F-003'te aynı teknik: yeni eklenen `/api/stream`
   rotasını Host/DNS-rebinding kontrolünden muaf tutmak 314/314 yeşil bıraktı — koruma
   çalışıyordu ama **yeni rotanın hiç regresyon çiti yoktu.** Kural: bir feature yeni bir rota/
   yüzey ekliyorsa, miras alınan her korumayı o rota için ayrıca mutasyonla.
3. **Durum/checkpoint dosyalarında yazar ve okur semantiğini karşılaştır.** `.seq` gibi bir
   dosyaya bir yerde "son kullanılan değer", başka yerde "bir sonraki değer" yazılıyor ve okuma
   `max(...)+1` yapıyorsa, her açılış sayaç bir kayar. Testler bunu görmez çünkü hepsi iki
   yeniden başlatma arasına veri koyar. Kanıtı **olaysız arka arkaya restart** ile üret.
4. **İlk UI feature'ında derleme çıktısını sınıf sınıf ölç — "test yeşil" ile "ekran doğru"
   arasında hiçbir bağ yok.** F-003'te Tailwind v4 + `vite.config.ts`'in `root: 'src/web'`
   ayarı yüzünden `src/features/**` altındaki HİÇBİR utility sınıfı üretilmedi: ekran stilsiz
   çıktı, `sr-only` canlı bölge görünür oldu, `overflow-y-auto` üretilmediği için liste hiç
   kaydırılamadı ve kaydırma-ile-dondurma özelliği üretimde çalışamaz hâle geldi. 322 testin
   hiçbiri kırmızı vermedi (jsdom CSS yüklemez; E2E `toBeVisible()` stilsiz öğe için de doğrudur;
   tema renk assert'i tesadüfen geçti çünkü o sınıf başka bir dosyada da kullanılıyordu).
   **Teknik:** derlenmiş CSS'i aç, yalnızca YENİ dizinde kullanılan ~8 sınıf ile yalnızca ESKİ
   dizinde kullanılan ~8 sınıfı ayrı ayrı `grep -c` ile say. 8/8 var + 0/9 yok gibi keskin bir
   bölünme kök nedeni doğrudan verir. Ardından gerçek tarayıcıda `scrollHeight`/`clientHeight`
   ölçüp "özellik gerçekten çalışıyor mu" diye bak — kod yolu var olabilir ama layout yoksa
   `onScroll` hiç ateşlenmez.

5. **Her YENİ yazma yolunda F-002'nin fault injection'ını birebir tekrarla — ders taşınmıyor.**
   F-005'te kayıt defteri (`projects.json`, tmp+rename) için hedef dosyayı dizin yapmak / salt-okunur
   yapmak (`chmod 444`) `renameSync`'i `EPERM` ile düşürdü; çağrı zinciri `req.on('end')` dinleyicisinin
   içinden geçtiği için **tüm sunucu süreci exit 1 ile öldü** — F-002'nin B1 bloklayıcısının aynısı,
   üstelik dersin yorumu aynı dosyanın tepesinde yazılıyken. İki ek ipucu: (a) birim testi
   `expect(() => store.write()).toThrow()` diyorsa tasarım fırlatmayı BİLİYOR demektir — üst katmanda
   `try/catch` var mı diye bak; (b) sözleşme "handler genel 500 yoluna düşer" gibi bir cümle
   içeriyorsa o yolu `grep` ile ARA, genelde hiç yoktur (`uncaughtException` handler'ı yok).
   Ayrıca hata dalında geçici dosya (`.tmp`) temizliği ve bellek-disk ayrışması de kontrol edilir.
6. **Statik guard'ın YORUMU ile TARADIĞI dizgeleri karşılaştır.** F-005'in `no-delete-guard`'ı
   "silinmediğini/**yazılmadığını** doğrular" diyordu ama yalnızca `unlink|rmSync|rmdirSync|fs.rm(`
   tarıyordu; `appendFileSync` ile izlenen projeye yazan mutasyonum guard'dan geçti (yalnızca dinamik
   manifest testi yakaladı). Guard iddiasının yarısını yapıyorsa yanlış güven üretir.
7. **Yeşil kalan mutasyon her zaman "eksik test" demektir, "önemsiz" değil — ama şiddeti kodun
   doğruluğuna bakarak ver.** F-005'te `watchers.delete(id)`'yi kaldırmak 425/425 yeşil bıraktı:
   ürün kodu doğruydu (tarayıcıda 1→0 ölçtüm), eksik olan çitti → ÖNEMLİ, bloklayıcı değil.
8. **UX dokümanının BİRİNCİL viewport'unu oku ve orada ölç.** F-005 UX'i paneli 320-480px'lik VS Code
   Simple Browser panelinde tanımlıyordu; 1280px'te kusursuz görünen `ml-auto` + `overflow-x-auto`
   başlık, 375px'te tek Ayarlar girişini ekran dışına itiyordu ve hiçbir test dar genişlikte ölçmüyordu.

**Why:** F-002 kod turunda bloklayıcı ve 3 önemli bulgunun tamamı ilk üç teknikten çıktı;
F-003'te iki bloklayıcının ikisi de dördüncüden çıktı; F-005'in tek bloklayıcısı beşincidendi. Developer'ın kendi mutasyonları bunların
hiçbirini yakalamamıştı çünkü hepsi "test var mı" sorusunu değil "kod doğru mu" sorusunu ölçüyordu.

**How to apply:** Kendi mutasyon setini seçerken developer'ın listesini kopyalama; onun
listesindeki her madde zaten kırmızı verecek şekilde seçilmiştir. Bunun yerine (a) hiç
mutasyon planlanmamış kod yollarını, (b) çok katmanlı savunmaların ikinci katmanını,
(c) hata/`catch` dallarını, (d) sözleşmenin "şu testte doğrulanır" dediği ama dosyada
`grep` ile bulunamayan davranışları hedefle. Bkz. [[sozlesme-turu-kontrolleri]],
[[duzeltme-turu-kontrolleri]].
