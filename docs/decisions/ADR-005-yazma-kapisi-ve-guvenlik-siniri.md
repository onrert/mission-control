# ADR-005: Yazma kapısı ve güvenlik sınırı

- **Tarih:** 2026-09-04
- **Durum:** kabul

- **Bağlam:**
  Mission Control, izlenen projelerin **kaynak gerçeği** olan dosyalarına yazan bir araçtır. `docs/approvals/G0.ok`: *"Panel TAM YAZMA yetkili … Başka hiçbir dosyaya yazılmaz."* `docs/01-prd.md` F4/AC6 bunu ölçülebilir bir kabul kriterine dönüştürüyor: panel yalnızca üç yola yazar ve bu **otomatik testle doğrulanabilir** olmalıdır.

  İzin verilen üç yol (ADR-001 karar 7 ile arşiv de dahil):
  1. `docs/features/*.md` — **yalnızca frontmatter `status` alanı**
  2. `docs/approvals/<G>.ok` ve `docs/approvals/<G>.deny.md`
  3. `docs/approvals/archive/`

  Tehdit modeli klasik "kötü niyetli saldırgan" değil (tek kullanıcı, loopback). Gerçek tehditler şunlar:
  - **Kod kazası:** Bir sonraki feature'da biri `fs.writeFileSync(userProvidedPath, …)` yazar ve sınır sessizce delinir. En olası ve en pahalı senaryo.
  - **Yol kaçışı:** İstemciden gelen `file` parametresi `../../src/index.ts` içerir; veya `docs/features` bir symlink'tir; veya Windows ayracı normalizasyonu yanlış yapılır.
  - **Önek tuzağı:** `C:\dev\app` kökü ile `C:\dev\app-factory` hedefi dizge önek karşılaştırmasında "içeride" görünür.
  - **DNS rebinding:** Bir web sayfası `127.0.0.1`'e çözülen bir alan adı üzerinden panele kapı onayı yazdırır.
  - **Yanlışlıkla veri kaybı:** Kullanıcı yanlış kapıya basar, panel `.deny.md` dosyasını siler ve gerekçe kaydı kaybolur.

- **Karar:**
  Yazma yetkisi **tek bir modülde** toplanır (`src/server/write-gate.ts`) ve dışarıya **niyet düzeyinde** API verir.

  1. **Genel `write(path, content)` fonksiyonu yoktur.** Dışa açılan tek yüzey dört işlemdir: `patchFeatureStatus`, `writeGateApproval`, `writeGateDenial`, `archiveDenial`. Hedef yol her zaman modül içinde, doğrulanmış parçalardan `path.join` ile kurulur; çağıran taraf ham yol veremez.
  2. **Altı adımlı kontrol** (detay: `docs/02-architecture.md` §7.1):
     kök doğrulama → dosya adı deseni (`[A-Za-z0-9._-]+\.md`, `path.basename(x) === x`) → en yakın var olan atanın `realpathSync`'i (symlink kaçışı) → `path.relative` ile kapsama (dizge öneki **değil**) → POSIX'e çevrilmiş göreli yol üzerinde beyaz liste eşlemesi → **işlem/yol eşleşmesi** (`writeApproval` bir `docs/features` yoluna denk gelirse reddedilir).
  3. **Yol işlemlerinde elle regex yasak.** Yalnızca `node:path` API'si; ayraç dönüşümü `split(path.sep).join('/')`. Gerekçe: fabrika `CLAUDE.md`'de kayıtlı öğrenilmiş kural — ters bölü içeren regex/`replace` kodu araç zincirinde bozulabiliyor ve bu tam olarak güvenlik sınırının bağlı olduğu koddur.
  4. **Silme yoktur.** Modülde `unlink`/`rm`/`rmdir` çağrısı bulunmaz. Reddedilen kapı sonradan onaylanırsa `.deny.md` **rename** ile `docs/approvals/archive/<G>-<YYYY-AA-GG-ss-dd>.deny.md`'ye taşınır (ADR-001 karar 7). Retention silmesi ayrı bir modüldedir ve yalnızca `MC_DATA_DIR` altında çalışır.
  5. **Her yazma atomiktir:** aynı dizine `.tmp` → `fsync` → `rename`. Windows'ta `EPERM`/`EBUSY` için 3 kademeli yeniden deneme (50/100/200 ms), sonra `write_failed`. `tmp` dosyası `finally` içinde her koşulda temizlenir.
  6. **Frontmatter yazımında YAML round-trip yapılmaz.** Dosya metin olarak ele alınır, yalnızca girintisiz ilk `status:` satırı değiştirilir; satır sonları, yorumlar, sıra ve girinti karakter bazında korunur. Okuma için `yaml` paketi kullanılır, yazma için asla.
  7. **Çakışma kontrolü zorunludur.** Her `patchFeatureStatus` çağrısı istemcinin okuduğu içeriğin `sha256`'sını taşır; disk farklıysa **hiçbir şey yazılmaz**, `conflict` döner ve UI diskteki güncel duruma göre yeniden çizer (PRD F2/AC4).
  8. **Ağ sınırı savunma katmanıdır, tek başına yeterli sayılmaz.** `listen(port,'127.0.0.1')` + `Host` başlığı beyaz listesi (DNS rebinding) + yazma uçlarında `Origin` beyaz listesi (CSRF). `MC_HOST` gibi bir ortam değişkeni **yoktur ve eklenmeyecektir** (ADR-001 karar 1).
  9. **Kapı onayı yazmak, iki adımlı ve geri alınabilirdir.** UI doğrulama adımı gösterir ve sunucu `confirmed: true` ister (ADR-001 karar 3). Geri alınabilirlik: yazılan `.ok` bir metin dosyasıdır, kullanıcı silebilir; panel `.deny.md` dosyalarını asla yok etmez (arşivler), böylece kapı geçmişi denetlenebilir kalır. Panel **hiçbir zaman** bir onay dosyasını kendiliğinden silmez veya üzerine yazmaz — mevcut bir `.ok` üzerine yeniden onay yazmak açık bir kullanıcı eylemidir ve yine doğrulama adımından geçer.
  10. **Sınır iddiası otomatik test edilir** (bu maddenin olmadığı bir tasarım kabul edilmez):
      - *Manifest testi:* zengin bir fixture projenin özyinelemeli `(yol, boyut, mtime, sha256)` manifesti alınır, tüm yazma uçları (geçerli + kötü niyetli girdilerle) çalıştırılır, manifest yeniden alınır; değişen yollar kümesi izinli üç yolun alt kümesi olmalı ve **silinen yol sayısı sıfır** olmalıdır. Bu, PRD F4/AC6'nın birebir karşılığıdır.
      - *Statik guard testi:* `src/**` taranır; `writeFile*`, `appendFile*`, `rename*`, `unlink*`, `rm`, `rmdir`, `mkdir*`, `cp*`, `createWriteStream`, `truncate*` çağrıları yalnızca `write-gate.ts` ve `src/server/store/*` içinde bulunabilir. Başka yerde bulunursa test kırılır. Aynı test `0.0.0.0` ve `MC_HOST` literallerini de arar.
      - *Yol tablosu testi:* ~25 vakalık beyaz liste tablosu (traversal, symlink, Windows ayracı, önek tuzağı, yanlış uzantı, alt klasör, işlem/yol uyumsuzluğu).

