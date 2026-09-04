# ADR-001: Mission Control ürün davranışı kararları (G1)

- **Tarih:** 2026-09-04
- **Durum:** kabul
- **Bağlam:** PRD (`docs/01-prd.md`) 8 açık soruyla geldi. PROCESS.md §3 uyarınca yalnızca ürün davranışını değiştiren 3 soru kullanıcıya soruldu; kalan 5 düşük etkili soruyu CEO karara bağladı. Bu ADR her iki grubu da kayda geçirir ki architect (G2) ve developer aynı varsayımlarla çalışsın.

- **Karar:**
  1. **Ağ arabirimi (kullanıcı kararı):** Sunucu yalnızca `127.0.0.1` dinler. Ağa açan bayrak/ortam değişkeni MVP'de yok. Telefondan erişim gerekirse Tailscale/SSH tüneli kullanılır.
  2. **Olay kapsamı (kullanıcı kararı):** Tüm hook olay tipleri kaydedilir ve varsayılan olarak gösterilir; gürültü, görünümü etkileyen (kaydı etkilemeyen) tip/proje/agent filtreleriyle yönetilir.
  3. **Kapı butonları (kullanıcı kararı):** "Onayla" ikinci bir doğrulama adımı ister ve yazılacak özeti önce gösterir; "Reddet" ayrı doğrulama istemez ama zorunlu gerekçe metni alır.
  4. **Olay saklama (CEO):** Son 30 gün veya son 20.000 olay — hangisi önce dolarsa. Sınır ortam değişkeniyle ayarlanabilir. Gerekçe: tek kullanıcılık yerel araçta sınırsız büyüme gereksiz; bu sınır düz dosya deposunu da rahat tutar.
  5. **"Bilinmeyen durum" sütunu (CEO):** Kartlar sürüklenebilir. Gerekçe: bozuk bir `status` değerini panelden düzeltmek düzeltici bir eylemdir ve yazma zaten yalnızca `status` alanına yapılır; kartı kilitlemek kullanıcıyı dosyayı elle açmaya zorlardı.
  6. **İzlemeden çıkarılan proje (CEO):** Geçmiş olayları depoda kalır, silinmez; proje geri eklenirse geçmiş yeniden görünür. Gerekçe: veri silmek geri alınamaz, izleme listesinden çıkarmak ise geri alınabilir bir görünüm işlemidir; ikisi karıştırılmamalı.
  7. **Reddedilen kapının sonradan onaylanması (CEO):** `.deny.md` silinmez, `docs/approvals/archive/<G>-<zaman>.deny.md` yoluna taşınır, sonra `.ok` yazılır. Gerekçe: red gerekçesi denetim kaydıdır; ayrıca PRD'deki "aynı anda hem .ok hem .deny" çelişki durumu bu sayede oluşmaz.
  8. **Kanban sütun başlıkları (CEO):** Türkçe etiket + parantezde frontmatter değeri (ör. "Geliştirme (dev)"). Gerekçe: arayüz Türkçe kararı korunur ama kullanıcı hangi değerin dosyaya yazıldığını her zaman görür.

- **Alternatifler ve neden reddedildi:**
  - Ağı `0.0.0.0`'a açmak (env ile opt-in): Panel kapı onayı yazan bir araç ve giriş sistemi yok; aynı ağdaki herhangi bir cihazın kapı geçirebilmesi kabul edilemez. Paylaşılan anahtarlı erişim ise G0'daki "giriş yok" ilkesine aykırı ve MVP'ye auth işi ekliyordu.
  - Yalnızca olay alt kümesini kaydetmek: Depolama ucuz, ama kaydedilmeyen olay geri getirilemez; "neden böyle olmuş" sorusunun cevabı kaybolur.
  - Kapı butonlarında tek tık: Yanlış tıkla `.ok` yazılması kapı doktrinini sessizce deler; düzeltmek elle dosya silmeyi gerektirir.
  - Her iki butonda da doğrulama: Reddetme zaten gerekçe yazmayı gerektirdiği için ikinci bir onay adımı gereksiz sürtünme.
  - Sınırsız olay saklama: Düz dosya deposunda dosya boyutu kontrolsüz büyür, ilk yükleme yavaşlar.

- **Sonuçlar / riskler:**
  - Uzaktan erişim ürünün değil kullanıcının sorumluluğunda (Tailscale). Panel "neden telefondan açılmıyor" sorusuna karşı README'de açıklanmalı.
  - Arşiv klasörü panelin yazma izni verilen üçüncü yol oluyor: `docs/features/*.md` (status), `docs/approvals/<G>.ok|.deny.md`, `docs/approvals/archive/`. Yazma kapsamı testi bu üçünü kapsamalı.
  - Retention sınırı aşıldığında eski olayların budanması bir silme işlemidir; yalnızca panelin kendi olay deposunda geçerlidir, izlenen projelerin hiçbir dosyasında değil.

- **Kullanıcı onayı gerekli mi:** 1-3 numaralı kararlar kullanıcıya soruldu ve onaylandı (2026-09-04). 4-8 CEO kararı; ücret, hesap veya geri alınamaz sonuç içermiyor.
