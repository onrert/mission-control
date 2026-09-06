---
name: masaustu-paketleme-turu
description: Masaüstü/paketleme (Electron) turunda bulgu üreten teknikler — native diyalog/balonun gerçekten ÇİZİLDİĞİNİ ölç, paketlenmiş kopyanın kökünü PEB'den oku, hook'ların yüklendiğini olay akışından kanıtla, teslim durumu ile kod doğruluğunu ayır, retry kaldırıldıktan sonra N kez koştur ve süreç sayacıyla eşle
metadata:
  type: feedback
---

Paketleme/kabuk feature'larında (F-014, Electron) bulguların tamamı şu tekniklerden çıktı:

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
   siler.

3. **"Kod doğru" ile "teslim edilen durum doğru"yu ayır.** F-014'te ilk-açılış varsayılanı
   (autostart AÇIK) kodda ve taze bir userData'da **çalışıyordu**; ama geliştiricinin elle testi
   `%APPDATA%\...\autostart-initialized.json` marker'ını bırakıp kayıt defteri anahtarını sildiği
   için kullanıcının makinesinde varsayılan fiilen KAPALI kalmıştı ve bir daha hiç açılmayacaktı.
   Kural: "ilk açılışta şunu yapar" tipi her davranışta, teslim edilen makinedeki mevcut durumu
   (marker dosyası, registry, userData) ayrıca ölç ve raporla.

4. **OS-native yüzeyleri gerçekten tıkla — test kancasına razı olma.** Windows 11 tepsi menüsü:
   UIA ile "Gizli Simgeleri Göster" düğmesinin rect'ini bul → tıkla → UIA ile ikon rect'ini bul →
   `mouse_event` ile sağ tık → kareyi kırp (menü metinleri UX sözlüğüyle birebir karşılaştırılır) →
   öğeye tıkla. Uyarı: taşma menüsü odak kaybında kapanıyor, ikinci deneme kararsız — ölçümü ilk
   seferde kaydet, kalanı E2E'ye bırak.

5. **Yeni giriş noktasında hata sınırı yoksa fault injection ile göster.** `userData/data` yolunda
   `data` adında bir DOSYA oluşturmak `createServer`'ı düşürüyor. Düzeltmeden önce: pencere yok,
   tepsi yok, hata yok, **3 zombi süreç**. Düzeltmeden sonra aynı enjeksiyonu tekrarla ve
   **pencere kapatıldıktan sonraki süreç sayısını** ölç (0 olmalı) + **aynı bozuk userData ile
   ikinci başlatmanın** hâlâ hata gösterip göstermediğini (tek-örnek kilidi zombide takılı kalmasın).

6. **Alt sürecin çalışma dizinini PEB'den oku — en ucuz ve en kesin cwd kanıtı.** Windows'ta
   `NtQueryInformationProcess` + `ReadProcessMemory` ile x64 PEB `0x20` → `RTL_USER_PROCESS_PARAMETERS`
   `0x38` (CurrentDirectory.DosPath) okunur; ~30 satır C#/PowerShell. F-014 2. turda barındırılan
   oturumun `claude.exe`'sinin cwd'si böyle `C:\dev\apps\mission-control\` olarak ölçüldü — üstelik
   uygulamayı bilerek `-WorkingDirectory 'C:\'` ile başlatıp `process.cwd()` türetimini de eledim.
   **Hook'ların gerçekten YÜKLENDİĞİNİ** kanıtlamak için de ücretsiz bir yol var: hook'lar panele
   olay POST'luyorsa `/api/events`'i barındırılan oturumun `session_id`'siyle filtrele ve
   `SessionStart` olayının `raw.cwd` alanına bak. "settings.json orada duruyor" çıkarımından
   çok daha güçlü.

7. **Retry kaldırıldı diye kararsızlık bitmez — kendin N kez koştur ve süreç sayacıyla eşle.**
   F-014 2. turda `retries: 2` gerçekten kaldırılmıştı ve geliştirici "5/5 + 3/3 yeşil" dedi;
   benim koşumda aynı spec **17 koşuda 3 kez** kırmızı verdi (ilk koşuda hemen). Kritik ayrım:
   *test mi kararsız, ürün mü kilitleniyor?* Bunu 1 sn aralıkla `Get-Process` örnekleyen bir
   arka plan betiğiyle çöz — F-014'te sayaç, `shutdownViaTray()` sonrası **5 sürecin 30 saniye
   boyunca hayatta kaldığını** ve yalnızca Playwright'ın `finally` bloğunun onları öldürdüğünü
   gösterdi. Yani ürün kilitleniyordu, harness onu gizliyordu. Ayrıca **kardeş spec'i de koştur**
   (F-014'te bildirim penceresi açmayan `electron-smoke` 10/10 yeşildi) — tek değişkeni izole eder
   ve muhtemel dosya:satırı doğrudan verir.

**How to apply:** Bir feature "kullanıcıya X bildirilir" diyorsa, çiti *çizim* seviyesinde ara;
bir feature paketleme yapıyorsa çıktının içini `ls`le ve uygulamanın kökünü PEB'den + hook olay
akışından doğrula; bir düzeltme turu "retry kaldırdım, yeşil" diyorsa paketi en az 10 kez koştur.
Bkz. [[kod-turu-kontrolleri]] (fault injection, çit mutasyonu), [[duzeltme-turu-kontrolleri]],
[[statik-cit-denetimi]].
