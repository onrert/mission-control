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

8. **Sarmalayıcı/süreç iddialarını ÖLÇ, düzyazıya güvenme.** F-003 tur 2: "npm wrapper'ı atlayıp
   doğrudan `tsx` spawn ediyorum, böylece öldürdüğüm süreç gerçekten sunucu" iddiası yanlış öncüle
   dayanıyordu — `tsx` CLI'ının kendisi bir torun node süreci doğuruyor (ölçüldü: sarmalayıcı pid
   != sunucu pid). Sonuç tesadüfen iyiydi (tsx@4.23 torunu da düşürüyor) ama garanti sürüme bağlı.
   Depo dışında `spawn` + `tasklist` + port doluluk ölçümüyle 2 dakikada doğrulanır.
9. **Sabit port seçen her test tasarımını projenin TÜM belgelenmiş port kümesine karşı sına.**
   `vite.config.ts` (`MC_WEB_PORT`), `playwright*.config.ts`, `scripts/check-ports.mjs` (predev).
   F-003 tur 2 AC5 alt sunucusu 7334'ü seçmişti — o, Vite dev sunucusunun varsayılanı; `npm run dev`
   ile `npm run e2e` iki yönlü kilitleniyordu. Ayrıca `MC_PORT=0` kaçış yolu bu projede işlemez:
   sunucu gerçek dinlenen portu stdout'a basmıyor.
10. **Bir ekran ilk kez GERÇEK veri render etmeye başladığında, E2E sunucusunun hangi veri dizinini
   okuduğuna bak.** Paylaşılan Playwright `webServer`'ına `MC_DATA_DIR` verilmiyorsa gerçek `data/`
   okunur; F-004 hook'u 7333'e canlı olay POST ettiği için test koşarken dışarıdan veri akar ve
   `shell.spec.ts`'in `not.toContain(...)` negatif assert'leri makineye/zamana bağımlı olur.
11. **`role="tab"` gibi ARIA rolleri bağlam rolü olmadan geçerli değildir.** Tek başına `tab`
   (tablist/tabpanel yok) axe `aria-required-parent` ihlalidir; ayrıca tıklaması no-op olan bir
   buton, projenin kendi "iş yapmayan buton yasağı"na girer. Sadeleştirme önerirken UX doc'un
   gezinme + erişilebilirlik bölümlerini (ekran envanteri, kısayollar, odak sırası) birlikte oku.
12. **Derleme çıktısını denetleyen bir çit eklendiyse üç şeyi ayrı ayrı sına.** (a) Çitin
   örneklediği sınıfların/simgelerin YENİ dizinde ve **yalnızca** orada geçtiğini `grep` ile
   doğrula — önceki turda çiti tesadüfen yeşil bırakan sınıf (F-003'te `bg-zinc-950`, iki
   dizinde birden) listede olmamalı. (b) **Bayat artık totolojisi**: çit `dist/` içindeki tüm
   dosyaları okuyorsa, mutasyonlu koşuda eski doğru çıktı orada kalıp yeşil bırakabilir —
   mutasyonu uygulayıp çıktı dizinini kendi gözünle say (`emptyOutDir: true` gerçekten
   çalışıyor mu). (c) **Kapsama oranını ölç**: F-003 fix1'de çit, yeni dizindeki 69 özgün
   sınıfın 5'ini örnekliyordu — dizin seviyesinde kanarya, tek sınıf düşmesine kör. Bu NOT'tur,
   KALDI değil; ama "yeni ekran eklenince çit de elle güncellenmeli" uyarısını rapora yaz.

**Why:** Düzeltme turları dar tutulduğu için yeniden inceleme yapılmaz; kaçan kusur bir daha
bakılmayan bölgede kalır. **How to apply:** Kapanış tablosunu yazmadan önce bu üç kontrolü
uygula; kanıtı komut çıktısı + dosya:satır ile ver. Ayrıca arşivleme yaparken önceki raporun
zaten tarihli bir kopyası var mı diye bak (`diff -q`) — ikinci kez yanlış adla kopyalama.

İlgili: [[kod-turu-kontrolleri]], [[sozlesme-turu-kontrolleri]]
