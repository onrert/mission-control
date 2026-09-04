# 01 — PRD

## Özet

Mission Control, App Factory hattında aynı anda çalışan birden çok Claude Code agent'ının ne yaptığını, hangi feature'ın nerede olduğunu ve ne kadar kaynak harcandığını tek bir yerel web panosunda gösteren, tek kullanıcılık (Veron) bir izleme ve kontrol aracıdır. Panel; izlenen proje klasörlerindeki hook olaylarını canlı bir zaman çizelgesinde gösterir, `docs/features/*.md` frontmatter'ından kurduğu bir kanban panosunu sürükle-bırak ile günceller, çok projeli izlemeyi destekler ve (Faz 2'de) feature başına CEO→developer→QA thread'ini sentezler, G0–G6/ASSETS kapı onaylarını dosya yazarak verir, token tüketimini raporlar. Tamamen yerel çalışır; dış servis, bulut, hesap, giriş veya ücretli bağımlılık yoktur.

## Hedef kullanıcı ve problem

**Hedef kullanıcı:** Veron — App Factory hattını tek başına yöneten kullanıcı. Platform: **yalnızca Windows** (kullanıcı kararı 2026-09-04, ADR-009; önceki "macOS de desteklenir" iddiasi düşürüldü). Panel tarayıcı sekmesinde veya VS Code Simple Browser'da açılır.

**Problem:** Bir sprint sırasında birden çok agent (CEO, developer, qa-evaluator, vb.) paralel veya art arda çalışırken, hangi feature'ın hangi aşamada olduğu, bir agent'ın takılıp takılmadığı, bir kapının onay beklediği ve ne kadar token/limit harcandığı yalnızca dağınık dosyalardan (`docs/features/`, `docs/qa/`, `~/.claude/projects/` transkriptleri) veya sohbet geçmişini geri sararak takip edilebiliyor. Kullanıcı hattı büyük ölçüde körlemesine yönetiyor; bir feature takıldığında veya bir kapı onay beklediğinde bunu ancak CEO söylerse fark ediyor.

## Başarı ölçütleri

3 ay sonra "işe yaradı" denebilmesi için, bir sprint sırasında "şu an ne oluyor?" sorusuna sohbet geçmişine dönmeden, yalnızca panele bakarak 5 saniye içinde cevap verilebilmelidir. Bu, aşağıdaki gözlenebilir davranışlarla ölçülür:

1. Çalışan agent'ların hook olayları panel açıkken canlı olarak (olay üretildikten sonra en geç 2 saniye içinde) zaman çizelgesinde görünür.
2. Her feature'ın kanban üzerindeki sütunu, ilgili `docs/features/<id>.md` dosyasının `status` alanıyla her zaman birebir eşleşir (dosya diskte değiştiğinde panel en geç 2 saniye içinde günceli yansıtır).
3. (Faz 2) Bir feature'ın CEO brief → developer raporu → QA kararı → düzeltme turu zinciri, ilgili sözleşme/QA dosyaları mevcutsa tek ekranda kronolojik sırayla okunabilir.
4. (Faz 2) Bir kapı onayı/reddi panelden verildiğinde, ilgili `docs/approvals/<G>.ok` veya `<G>.deny.md` dosyası PROCESS.md §2 formatına (tarih + özet + karar) uygun şekilde yazılır ve CEO bu dosyayı sonraki oturumda doğrudan okuyabilir.
5. (Faz 2) Token ekranı, en az proje ve gün bazında gruplanmış toplam kullanım rakamı gösterir.
6. Faz 1'in üç özelliği (olay sunucusu+zaman çizelgesi, kanban, çok projeli izleme) tek başına, Faz 2 hiç kurulmadan da günlük kullanılabilir bir panel oluşturur — yani Faz 1 bittiğinde panel "yarım ürün" değil, bağımsız çalışan bir üründür.

## MVP özellikleri (öncelik sırasıyla)

### 1. Hook olay sunucusu + canlı zaman çizelgesi — Faz 1, P0

As a Veron, I want to see hook events from running Claude Code agents in a live timeline, so that I can tell what agents are doing right now without switching back to the chat window.