- **Alternatifler ve neden reddedildi:**
  - **Her feature kendi yazmasını yapsın, konvansiyonla dikkat edelim:** İhlal sessizdir ve ancak bir kullanıcı dosyası bozulduğunda fark edilir. Test edilebilir bir iddia üretmez, yani PRD F4/AC6 karşılanamaz. **Red.**
  - **Kapıya ham yol veren genel `writeAllowed(path, content)` API'si:** Beyaz liste yine çalışır ama çağıran taraf yolu kurduğu için hata yüzeyi çağıranlara dağılır ve "hangi işlem hangi yola izinlidir" ilişkisi kaybolur (ör. onay içeriğinin bir feature dosyasına yazılması engellenemez). **Red** — niyet tabanlı API tercih edildi.
  - **İşletim sistemi düzeyinde izin/jail (ayrı kullanıcı, ACL, container):** Tek kullanıcılık bir yerel araç için orantısız kurulum yükü; Windows'ta ayrıca kırılgan. Fayda/karmaşıklık oranı düşük. **Red.**
  - **Yazma öncesi kullanıcıya her seferinde onay diyaloğu (kanban dahil):** Sürükle-bırak'ın tüm faydasını yok eder (kullanıcı zaten dosyayı elle düzenlemekten kaçmak istiyor). Kapı yazımlarında doğrulama adımı var, çünkü orada yanlış tıklamanın bedeli yüksek. **Red (kanban için), kabul (kapılar için).**
  - **Yazmadan önce `.bak` yedeği almak:** İzlenen projede yeni dosyalar oluşturur — yani beyaz listeyi genişletmek zorunda kalırız ve "panel çöp bırakmaz" ilkesi bozulur. Zaten projeler git altındadır; gerçek geri alma mekanizması git'tir. **Red.**
  - **`chmod`/salt-okunur işaretlerle koruma:** Panelin yazması gereken dosyalar bunlar; koruma yanlış katmanda. **Red.**

