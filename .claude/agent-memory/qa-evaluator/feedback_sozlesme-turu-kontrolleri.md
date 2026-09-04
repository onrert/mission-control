---
name: sozlesme-turu-kontrolleri
description: Sözleşme turu incelemesinde ilk bakılacak üç şey — ADR uyumu, kanıtın okuma yolu, ve düzeltmenin kendi ürettiği regresyon
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

**Why:** F-001'de yeşil görünen ama hiçbir şey ölçmeyen bir E2E assert'i ilk iki başlıktan
kaçmıştı; CLAUDE.md'ye "QA'ya mutasyon testi yaptır" kuralı bu yüzden eklendi. Mutasyon planı
da yeterli değil — mutasyonun **deterministik** kırmızı vereceği parametreler sözleşmede
sabitlenmeli; "kırmızı verene kadar N artırırım" sonuca göre ayarlamadır, kanıt değil.

**How to apply:** İnceleme sırasının ilk üç adımı olarak uygula. Dar doğrulama turlarında
(tur 2+) kapsam yalnızca "açık bulgular + düzeltmenin ürettiği regresyon" olur; onaylanmış
bölümleri yeniden açma. Bulguları `## ADR uyum kontrolü`, `## Ölçmeyen test riski`,
`## YENİ (regresyon)` gibi ayrı bölümlerde raporla. Bkz. [[proje-tur-ekonomisi]].