Kabul kriterleri:
1. Sunucu yapılandırılabilir bir portta dinler; port ortam değişkeni ile ayarlanabilir ve varsayılan değer 4000 değildir.
2. İzlenen bir projeye kurulan hook scripti bir olayı (en az session_id, agent_type/agent_id, tool_name, özet, zaman alanlarını içeren JSON) sunucuya POST ettiğinde, olay en geç 2 saniye içinde tarayıcıdaki zaman çizelgesinde, sayfa yenilemeden görünür.
3. Zaman çizelgesindeki her olay satırı en az şunları gösterir: zaman damgası, proje adı, agent tipi/id, araç adı, özet metni.
4. 50 olay/dakika hızında sürekli POST gönderilen bir smoke test senaryosunda, gönderilen olayların en az %99'u UI'da kayıp olmadan ve gönderim sırasıyla görünür.
5. Eksik veya bilinmeyen alan içeren bir olay POST edildiğinde sunucu hata (5xx) döndürmez; olayı "eksik alan" işaretiyle kaydeder/gösterir, çökmez.
6. Sunucu yeniden başlatıldığında, kalıcı depoda saklı son en az 100 olay yeniden yüklenip zaman çizelgesinde görünür (yalnızca bellekte tutulmaz).
7. Zaman çizelgesi proje adına göre filtrelenebilir; bir filtre seçildiğinde yalnızca o projeye ait olaylar listede kalır.
8. (Kullanıcı kararı 2026-09-04) Sunucu YALNIZCA `127.0.0.1` arabirimine bağlanır. Başka bir makineden `http://<makine-ip>:<port>` isteği bağlantı kuramaz. Ağa açma seçeneği, ortam değişkeni veya bayrağı MVP'de yoktur; uzaktan erişim gerektiğinde Tailscale/SSH tüneli kullanılır (üründe kod değişikliği gerektirmez).
9. (Kullanıcı kararı 2026-09-04) TÜM hook olay tipleri kaydedilir ve varsayılan olarak gösterilir; hiçbir tip sessizce atılmaz. Zaman çizelgesinde olay tipi, proje ve agent'a göre çoklu seçilebilir filtre denetimleri bulunur; filtre yalnızca görünümü etkiler, kaydı etkilemez.

### 2. Feature frontmatter kanban panosu — Faz 1, P0

As a Veron, I want to drag a feature card between status columns, so that the feature's markdown file reflects its real status without me hand-editing frontmatter.

Kabul kriterleri:
1. Panel açıldığında izlenen her projenin `docs/features/*.md` dosyaları taranır; her dosyanın frontmatter `status` değerine göre bir kart, PROCESS.md §5'te tanımlı 7 sütundan (todo, contract, dev, qa, fix, done, blocked) ilgili olanda görünür.
2. Bir kart farklı bir sütuna sürükleyip bırakıldığında, ilgili `.md` dosyasının frontmatter'ındaki YALNIZCA `status` alanı güncellenir; başlık, açıklama, kabul kriterleri, dosya sahipliği ve notlar bölümleri karakter bazında değişmeden kalır.
3. Panel, dosya değişikliklerini canlı izler (chokidar veya eşdeğeri); dosya harici olarak (ör. developer agent tarafından) değiştirildiğinde pano en geç 2 saniye içinde güncel durumu yansıtır.
4. Sürükleme anında, panelin bellekte tuttuğu dosya son hali ile diskteki gerçek dosya içeriği aynı değilse (eşzamanlı harici değişiklik / çakışma), yazma işlemi durdurulur, kullanıcıya "dosya değişti, güncel hali yüklendi" uyarısı gösterilir ve kart eski konumuna dönmez — yeni (dış) duruma göre yeniden çizilir. Sessizce üzerine yazma yapılmaz.
5. Dosyaya yazma işlemi başarısız olursa (disk izni, kilit, vb.), kart sürükleme öncesi sütununa geri döner ve ekranda okunabilir bir hata mesajı gösterilir; panel çökmez.
6. Frontmatter'da 7 tanımlı değerin dışında bir `status` bulunursa, o kart "Bilinmeyen durum" adlı ayrı bir sütunda gösterilir; panel çökmez veya kartı gizlemez.
7. Bir karta tıklandığında feature id, title, owner, deps, sprint alanları salt okunur olarak görüntülenir; bu alanlar sürükleme işleminden etkilenmez.

### 3. Çok projeli izleme ayarı — Faz 1, P0

As a Veron, I want to add or remove watched project folders from the panel's settings, so that I can monitor all my App Factory apps from one place without restarting the server.