- **Sonuçlar / riskler:**
  - **Yeni bir yazma ihtiyacı = ADR + beyaz liste değişikliği + manifest testi güncellemesi.** Bu bilinçli bir sürtünmedir; sınırın genişlemesi görünür olmalıdır.
  - **Statik guard testi kaçak verebilir** (ör. `fs['write'+'File']` gibi dolaylı çağrı). Kabul edilen sınır: test kaza eseri ihlalleri yakalar, kasıtlı atlatmayı değil — tehdit modelimizde kasıtlı iç saldırgan yok. Manifest testi ikinci savunma hattıdır ve dolaylı çağrıları da yakalar.
  - **`realpath` maliyeti:** Her yazmada birkaç `realpathSync` çağrısı; dakikada birkaç yazma olan bir araçta ölçülemez.
  - **Symlink'li proje kökleri:** Kök, kayıt anında `realpath`'lenir. Kullanıcı kaydettikten *sonra* projeyi symlink'e çevirirse hedef ata çözümlemesi bunu yakalar ve yazma reddedilir; kullanıcı projeyi yeniden ekler. Kabul edilebilir davranış (sessiz yanlış yazmaktansa görünür ret).
  - **`.ok` dosyası panelden yazıldığında "kullanıcının onayı" sayılır** (G0.ok kararı). Bu, kapı doktrininin güvenliğini panelin UI doğrulama adımına bağlar; bu yüzden AC7 (iki adım) ve sunucudaki `confirmed: true` kontrolü tavizsizdir ve E2E testinde "iptal edilince hiçbir dosya oluşmaz" iddiasıyla doğrulanır.
  - **Panel çalışırken `docs/approvals/` elle düzenlenirse** panel bunu yalnızca okur ve gösterir; çelişkili durumu (`.ok` + `.deny.md`) işaretler, düzeltmez (PRD F4/AC4).

- **Kullanıcı onayı gerekli mi:** Hayır — bu ADR mevcut onaylı sınırı **daraltmıyor veya genişletmiyor**, yalnızca nasıl zorlanacağını tanımlıyor. Ücret/hesap yok. (Sınırın kendisi G0/G1'de zaten onaylandı.)

---

## Ek — F-012 sohbet arayüzü yazma sınırını **ikiye ayırır** (2026-09-06, `ADR-014`)

F-012 ile panel, CEO oturumunu kendi içinde barındırıyor. Bu, yukarıdaki "üç yol" kuralının
kapsamını netleştirmeyi zorunlu kılıyor — çünkü barındırılan CEO'nun **kendi araçları** var
(`Write`, `Edit`, `Bash`) ve bunlar üç yolla sınırlı değil.

### İki ayrı yazma öznesi, iki ayrı kural

**(1) Panelin kendi yazması — DEĞİŞMEDİ.** Kanban sürüklemesi, kapı onayı, arşivleme. Yukarıdaki
üç yol kuralı ve `no-delete-guard` / dosya sistemi manifest testleri **aynen geçerli**. F-012 bu
kümeye tek bir yol bile eklemez; sohbet uçları izlenen projelere yazmaz.

**(2) Barındırılan CEO oturumunun yazması — YENİ ve üç yolla SINIRLI DEĞİL.** CEO bir yazılım
ekibi yönetiyor; görevi gereği kod yazar, commit atar, komut çalıştırır. Onu üç yola hapsetmek
aracı işlevsiz bırakırdı. Bu **bilinçli bir genişletmedir**, kaçak değil.

### Genişlemeyi tutan şey nedir

Sınır artık "hangi yollara yazılabilir" değil, **"kim izin veriyor"**:

- **Hook kapıları.** `.claude/hooks/` altındaki altı kapı barındırılan oturumda da çalışır ve
  **engeller**. Bu varsayım değil, ölçüldü (`SPIKE-002-asama0-olcum.md` M2, iki yönlü: hook
  aktifken engellendi, hook no-op yapılınca aynı komut geçti). Yıkıcı komut, uzak depoya gönderme
  ve kapı onayı korumaları bu yolda da ayakta.
- **İzin akışı kullanıcıya çıkar.** Otomatik onay YASAK, "hepsine izin ver" kısayolu YASAK
  (`ADR-014` K3). Yani üç yol dışına her çıkış, kullanıcının **o an verdiği** karara bağlıdır.
- **`x-mc-write`.** Sohbet uçlarının hepsi `ADR-013`'e tabidir, muafiyet yok. Panele serbest
  metin vermek, panele dolaylı olarak CEO'nun tüm yetkisini vermektir — CSRF savunması burada
  `POST /api/events`'ten daha kritiktir.
- **Bağlam sınırı.** İzlenen projelerin olay akışı CEO'nun bağlamına **beslenmez** (`ADR-014` K4).
  Aksi hâlde izlenen bir projedeki metin CEO'ya talimat gibi geçebilirdi.

### Bunun anlamı — açıkça yazılıyor ki sonraki feature varsaymasın

Mission Control artık **iki güven seviyesi** taşıyor: panelin kendi yazma kapısı (dar, statik
olarak çitlenmiş) ve barındırılan oturum (geniş, kullanıcı onayı + hook kapılarıyla tutulan).
İkisini **aynı testle** ölçmeye çalışmak hatadır: dosya sistemi manifest testi ikinci seviyeyi
kapsamaz ve kapsamamalıdır. Kapsıyormuş gibi yazılmış bir test, bu deponun en pahalı hata
sınıfına (yeşil ama hiçbir şey ölçmeyen test) yeni bir örnek eklerdi.

Bu yüzden ikinci seviyenin çiti **hook engellemesinin kendisidir** ve iki yönlü test edilmek
zorundadır — "hook yükleniyor" testi kabul edilmez.
