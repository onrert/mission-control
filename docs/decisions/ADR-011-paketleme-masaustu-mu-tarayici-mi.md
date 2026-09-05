# ADR-011 — Paketleme: tarayıcı mı, masaüstü uygulaması mı?

- **Tarih:** 2026-09-05
- **Durum:** **ERTELENDİ** — G6 (yayın kapısı) öncesinde karara bağlanacak
- **Soruyu açan:** Kullanıcı (Veron), F-003 sözleşme turu sırasında. "Bir değişiklik yapma, bir şey
  düşünüyorum: bunu web app değil de direkt bilgisayarda uygulama olarak kullanabilir miyiz?"
  Kullanıcının kararı: **"Sadece merak ettim, şimdilik dursun."** Hiçbir değişiklik yapılmadı.

## Neden ertelenebilir (bu ADR'nin asıl bulgusu)

Mevcut mimari bu kararı **ücretsiz erteliyor.** React + Vite `dist/web`'e statik dosya üretiyor,
`node:http` sunucusu onu `127.0.0.1`'de servis ediyor, dışarıya hiçbir bağımlılık yok. Bir masaüstü
kabuğuna sarmak **paketleme** işidir, mimari yeniden yazımı değil: F-003…F-007'nin kodu ya aynı kalır
ya çok az değişir. Dolayısıyla kararı Faz 1 bitene kadar açık tutmanın maliyeti sıfırdır ve karar
gerçek ekranlar görüldükten sonra daha bilgili verilir.

## Seçenekler (G6'da yeniden değerlendirilecek)

| Seçenek | Kazanç | Maliyet / risk |
|---|---|---|
| **Uygulama penceresi** (tarayıcının "uygulama olarak yükle"si veya `--app=` kısayolu) | Adres çubuğu yok, kendi penceresi, görev çubuğunda ikon | ~1 saat; bir manifest + ikon. Mimari değişmez. |
| **Electron** | Yığınımıza birebir oturur: mevcut sunucu ana süreç, React uygulaması pencere. **Sistem tepsisi + Windows açılışında başlama** mümkün olur. | ~150 MB kurulum; yeni derleme/paketleme hattı (devops); test hikâyesi değişir. |
| **Tauri** | ~10 MB, işletim sisteminin webview'ı | **Rust araç zinciri + native derleme gerektirir** — `tests/deps.test.ts` guard'ının açıkça yasakladığı şey. Bu yasak G0'da bilinçli kondu (`better-sqlite3` Windows'ta native derleme sürtünmesi yüzünden elenmişti). Seçmek o kararı geri almak demektir. |

## Karar verilirken hatırlanacak asıl mesele

Süslü pencere değil. Panelin bugünkü **en büyük pratik zayıflığı**, sunucu kapalıyken hook
olaylarının sessizce düşmesidir (ADR-006'da bilinçli kabul edilmiş: "Sunucu kapalıyken olaylar
kaybolur"). Yani paneli açmayı unutulan her oturum kayıptır.

Gerçek bir masaüstü uygulamasının tek başına haklı çıkarabileceği özellik budur: **Windows
açılışında başlayıp sistem tepsisinde sürekli dinlemek.** G6'da karar verilirken ölçüt "daha
şık görünüyor mu" değil, "kaç oturum kaçırılıyor" olmalı.

## Yeniden açılma tetikleyicisi
- G6 yayın kapısı (zorunlu — o kapıda paketleme ve dağıtım zaten konuşuluyor), veya
- Kullanıcı "paneli açmayı unuttuğum için olay kaçırdım" derse (o an bu ADR'nin ikinci bölümü
  doğrudan gerekçedir), veya
- Panelin başka bir makineye/kişiye dağıtılması gündeme gelirse.
