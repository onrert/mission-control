---
name: sozlesme-turu-kontrolleri
description: Sözleşme turu incelemesinde ilk bakılacak kontroller — ADR uyumu ve ADR'nin verdiği ödevler, kanıtın okuma yolu, düzeltmenin ürettiği regresyon, mutasyon hedefinin belirsizliği, zaman aşımı bütçesi, E2E'nin gerçekten koşup koşmadığı, yeni bağımlılığın gerçek davranışı
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

6. **E2E'ye atanan AC'ler gerçekten koşacak mı?** Sözleşme bir AC'yi "E2E katmanı" diye
   işaretlediğinde iki şeyi **çalıştırma konfigürasyonundan** doğrula: (a) `playwright.config.ts`
   `testMatch` **kapalı bir dosya listesi** mi — öyleyse yeni spec dosyası "değiştireceğim
   dosyalar" tablosunda olmalı, yoksa spec hiç koşmaz ve tüm E2E katmanı sessizce ölür;
   (b) `webServer.command` üretim build'i mi koşuyor (`npm run build && npm start`) — öyleyse
   `import.meta.env.MODE !== 'production'` / `NODE_ENV` koşuluna bağlanmış test-only ölçüm
   probları (render sayacı, `data-*` attribute) E2E'de **hiç render edilmez** ve `null === null`
   tuzağıyla yeşil kalır. F-007 tur 1'de ikisi de aynı sözleşmede vardı → 2 bloklayıcı.
7. **Yeni bağımlılığın davranış iddiasını kaynaktan doğrula, kurmadan.** Sözleşme "kütüphane
   şunu zaten sağlıyor" dediğinde (`aria-live="polite"` canlı bölge, klavye sensörü, peer
   uyumu) `npm view` metadata'sı yetmez: `curl https://unpkg.com/<paket>@<sürüm>/dist/<bundle>`
   ile dist kaynağını indirip grep'le. F-007: `@dnd-kit/accessibility@3.1.1` `LiveRegion`
   varsayılanı `assertive` ve `@dnd-kit/core@6.3.1` bunu **hiç geçirmiyor** → sözleşmenin
   erişilebilirlik iddiası yanlıştı. Aynı şekilde saf fonksiyon iddialarını (YAML tırnaklama,
   hash) scratchpad'de gerçek paketi kurup **tablo hâlinde ölç** — "19/19 gösterge karakteri
   doğru ama 10/40 değer round-trip'i geçmiyor" gibi sayısal bulgu tartışılmaz.

**Why:** F-001'de yeşil görünen ama hiçbir şey ölçmeyen bir E2E assert'i ilk iki başlıktan
kaçmıştı; CLAUDE.md'ye "QA'ya mutasyon testi yaptır" kuralı bu yüzden eklendi. Mutasyon planı
da yeterli değil — mutasyonun **deterministik** kırmızı vereceği parametreler sözleşmede
sabitlenmeli; "kırmızı verene kadar N artırırım" sonuca göre ayarlamadır, kanıt değil.

**How to apply:** İnceleme sırasının ilk adımları olarak uygula. Dar doğrulama turlarında
(tur 2+) kapsam yalnızca "açık bulgular + düzeltmenin ürettiği regresyon" olur; onaylanmış
bölümleri yeniden açma. Bulguları `## ADR uyum kontrolü`, `## Ölçmeyen test riski`,
`## YENİ (regresyon)` gibi ayrı bölümlerde raporla. Bkz. [[proje-tur-ekonomisi]].

8. **Rapor yazarken Bash heredoc kullanma.** Heredoc ~10 KB'da kesiliyor ("unexpected EOF")
   ve ters bölüleri teke düşürüyor. Doğru yol: bölümü **Write aracıyla** scratchpad'e yaz,
   sonra tek satır `cat scratchpad/bolum.md >> docs/qa/<feature>-contract.md`. Tek çağrıda,
   kayıpsız, regex/backtick içeren alıntılar bozulmadan geçer.
