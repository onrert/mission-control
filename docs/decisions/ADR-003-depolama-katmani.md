# ADR-003: Depolama katmanı — düz JSONL dosya deposu

- **Tarih:** 2026-09-04
- **Durum:** kabul

- **Bağlam:**
  Panelin saklaması gereken iki şey var: (1) hook olayları (akış halinde gelir, çok yazılır, az sorgulanır), (2) izlenen proje listesi (nadiren değişir, küçük). Feature kartları ve kapı durumları **saklanmaz** — onların tek gerçeği izlenen projelerin diskteki dosyalarıdır, panel yalnızca türetir.

  Bağlayıcı kısıt (`docs/approvals/G0.ok`, `docs/01-prd.md` "Kapsam dışı"): **native derleme gerektiren depo yasak**, `better-sqlite3` özel olarak yasak. Doğrulama raporu riski şöyle özetliyordu: prebuild bulunamazsa node-gyp + Visual Studio Build Tools; Node sürümü değişince ABI uyumsuzluğu ve yeniden derleme.

  Hacim tahmini: ADR-001 karar 4 ile saklama sınırı **30 gün veya 20.000 olay**. Ortalama olay kaydı `raw` payload ile birlikte ~1–3 KB. Üst sınır ≈ 20.000 × 3 KB ≈ **60 MB**. Tek kullanıcı, tek süreç, saniyede en fazla birkaç yazma.

- **Karar:**
  **Düz JSONL dosya deposu.** Veritabanı yok, ORM yok, migration yok.

  ```
  data/                              # MC_DATA_DIR, .gitignore'da
  ├─ events/
  │  ├─ 2026-09-03.jsonl             # UTC gününe göre bir dosya, satır başına bir olay
  │  ├─ 2026-09-04.jsonl
  │  └─ .seq                          # en son verilen seq (opsiyonel hızlandırma)
  └─ projects.json                    # izlenen proje kayıt defteri
  ```

  Kurallar:
  1. **Tek yazar.** Yalnızca sunucu süreci yazar. Hook'lar dosyaya değil HTTP'ye yazar (ADR-006), dolayısıyla süreçler arası kilit ihtiyacı yoktur.
  2. **Append-only.** `fs.appendFile` (`O_APPEND`) ile satır sonunda `\n`. Var olan satır asla düzenlenmez. Node aynı süreç içindeki append çağrılarını sıraya koyar; kısmi/karışmış satır oluşmaz.
  3. **Bozuk satıra dayanıklı okuma.** Okuyucu her satırı ayrı `try/catch` ile ayrıştırır; bozuk satır atlanır ve `/api/health.corrupt_lines` sayacına eklenir. Ani kapanmada oluşabilecek tek kusurlu satır (dosyanın sonundaki yarım satır) veri kaybı yaratmaz.
  4. **Bellekte ring buffer.** Son `MC_RING_SIZE` (varsayılan 2000) olay bellekte tutulur; UI'ın ilk yüklemesi ve SSE telafisi (ADR-004) buradan karşılanır. Diske yalnızca daha eskisi istendiğinde gidilir.
  5. **Retention = dosya silme.** Açılışta ve saatte bir: `MC_RETENTION_DAYS`'ten eski gün dosyaları silinir; toplam satır `MC_RETENTION_EVENTS`'i aşarsa en eski gün dosyaları baştan silinir. Satır düzenleme/yeniden yazma yok — bu yüzden budama hem ucuz hem bozulmaya kapalı. Silme **yalnızca `MC_DATA_DIR` altında** yapılır; yazma kapısıyla (ADR-005) hiçbir ilgisi yoktur ve izlenen projelere asla dokunmaz.
  6. **`projects.json` atomik yazılır** (tmp + `rename`), çünkü tam-dosya üzerine yazmadır ve bozulursa izleme listesi kaybolur.
  7. **Şema sürümü:** `projects.json` içinde `version: 1`. Olay satırlarında sürüm alanı yok; okuyucu alan yokluğuna toleranslı (bilinmeyen alan korunur, eksik alan opsiyonel).

  Sorgulama ihtiyacı bu kararla uyumludur: filtreler (proje, tip, agent, `since_seq`, alt dizge) 20.000 kayıtlık bir dizide lineer taramayla mikrosaniyeler alır; indeks, sorgu planı veya SQL gerekmez.

