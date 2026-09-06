# QA Evaluator Memory

- [Sözleşme turu kontrolleri](feedback_sozlesme-turu-kontrolleri.md) — ADR ödevleri · kanıt yolu · regresyon · E2E gerçekten koşuyor mu · belgenin öncülleri repoyla uyuşuyor mu · yeni sekme/yazma yolunun kırdığı çitler.
- [Kod turu kontrolleri](feedback_kod-turu-kontrolleri.md) — fault injection · çit mutasyonu · derleme CSS `@source` denetimi · hassas verinin aktığı DALA mutasyon · dedup anahtarı çakışması · E2E feature'ı kapatıyor mu · dar viewport kırpma
- [Düzeltme turu kontrolleri](feedback_duzeltme-turu-kontrolleri.md) — brief öncülünü doğrula · eski yeşil mutasyonu tekrarla · süreç/port/veri-dizini iddialarını ölç · yeni çiti gerçek repoda koştur (doğuştan kırmızı mı) · üst-sınır assert'i mutasyon kaçırır.
- [Statik çit denetimi](feedback_statik-cit-denetimi.md) — AC kanıt cümlesini doğrula · muafiyete mutasyon at · aile bazında sızdır · kalan kaçağı ADR kabul sınırı + ikinci savunma hattıyla kalibre et.
