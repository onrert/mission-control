---
name: veron-olcmeden-kapsam-degistirmez
description: Veron (tek kullanıcı/sahip) kapsam değişikliğine karar vermeden önce fizibilite ölçümü istiyor; "yapılamaz" ve "henüz değil" onun için geçerli cevaplar
metadata:
  type: user
---

Veron bu projenin tek kullanıcısı ve karar mercii. Bir özelliği öne çekmek istediğinde bile önce
**ölçüm** istiyor: "önce fizibilite, sonra karar". Spike brief'lerinde açıkça "KOD YAZMA", "kaynağı
olmayan cümle yazma", "'yapılamaz' da geçerli bir cevaptır" diyor.

Ayrıca kapsam kararlarını **belgeye bağlıyor**: G0'da "kesinlikle olmayacaklar" listesi yazılmış ve
sonraki her gevşetme ADR gerektirmiş (`ADR-009` kapsam daraltması bile kullanıcıya sorulmuş).

**How to apply:** Mimari önerilerde tek bir "en iyi çözüm" dayatma; seçenekleri gerçekçi gecikme,
maliyet (bu hatta 1 feature ≈ 1 gün) ve **bu projenin kendi kısıtlarıyla çatışma** sütunlarıyla
sun, tercihini gerekçesiyle belirt. Ucuz bir doğrulama adımı varsa (kod yazmadan ölçüm) onu
"Aşama 0" olarak öne koy — bu yaklaşımı istiyor. Teknik olmayan bir özet bölümü ekle; teknik
terimler İngilizce kalabilir ama anlatım Türkçe. İlgili: [[kanitli-iddia-zorunlulugu]]
