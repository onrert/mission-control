# Paket: payments (ödeme / abonelik)

## Amaç
Ücretli plan veya tek seferlik ödeme; güvenli, test edilebilir, geri alınabilir.

## Kullanıcıya sorulacaklar
- Model: tek seferlik / aylık abonelik / kullanım bazlı?
- Platform: web (Stripe) / mobil (RevenueCat üzerinden App Store & Play faturalama) / ikisi?
- Para birimi ve ülkeler (TR'de Stripe kısıtı varsa alternatif: iyzico/Paddle — architect değerlendirir).
- Ücretsiz deneme var mı?

## Teknik seçim (architect ADR yazar)
- Web: Stripe Checkout + Customer Portal + webhook (`checkout.session.completed`, `customer.subscription.*`); planlar DB'de; yetki kontrolü sunucu tarafında (RLS/middleware).
- Mobil: RevenueCat SDK (Expo uyumlu), ürünler App Store Connect / Play Console'da; webhook ile sunucuya senkron.
- Test: Stripe test modu ve test kartları; sandbox hesapları.

## Feature notlarına dönüşecek adımlar
1. F-pay-1 Plan modeli ve yetki: DB şeması, "plan gerektirir" koruması, ücretsiz durumda ne görünür.
2. F-pay-2 Ödeme akışı: Checkout/Portal veya RevenueCat paywall; başarı/iptal ekranları.
3. F-pay-3 Webhook ve senkron: imza doğrulama, idempotency, abonelik durumu güncelleme, iptal/iade.
4. F-pay-4 Test ve izleme: e2e test (test modu), Sentry'de ödeme hataları, analitik olayları.

## Güvenlik (security-reviewer zorunlu)
Webhook imzası doğrulanır; fiyat/plan istemciden gelmez; secret'lar yalnızca sunucu env'inde.

## Manuel adımlar (kullanıcı)
Stripe/RevenueCat hesabı açmak, ürün/fiyat tanımlamak, API anahtarlarını panel/env'e girmek, canlı moda geçişi onaylamak (G6).
