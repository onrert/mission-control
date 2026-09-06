---
name: kanitli-iddia-zorunlulugu
description: Bu projede her teknik iddia kaynaklı olmak zorunda; bulunamayan şey için "bulunamadı" yazılır, tahmin yürütülmez — ve tahminler açıkça işaretlenir
metadata:
  type: feedback
---

Araştırma/mimari çıktılarında her iddianın yanında kaynağı olacak: resmî doküman URL'si + erişim
tarihi, `dosya:satır`, veya çalıştırılan komutun çıktısı. Kaynağı olmayan cümle yazma. Bulamadığın
şey için **"bulunamadı"** yaz — tahmin yürütme. Doğrulayamadığın çıkarımları ayrı bir işaretle
(ör. `[T]`) ayır, blog/forum bilgisini "doğrulanmamış" diye etiketle ve hiçbir kararın dayanağı
yapma.

**Why:** Bu depo iddialarını kanıtla kapatan bir hat: `ADR-002` OSS lisanslarını tek tek
doğrulattı, `ADR-007`'nin transkript yolları "tahmin değil, diskte gözlemlendi" diye kayda geçti,
QA turları mutasyon testi olmadan "testler geçiyor"u kanıt saymıyor. Doğrulanmamış tek bir
varsayım (ör. hook'ların canlı olduğu) haftalarca sessiz hataya yol açtı.

**How to apply:** Spike, ADR ve mimari dokümanlarda uygula. Belgenin başına kanıt işareti
tablosunu koy. Kabuk/araç erişimin yoksa bunu **ölçüm sınırı olarak açıkça yaz** ve ölçülemeyen
şeyleri "Bilinmeyenler" bölümüne, nasıl ölçüleceğiyle birlikte taşı — sessizce tahmin etme.
