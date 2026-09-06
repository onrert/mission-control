# ADR-011 — Paketleme: tarayıcı mı, masaüstü uygulaması mı?

- **Tarih:** 2026-09-05
- **Durum:** **Kabul edildi** (2026-09-06, Electron — belgenin sonundaki "KARAR" bölümüne bak). Önceki durum: ERTELENDİ
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

---

## KARAR (2026-09-06) — **Electron.** Erteleme kalktı.

- **Durum değişikliği:** ERTELENDİ → **Kabul edildi**
- **Karar veren:** Kullanıcı (Veron): *"panelde çalışmak istiyorum fakat sürekli terminalde
  server'ı başlatmak istemiyorum. İlk başta konuştuğumuz gibi bir masaüstü uygulaması yapabilir
  miyiz? Yaptıktan sonra artık oradan çalışırım."*
- **Neden şimdi:** yeniden açılma tetikleyicisi G6'ydı, ama F-012 tetikleyiciyi öne çekti.
  Panel artık CEO oturumunu barındırıyor, yani **kullanıcının birincil çalışma yüzeyi** oldu.
  Bir çalışma yüzeyinin her seferinde elle terminal komutu istemesi kabul edilebilir değil.

### Seçim: Electron

Bu ADR'nin kendi tablosu zaten cevabı veriyordu:
- **Electron** yığınımıza birebir oturuyor (mevcut Node sunucusu ana süreç, React uygulaması
  pencere) ve **sistem tepsisi + Windows açılışında başlama**yı mümkün kılıyor. Bedeli ~150 MB
  kurulum ve yeni bir paketleme hattı.
- **Tauri** ~10 MB olurdu ama **Rust araç zinciri + native derleme** gerektiriyor —
  `tests/deps.test.ts` guard'ının **açıkça yasakladığı** şey. Bu yasak G0'da bilinçli kondu
  (`better-sqlite3`'ün Windows'taki native derleme sürtünmesi yüzünden). Tauri'yi seçmek o kararı
  geri almak demekti; geri alınmadı.

### Bu ADR'nin kendi tespiti karar ölçütü oldu

> *"Asıl mesele pencere değil: **Windows açılışında başlayıp sistem tepsisinde sürekli
> dinlemek.**"*

Kullanıcının şikâyeti birebir buydu. Dolayısıyla **başarı ölçütü "masaüstü penceresi var mı"
değil, "elle sunucu başlatmak gerekiyor mu"dur.** Pencere açan ama arka planda çalışmayan bir
paketleme bu kararı **karşılamaz**.

### Sonuçlar

- Uygulama F-014 olarak yapılacak; sıradaki iş (F-013'ün önüne geçer).
- `ADR-009` (yalnızca Windows) geçerli — tek platform paketlenir.
- **Native derleme yasağı korunur.** Electron'un kendisi önceden derlenmiş ikili getirir;
  `tests/deps.test.ts`'in `hasInstallScript` guard'ına çarpıp çarpmadığı **F-014'ün ilk işi**
  olarak ölçülecek. Çarparsa dur ve raporla — guard'ı sessizce gevşetme.
- Mevcut mimarinin "ücretsiz erteleme" özelliği burada karşılığını veriyor: sunucu ve arayüz
  değişmiyor, yalnızca **başlatma katmanı** ekleniyor. Tarayıcıdan kullanım da çalışmaya devam
  etmeli (geri dönüş yolu).
- **Sohbet varsayılan olarak açık** gelmeli — kullanıcı `MC_CHAT_ENABLED` diye bir şey bilmek
  zorunda kalmamalı (F-012'nin çalıştırma sürtünmesi bu kararı tetikleyen şeyin parçasıydı).
