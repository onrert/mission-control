# autoimprove — program.md (Karpathy autoresearch deseni)

Bu dosya /autoimprove döngüsünün "araştırma yönergesi"dir. Agent Python/TS dosyalarını değiştirir; sen sadece bu dosyayı yazarsın.

## Metrikler (birini seç; komut tek sayı üretmeli)
| Ad | Ölçüm komutu | Yön | Not |
|---|---|---|---|
| lighthouse | `npx lighthouse http://localhost:3000 --output=json --quiet --chrome-flags="--headless" \| node scripts/lh-score.js` | yüksek iyi | dev sunucusu açık olmalı |
| bundle | `npm run build && node scripts/bundle-size.js` | düşük iyi | kB |
| coverage | `npx vitest run --coverage --reporter=json \| node scripts/coverage.js` | yüksek iyi | % |
| a11y | `npx playwright test e2e/a11y.spec.ts --reporter=json \| node scripts/a11y-score.js` | yüksek iyi | axe ihlal sayısı tersine |

(scripts/*.js dosyalarını ilk çalıştırmada developer yazar; her biri stdout'a tek sayı basar.)

## Zaman bütçesi
Her deneme en fazla 5 dakika; tur sayısı varsayılan 20.

## Keşif yönleri (öneri; agent özgür)
Gereksiz yeniden render, büyük bağımlılıklar, görsel optimizasyonu, lazy loading, önbellek başlıkları, test eksikleri, eksik aria etiketleri.

## Yasaklar
Testleri silmek/zayıflatmak · ölçüm scriptlerini değiştirmek · yeni bağımlılık eklemek (izin: hayır) · docs/ dışında dokümantasyon değiştirmek · feature davranışını değiştirmek.

## Tut / geri al
Metrik iyileşti ve testler yeşil → commit (`autoimprove(<metrik>): önce→sonra`). Aksi → `git checkout -- .`. Her tur `docs/autoimprove/log.md`'ye bir satır.
