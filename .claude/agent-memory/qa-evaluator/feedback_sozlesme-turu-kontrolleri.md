---
name: sozlesme-turu-kontrolleri
description: Sözleşme turu incelemesinde ilk bakılacak beş şey — ADR uyumu ve ADR'nin verdiği ödevler, kanıtın okuma yolu, düzeltmenin ürettiği regresyon, mutasyon hedefinin belirsizliği, çok katmanlı zaman aşımı bütçesi
metadata:
  type: feedback
---

Sözleşme turunda (PROCESS §5) şu kontrolleri her zaman en başa al:

1. **ADR uyumu önce.** Sözleşmenin "CEO'ya sorular" bölümündeki her soruyu `docs/decisions/`
   altında ara. Sözleşme, kendi sorularını yanıtlayan ADR'den **önce** yazılmış olabilir ve
   sonradan güncellenmemiş olur; bu durumda sözleşme kararın tersini savunur hâlde kalır.
   (F-002 tur 1: ADR-008 Host/Origin'i kapsam içine aldı, sözleşme hâlâ "KESİNLİKLE
   yapılmayacak" listesinde tutuyordu → bloklayıcı.)
2. **Kanıt hangi yoldan geliyor?** Bir AC "sıra/bütünlük" iddia ediyorsa, testin okuduğu
   kaynağa bak. Bellekteki bir yapıdan (ring buffer, sıralı Map) okuyan assert, yazma yolu
   tamamen bozulsa bile yeşil kalır — totolojidir. Sıra kanıtı **diskteki fiziksel satır
   sırasından** okunmalı. Aynı mantık fixture rejimi için de geçerli: küçük fixture, yalnızca
   büyük veri hacminde ortaya çıkan hatayı yapısal olarak gizler (ring dolmadığı için sayaç
   tam çıkar).
3. **Düzeltme turlarında: düzeltmenin kendisi hangi testi kırar?** Yeni bir kapı/kontrol
   (Host beyaz listesi, auth, rate limit) sözleşmeye eklendiğinde, mevcut testlerin o kapıdan
   nasıl geçeceğini somut olarak yürüt. F-002 tur 2: `Host` beyaz listesi `createServer`'a
   verilen `port`'a bağlanmıştı, ama F-001'in tüm testleri `createServer(0)` (efemeral port)
   çağırıyor → beyaz liste `127.0.0.1:0` bekler, gerçek istek `127.0.0.1:<efemeral>` gönderir,
   her şey 403. Sözleşme aynı satırda "mevcut testler bozulmadan çalışır" diyordu; iddia
   yanlıştı. Bu tür boşluklar kod turunda "testi geçirmek için kontrolü gevşetme" baskısı
   yaratır — o yüzden sözleşmede kapatılır.

4. **ADR yalnızca karar değil, ödev de verir.** ADR metinlerinde "F-00X bunu ölçer",
   "ölçüm N'i aşarsa CEO'ya bildirilir" gibi cümleleri ara ve sözleşmede karşılığı var mı
   diye bak. (F-004 tur 1: ADR-006 "F-004 bunu ölçer; ölçüm 1 s'yi aşarsa CEO'ya bildirilir"
   diyordu; sözleşmenin kendi tasarımı ~2,5 s'lik en kötü duruma çıkıyordu ve ne ölçüm ne
   bildirim vardı → bloklayıcı.)
5. **Çok katmanlı zaman aşımı = fazları ardışık varsay, en kötü toplamı elle hesapla.**
   Katman tablosu "her katman şunu kapatır" diye yazıldığında toplam hiç hesaplanmıyor;
   girdi bekçisi ile ağ bekçisi ardışıksa süreler toplanır. Ayrıca **hiç testi/mutasyonu
   olmayan katmanı** ara — genelde şablondan kopyalanan katman (F-004: 2000 ms stdin bekçisi)
   testsizdir. Mutasyon hedefi "A **veya** B senaryosu" diye belirsiz bırakılmışsa mutasyon
   kaçar: A seçilirse alt katman zaten tetiklenir ve mutasyon yeşil kalır — senaryoyu ve
   sayısal parametrelerini sözleşmede tek seçenek olarak sabitlet.

**Why:** F-001'de yeşil görünen ama hiçbir şey ölçmeyen bir E2E assert'i ilk iki başlıktan
kaçmıştı; CLAUDE.md'ye "QA'ya mutasyon testi yaptır" kuralı bu yüzden eklendi. Mutasyon planı
da yeterli değil — mutasyonun **deterministik** kırmızı vereceği parametreler sözleşmede
sabitlenmeli; "kırmızı verene kadar N artırırım" sonuca göre ayarlamadır, kanıt değil.

**How to apply:** İnceleme sırasının ilk üç adımı olarak uygula. Dar doğrulama turlarında
(tur 2+) kapsam yalnızca "açık bulgular + düzeltmenin ürettiği regresyon" olur; onaylanmış
bölümleri yeniden açma. Bulguları `## ADR uyum kontrolü`, `## Ölçmeyen test riski`,
`## YENİ (regresyon)` gibi ayrı bölümlerde raporla. Bkz. [[proje-tur-ekonomisi]].

6. **Rapor yazarken Bash heredoc'u ~10 KB'da kesiliyor** ve "unexpected EOF while looking for
   matching quote" hatası veriyor (dosyaya hiçbir şey yazılmaz). Uzun QA bölümlerini 4-6 parçalık
   `cat >> dosya <<'EOF'` çağrılarına böl; ayrıca alıntı içinde `split('\')` gibi ters bölü +
   tırnak dizilimi kullanma — CLAUDE.md'nin ters bölü kuralının rapor metnindeki karşılığı.
