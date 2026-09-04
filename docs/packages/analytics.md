# Paket: analytics (analitik + hata takibi)

## Amaç
Ne kullanılıyor, nerede kırılıyor — veriye dayalı iterasyon.

## Kullanıcıya sorulacaklar
- Analitik: PostHog (önerilen, ücretsiz katman, EU hosting) / Plausible (basit) / yok?
- Hata takibi: Sentry (önerilen) / yok?
- Çerez/izin: AB kullanıcıları varsa onay bannerı (legal paketiyle).

## Feature notlarına dönüşecek adımlar
1. F-an-1 Olay şeması: docs/analytics-events.md — 8–15 temel olay (kayıt, ilk değer anı, dönüşüm, hata), özellik adları, PII yok.
2. F-an-2 Entegrasyon: SDK'lar, ortam ayrımı (dev olay göndermez), kullanıcı kimliği hash'li.
3. F-an-3 Hata takibi: Sentry (web/Expo), sourcemap yükleme, kullanıcı geri bildirimi diyaloğu opsiyonel.
4. F-an-4 Geri bildirim döngüsü: haftalık özet komutu (`/status` içinde) — CEO, Sentry'den gelen hataları feature notuna dönüştürür (kullanıcı onayıyla).

## Manuel adımlar
Hesap açma, proje anahtarlarını env'e girme.