- **Alternatifler ve neden reddedildi:**
  - **`better-sqlite3`:** Kısıt gereği yasak; ayrıca node-gyp/Build Tools ve ABI riski (doğrulama raporu risk (c)). **Red.**
  - **`node:sqlite` (yerleşik):** Native derleme yok, gerçek SQL var — cazip. Ama Node ≥ 22.5 (bayraklı) / ≥ 24 (kararlıya yakın) gerektirir; bu ortamda kurulu Node sürümünü **doğrulayamadık** (kabuk erişimi yok), yani "kullanıcının makinesinde ilk komutta çalışsın" garantisini veremiyoruz. Buna karşılık kazanç yok: 20.000 satırlık tek kullanıcılık bir akışta SQL'in sağlayacağı hiçbir şeye ihtiyacımız yok (join yok, transaction yok, eşzamanlı yazar yok). Ayrıca "deneysel API" uyarısı ve sürümle değişebilecek imzalar yeni bir kırılganlık kaynağıdır. **Red** — ama hacim beklenmedik şekilde büyürse (>1M olay) yeniden değerlendirilecek doğru seçenek budur.
  - **`sql.js` / `libsql` (WASM veya saf JS SQLite):** Derleme yok ama MB'larca WASM yükü ve yine SQL katmanı; ihtiyacın kat kat üstünde. **Red.**
  - **`lowdb` / tek büyük `events.json`:** Her yazmada tüm dosyayı serileştirip yeniden yazar; 60 MB'da bu hem yavaş hem de yazma sırasında çökme durumunda **tüm geçmişi** riske atar. JSONL append tam olarak bu sorunu çözer. **Red.**
  - **`node:sqlite` yerine LevelDB/`classic-level`:** Native derleme. **Red.**
  - **Tek büyük `events.jsonl` (gün dosyaları olmadan):** Append yine ucuz, ama retention "dosyanın başından N satır sil" demek — yani tüm dosyayı yeniden yazmak. Gün dosyaları budamayı `unlink`'e indirger. **Red.**
  - **Yalnızca bellek (kalıcılık yok):** PRD F1/AC6 açıkça yeniden başlatmada son 100+ olayın görünmesini istiyor. **Red.**

- **Sonuçlar / riskler:**
  - **Sorgu esnekliği düşük.** Bugünkü filtreler için sorun değil; "son 6 ayda hangi agent kaç kez X yaptı" gibi analitik sorular gelirse depo değişmelidir. Sınır: hacim > ~200.000 olay veya gruplama/agregasyon ihtiyacı doğarsa yeni ADR ile `node:sqlite`.
  - **Ani güç kesintisinde son satır yarım kalabilir.** Kabul edildi: okuyucu bunu atlar, veri kaybı bir olaydır. `fsync` her append'te yapılmaz (performans/ömür); `projects.json` gibi kritik dosyalarda yapılır.
  - **`data/` klasörü ham hook payload'ları içerir** (dosya yolları, komut metinleri, prompt parçaları). Bu yüzden `.gitignore`'a alınır ve README'de belirtilir; yanlışlıkla commit edilmesi bilgi sızıntısı olurdu.
  - **Saat/zaman dilimi:** Gün dosyaları **UTC**'ye göre ayrılır (yerel saate göre değil), böylece yaz saati geçişinde dosya adı çakışması veya boşluk oluşmaz. UI yerel saatte gösterir.
  - Depo yolunun varsayılanı `<repo>/data`. `MC_DATA_DIR` ile değiştirilebilir; testler her zaman geçici dizin kullanır.

- **Kullanıcı onayı gerekli mi:** Hayır. Ücret/hesap yok; G0.ok zaten "düz JSONL tercih edilecek" daralmasını bağlayıcı kılmıştı, bu ADR onu doğrular ve dosya düzeniyle somutlaştırır. Yalnızca depo **konumu** (repo içi `data/` vs kullanıcı profili) CEO tarafından G2'de kullanıcıya bilgi olarak sorulur.