Kabul kriterleri:
1. Ayarlar ekranından bir proje klasör yolu eklendiğinde, o klasörün `docs/features/*.md` dosyaları sunucu yeniden başlatılmadan en geç 5 saniye içinde kanbanda görünür.
2. Bir proje izlemeden çıkarıldığında, o projenin kartları ve zaman çizelgesi olayları en geç 5 saniye içinde arayüzden kalkar; projenin dosyaları diskte silinmez veya değiştirilmez.
3. `docs/features` alt klasörü bulunmayan geçersiz bir yol eklenmeye çalışıldığında panel bunu hata olarak bildirir ve reddeder; çökmez.
4. En az 3 proje klasörü aynı anda izlenirken, her projenin kanban kartları ve zaman çizelgesi olayları proje adı/etiketiyle ayırt edilebilir şekilde aynı ekranda görünür.
5. İzlenen proje listesi kalıcıdır: sunucu yeniden başlatıldığında önceden eklenmiş projeler elle tekrar eklenmeden otomatik izlenmeye devam eder.

### 4. G0–G6/ASSETS kapılar paneli — Faz 2, P1

As a Veron, I want to approve or reject a gate (G0-G6, ASSETS) directly from the panel, so that I don't have to ask the CEO to write the approval file for me.

Kabul kriterleri:
1. Kapılar ekranı, seçilen proje için G0–G6 ve ASSETS kapılarının güncel durumunu (`docs/approvals/` klasöründeki `.ok`/`.deny.md` dosyalarının varlığına göre: onaylandı / reddedildi / bekliyor) doğru gösterir.
2. "Onayla" butonuna basıldığında `docs/approvals/<G>.ok` dosyası yazılır; içeriği PROCESS.md §2 formatına uygun olarak en az tarih, onaylanan özet ve kullanıcının kararını (bir cümle) içerir.
3. "Reddet" butonuna basıldığında `docs/approvals/<G>.deny.md` dosyası yazılır; içeriği en az tarih ve kullanıcının girdiği red gerekçesini içerir.
4. Aynı kapı için hem `.ok` hem `.deny.md` dosyası aynı anda mevcutsa, panel bunu "çelişkili durum" olarak işaretler, hangi dosyanın daha yeni (değiştirilme zamanı) olduğunu gösterir; hiçbir dosyayı otomatik silmez.
5. Yazma işlemi başarısız olursa (disk izni vb.), buton durumu geri alınır ve okunabilir bir hata mesajı gösterilir; panel çökmez.
6. Panel, izlenen projelerin `docs/features/*.md` (yalnızca status alanı), `docs/approvals/<G>.ok`/`.deny.md` ve `docs/approvals/archive/` dışında hiçbir dosyaya yazmaz; bu, izlenen tüm projelerde otomatik testle (ör. dosya sistemi diff'i) doğrulanabilir.
7. (Kullanıcı kararı 2026-09-04) "Onayla" tek tıkla yazmaz: önce hangi kapının, hangi proje için onaylandığını ve dosyaya yazılacak özeti gösteren bir doğrulama adımı açılır; kullanıcı ikinci kez onaylayınca dosya yazılır. Doğrulama adımı iptal edilirse hiçbir dosya oluşturulmaz.
8. (Kullanıcı kararı 2026-09-04) "Reddet" ayrı bir doğrulama adımı istemez; bunun yerine boş bırakılamayan bir gerekçe metni alanı gösterir ve gerekçe girilmeden dosya yazılmaz. Gerekçe `.deny.md` içine olduğu gibi geçer.
9. Daha önce `.deny.md` yazılmış bir kapı sonradan onaylanırsa, mevcut `.deny.md` silinmez; `docs/approvals/archive/<G>-<YYYY-AA-GG-ss-dd>.deny.md` yoluna taşınır ve `.ok` ondan sonra yazılır. Böylece AC4'teki "çelişkili durum" kendiliğinden oluşmaz ve red gerekçesinin kaydı korunur.

### 5. Feature thread görünümü — Faz 2, P2 (best-effort)

As a Veron, I want to open a feature and read the CEO brief -> developer report -> QA verdict -> fix round chain in one place, so that I understand the full history without opening multiple files or scrolling chat.

Kabul kriterleri:
1. Bir feature kartı için "Thread" görünümü açıldığında, ilgili `docs/qa/<feature>-contract.md` ve `docs/qa/*.md` dosyalarındaki CEO brief, developer raporu ve QA kararı bölümleri kronolojik sırayla listelenir.
2. `~/.claude/projects/**/*.jsonl` transkript kaynağı mevcut değilse, formatı tanınmazsa veya bir satır ayrıştırılamazsa, panel çökmez; yalnızca o feature'ın thread görünümünde "bu bölüm okunamadı" mesajı gösterilir ve kanban/zaman çizelgesi gibi diğer ekranlar normal çalışmaya devam eder.
3. Ayrıştırılamayan satır sayısı sunucu tarafı logda tutulur; arayüzde ham hata/stack trace gösterilmez.
4. Bir feature'ın QA turu 3'ü aşıp CEO tarafından kullanıcıya eskale edildiği durumda (`docs/qa/latest.md` içinde `ESKALE: true`), thread görünümünde bu durum görsel bir işaretle (rozet/etiket) belirtilir.
5. Thread görünümü tamamen salt okunurdur; bu ekrandan hiçbir dosyaya yazma işlemi yapılmaz.

### 6. Token kullanımı — Faz 2, P2 (best-effort)

As a Veron, I want to see how many tokens each agent/session consumed, so that I can spot runaway usage during a sprint before it burns through the weekly limit.

Kabul kriterleri:
1. Token ekranı, yerel transkript verisinden (veya hazır bir raporlama kaynağından) proje, oturum ve agent bazında toplam giriş+çıkış token sayısını gösterir.
2. Kaynak veri okunamadığında (dosya yok, format tanınmıyor, ayrıştırma hatası) ekran "veri yok / okunamadı" durumunu gösterir; panel çökmez ve diğer ekranlar etkilenmez.
3. Rakamlar en az proje ve gün bazında gruplanabilir (ör. "bugün, proje X: N token").
4. Ekranda gösterilen sayılar, herhangi bir ücretli/harici API'ye ağ isteği atılmadan, tamamen yerel dosyalardan hesaplanır.

## Kapsam dışı

- Dış servis, bulut, hesap veya giriş (auth) sistemi.
- Çok kullanıcılı kullanım; panel yalnızca Veron için tek kullanıcılık çalışır.
- Telemetri / kullanım verisinin dışarıya gönderilmesi.
- Claude Code'a panelden komut gönderme veya agent tetikleme (v2 — Channels ile ayrı ele alınacak).
- İzlenen projelerin kod dosyalarına yazma; panel yalnızca izlenen projelerin `docs/features/*.md` frontmatter'ındaki `status` alanına ve `docs/approvals/<G>.ok`/`<G>.deny.md` dosyalarına yazar, başka hiçbir dosyaya dokunmaz.
- Üretim ortamına deploy.
- Ücretli servis, kredi tüketimi veya harici API anahtarı gerektiren bağımlılık (Higgsfield varlık üretimi dahil).
- Native derleme gerektiren depolama (ör. better-sqlite3); kesin depo kararı architect tarafından G2'de verilir, ancak native derleme koşulu bağlayıcıdır.
- Varsayılan sunucu portu olarak 4000.
- Mobil native uygulama; panel yalnızca web/tarayıcı (veya VS Code Simple Browser) üzerinden erişilir.

Gelecek sürüm fikirleri: Panodan CEO'ya doğrudan mesaj gönderme (Claude Code Channels entegrasyonu) — v2.

## Açık sorular — KAPANDI (2026-09-04, G1 öncesi)

(A) Kullanıcıya soruldu ve karara bağlandı; ilgili kabul kriterleri yukarıya işlendi:
1. Ağ arabirimi → **Yalnızca localhost (127.0.0.1)**. Ağa açma seçeneği MVP'de yok; uzaktan erişim Tailscale/SSH tüneliyle. (Özellik 1, AC8)
2. Olay kapsamı → **Tüm olay tipleri kaydedilir ve gösterilir**, üstte tip/proje/agent filtreleri. (Özellik 1, AC9)
3. Kapı butonları → **Onayla'da doğrulama adımı, Reddet'te zorunlu gerekçe metni**. (Özellik 4, AC7-AC8)

(B) CEO kararı — gerekçeler `docs/decisions/ADR-001-mission-control-urun-kararlari.md` dosyasında:
4. Olay saklama: son 30 gün **veya** son 20.000 olay (hangisi önce dolarsa); sınır ortam değişkeniyle ayarlanabilir.
5. "Bilinmeyen durum" sütunundaki kartlar sürüklenebilir — geçerli bir sütuna taşımak düzeltici bir eylemdir ve yalnızca `status` alanını yazar.
6. Bir proje izlemeden çıkarıldığında geçmiş olayları depoda kalır (silinmez); proje geri eklenirse geçmiş yeniden görünür.
7. Reddedilen kapının sonradan onaylanması: `.deny.md` silinmez, `docs/approvals/archive/` altına taşınır. (Özellik 4, AC9)
8. Kanban sütun başlıkları Türkçe etiket + parantez içinde frontmatter değeri gösterir (ör. "Geliştirme (dev)") — arayüz Türkçe kararıyla dosya değerleri arasındaki bağ korunur.
