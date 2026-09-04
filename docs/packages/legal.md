# Paket: legal (yasal kapı — KVKK / GDPR / mağaza gereklilikleri)

## Amaç
Yayından önce yasal asgari gerekliliklerin karşılandığını doğrulamak. Bu bir kontrol listesidir, hukuki görüş değildir; şüphede kullanıcı bir uzmana danışır.

## Kullanıcıya sorulacaklar
- Hedef pazar: TR / AB (Almanya) / global? (AB → GDPR, TR → KVKK)
- Kişisel veri toplanıyor mu (e-posta, konum, ödeme, sağlık gibi hassas veri)?
- Çocuklara yönelik mi? (ek kurallar)

## Kontrol listesi (G5/G6'da CEO değerlendirir; eksikler feature olur)
- [ ] Gizlilik politikası ve kullanım koşulları sayfaları (TR/EN/DE), uygulama içinden erişilebilir
- [ ] Veri envanteri: docs/data-map.md — hangi veri, neden, nerede saklanıyor, süre
- [ ] Çerez/izin bannerı (AB) ve analitik onaya bağlı yükleme
- [ ] Hesap ve veri silme yolu (uygulama içi veya e-posta ile, 30 gün)
- [ ] Veri işleyen 3. taraflar listesi (hosting, analitik, ödeme) ve DPA'ları
- [ ] Mağaza gereklilikleri: Apple "App Privacy" beyanı, Google "Data safety" formu, hesap silme zorunluluğu
- [ ] E-posta gönderimi varsa abonelikten çıkma
- [ ] Hassas veri yoksa bunu açıkça belirt; varsa şifreleme ve erişim kısıtı

## Manuel adımlar
Politika metinlerinin son okuması ve şirket/kişi bilgilerinin girilmesi kullanıcıdadır.
