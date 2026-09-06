---
name: masaustu-paketleme-turu
description: Masaüstü/paketleme (Electron) turunda bulgu üreten teknikler — native diyalog/balonun gerçekten ÇİZİLDİĞİNİ ölç, paketlenmiş kopyanın kökünü ve eksiklerini ölç, teslim durumu ile kod doğruluğunu ayır, OS tepsi menüsünü win32+UIA ile gerçekten tıkla
metadata:
  type: feedback
---

Paketleme/kabuk feature'larında (F-014, Electron) bulguların tamamı şu dört teknikten çıktı:

1. **"API çağrıldı" ile "kullanıcı gördü" arasındaki farkı ölç.** `dialog.showErrorBox` ve
   `tray.displayBalloon` bu makinede (Electron 44 / Win11) **hiçbir pencere/toast üretmiyor**;
   birim testleri ikisinin de *çağrıldığını* doğruladığı için yeşildi. Ölçüm yöntemi: ürün
   kodundan bağımsız 6 satırlık bir sonda uygulaması yaz — aynı süreçte `BrowserWindow` çiz + hata
   kutusunu çağır; `EnumWindows` ile pencereleri say ve tam ekran kare al. Biri çizilip diğeri
   çizilmiyorsa kök neden ortam değil kanal seçimidir. Balon için 1 sn aralıkla 8 kare al
   (toast kısa ömürlü), `HKCU\...\PushNotifications\ToastEnabled`'ı da kontrol et ki
   "kullanıcının bildirimleri kapalı" mazereti elensin.

2. **Paketlenmiş kopyanın İÇİNİ aç ve uygulamanın hangi kökte çalıştığını ölç.** `resources/app`
   kaynak ağacın kopyasıdır; `__dirname`'den kök türeten her şey (F-014'te CEO sohbetinin
   `CHAT_SESSION_CWD`'si) o kopyaya bağlanır. `ls` ile bak: `docs/`, `.git`, `.claude/settings.json`
   yoksa ürünün ana kullanım senaryosu (dokümana bakan, commit atan, hook çitleriyle korunan bir
   ajan) sessizce çöker. `overwrite: true` olan bir paketleme betiği o klasörü bir sonraki sürümde
   siler. Canlı kanıt ucuz: `/api/chat/status`'un bekleyen izin isteğindeki komut önizlemesi cwd'yi
   birebir gösteriyordu.

3. **"Kod doğru" ile "teslim edilen durum doğru"yu ayır.** F-014'te ilk-açılış varsayılanı
   (autostart AÇIK) kodda ve taze bir userData'da **çalışıyordu**; ama geliştiricinin elle testi
   `%APPDATA%\...\autostart-initialized.json` marker'ını bırakıp kayıt defteri anahtarını sildiği
   için kullanıcının makinesinde varsayılan fiilen KAPALI kalmıştı ve bir daha hiç açılmayacaktı.
   Kural: "ilk açılışta şunu yapar" tipi her davranışta, teslim edilen makinedeki mevcut durumu
   (marker dosyası, registry, userData) ayrıca ölç ve raporla.

4. **OS-native yüzeyleri gerçekten tıkla — test kancasına razı olma.** Windows 11 tepsi menüsü:
   UIA ile "Gizli Simgeleri Göster" düğmesinin rect'ini bul → tıkla → UIA ile ikon rect'ini bul →
   `mouse_event` ile sağ tık → kareyi kırp (menü metinleri UX sözlüğüyle birebir karşılaştırılır) →
   öğeye tıkla. Tepsi "Çıkış"ı böyle tıklayınca 4 → 0 süreç ölçtüm; geliştirici yalnızca
   `global.__missionControlTestHook`'u çağırmıştı. Uyarı: taşma menüsü odak kaybında kapanıyor,
   ikinci deneme kararsız — ölçümü ilk seferde kaydet, kalanı E2E'ye bırak.

5. **Yeni giriş noktasında hata sınırı yoksa fault injection ile göster.** `userData/data` yolunda
   `data` adında bir DOSYA oluşturmak `createServer`'ı düşürdü; `app.whenReady().then(async …)`
   zincirinde `.catch` olmadığı için: pencere yok, tepsi yok, hata yok, **3 zombi süreç** kalıcı;
   aynı userData ile sonraki açılışlar tek-örnek kilidine takılıp sessizce ölüyor. Bu, "yazma
   yolundaki yakalanmamış hata" dersinin dördüncü biçimi — her yeni başlatma katmanında tekrarla.

**How to apply:** Bir feature "kullanıcıya X bildirilir" diyorsa, çiti *çizim* seviyesinde ara;
bir feature paketleme yapıyorsa çıktının içini `ls`le ve uygulamanın kökünü canlı bir API
yanıtından doğrula. Bkz. [[kod-turu-kontrolleri]] (fault injection, çit mutasyonu),
[[statik-cit-denetimi]].
