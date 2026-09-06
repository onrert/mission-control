---
id: F-014
title: Masaüstü uygulaması — Electron kabuğu, tepsi ve açılışta başlama
status: qa
owner: developer
deps: [F-012]
sprint: 2
---
## Açıklama
Kullanıcı isteği (2026-09-06): *"Panelde çalışmak istiyorum fakat sürekli terminalde server'ı
başlatmak istemiyorum. Bir masaüstü uygulaması yapabilir miyiz? Yaptıktan sonra artık oradan
çalışırım."*

F-012 ile panel, CEO oturumunun sohbet arayüzü oldu — yani kullanıcının **birincil çalışma
yüzeyi**. Bir çalışma yüzeyinin her açılışta elle terminal komutu istemesi kabul edilebilir değil.
`ADR-011` bu yüzden ertelemeden çıkarıldı ve **Electron** olarak karara bağlandı.

**Başarı ölçütü "masaüstü penceresi var mı" DEĞİL, "elle sunucu başlatmak gerekiyor mu"dur**
(`ADR-011`'in kendi tespiti: *"asıl mesele pencere değil: Windows açılışında başlayıp sistem
tepsisinde sürekli dinlemek"*). Pencere açan ama arka planda çalışmayan bir paketleme bu
feature'ı **karşılamaz**.

## Kabul kriterleri
- [ ] Uygulama çift tıklamayla açılıyor; kullanıcı **hiçbir terminal komutu yazmıyor** ve
      `MC_CHAT_ENABLED` gibi bir ortam değişkeni bilmek zorunda değil. **Sohbet varsayılan açık.**
- [ ] Sunucu uygulamanın içinde başlıyor; pencere kapatılınca uygulama **sistem tepsisinde**
      çalışmaya devam ediyor (olay toplama ve dosya izleme durmuyor).
- [ ] Tepsiden çıkış açık ve kesin: kullanıcı "Çıkış" dediğinde sunucu **gerçekten** kapanıyor,
      yetim süreç kalmıyor. **Çitlenecek** — bu projede yetim süreç tekrar eden bir sorun.
- [ ] **Windows açılışında başlama** kullanıcı tarafından açılıp kapatılabiliyor; varsayılanı
      belgede yazılı ve arayüzde görünür.
- [ ] Port çakışması (7333 dolu) kullanıcıya **okunabilir biçimde** bildiriliyor; uygulama sessizce
      yabancı bir sunucuya bağlanmıyor (F-001'den taşınan N4 dersi).
- [ ] **Tarayıcıdan kullanım çalışmaya devam ediyor** — geri dönüş yolu korunur, mevcut
      `npm start` akışı bozulmaz.
- [ ] Tek örnek (single instance): uygulama ikinci kez açılınca yeni sunucu başlatmıyor, var olan
      pencereyi öne getiriyor.
- [ ] `ADR-009` gereği yalnızca **Windows** paketleniyor.
- [ ] **Native derleme yok:** `tests/deps.test.ts`'in `hasInstallScript` guard'ına çarpılmıyor.
      Çarpılıyorsa **dur ve raporla** — guard sessizce gevşetilmez (G0 kararı).
- [ ] `npm run verify` ve mevcut E2E paketleri **bozulmuyor**; paketleme mevcut test hikâyesini
      kırmıyor.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`electron/**` (yeni), `package.json` (paketleme betikleri + bağımlılık), paketleme yapılandırması,
ilgili testler. **`src/features/**` ve `src/web/**` DEĞİŞMEZ** — bu bir başlatma katmanı,
ürün değişikliği değil.

**İstisna 1 (H1, QA F-014 B2, CEO onaylı):** `src/features/chat/server/session.ts`'in
`resolveChatSessionCwd`'i — Electron paketlenmiş kopyada dosyanın kendi `__dirname`'i
`resources/app/...`'a çözülüp barındırılan CEO oturumunun güvenlik kancalarını (hook'ları) hiç
bulamaması sorunu için gerekliydi. `electron/main.cjs` gerçek proje dizinini bulup
`MC_CHAT_SESSION_CWD`'i set eder; değişken tanımsızsa (tarayıcıdan `npm start`, testler) eski
`__dirname` türetimi DEĞİŞMEDEN çalışır — tarayıcı yolu bu istisnadan etkilenmez.

**İstisna 2 (I2, CEO kararı, QA F-014 tur2 N2):** aynı dosyada `bootstrap()`/`sendMessage()`/
`restart()` — barındırılan sohbet oturumu artık TEMBEL başlar: gerçek `deps.query()` (model
çağrısı potansiyeli taşıyan alt süreç) yalnızca ilk `sendMessage()`'da spawn edilir, uygulama
açılışı (`bootstrap()`) tek başına çağırmaz. Gerekçe: bu uygulama `ADR-011` ile Windows
açılışında HER GÜN otomatik başlıyor; açılışın tek başına kota harcaması kabul edilemez. Detay ve
doğrulama planı: `docs/qa/F-014-contract.md` "Ek — I2" bölümü. Her iki istisna da küçük, testli
(`tests/features/chat/server/session.test.ts`) ve tarayıcı/`npm start` yolunu davranışsal olarak
korur — feature notunun asıl kısıtladığı şey ürünün GÖRÜNÜR davranışının/ekranlarının
değişmemesidir, bu ikisi de görünür davranışı değiştirmez (yalnızca çalışma dizini çözümü ve
alt sürecin başlatılma ANI).

## Notlar / kararlar
- **İlk iş:** Electron bağımlılığının `deps.test.ts` guard'ına çarpıp çarpmadığını **ölç**.
  Çarpıyorsa kod yazmadan dur.
- Ölçüm ve çalıştırma için `npm run dev` **kullanılmayacak** — bu ortamda `concurrently` ile
  tekrarlanabilir biçimde bozuk (F-012 tur B ölçtü). Üretim yolu kullanılacak.
- Tepsi/açılış davranışı `docs/03-ux.md`'ye yazılacak (yeni ekran değil, ama kullanıcıya görünen
  metinler ve durumlar orada tanımlanır).
- İki CEO oturumu riski: bu feature bitince kullanıcı panele geçecek. Devir `docs/HANDOFF.md`
  üzerinden yapılacak; aynı depoda iki oturumun paralel commit atması **engellenmeli**
  (en azından belgelenmeli).
