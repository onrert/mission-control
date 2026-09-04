# Paket: store (mobil mağaza yayını — Expo/EAS)

## Amaç
Expo uygulamasını App Store ve Google Play'e hazırlamak; gönderim kullanıcıda kalır.

## Kullanıcıya sorulacaklar
- Apple Developer (99 $/yıl) ve Google Play (25 $ tek seferlik) hesapları var mı?
- Uygulama adı, bundle id / package name, kategori, yaş sınıfı.
- İlk dağıtım: TestFlight / kapalı test → sonra yayın?

## Feature notlarına dönüşecek adımlar
1. F-st-1 Yapılandırma: app.json/app.config (adlar, id'ler, sürüm, izin açıklamaları), `eas.json` profilleri (development, preview, production).
2. F-st-2 Görseller: ikon (app-icon skill'i), splash, mağaza ekran görüntüleri (asset-designer, ASSETS.ok ile), tanıtım videosu opsiyonel.
3. F-st-3 Metinler: başlık (30), alt başlık (30), açıklama (4000), anahtar kelimeler (100) — TR/EN/DE (tech-writer).
4. F-st-4 Derleme: `eas build` (preview → production); crash yok, cihazda duman testi; `eas submit` yalnızca G6 sonrası (hook).
5. F-st-5 Uyum: legal paketindeki mağaza maddeleri; gizlilik politikası URL'si.

## Manuel adımlar (kullanıcı)
Hesap açma ve ödeme, sertifika/anahtar onayları (EAS yönetebilir), mağaza konsolunda formlar, inceleme cevapları, yayın butonu.
