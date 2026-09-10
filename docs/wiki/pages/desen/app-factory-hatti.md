---
type: desen
updated: 2026-09-11
sources: [docs/progress.md, docs/00-idea.md, docs/decisions/ADR-001-mvp-davranis-kararlari.md, CLAUDE.md, docs/qa/F-008-contract-review-1.md, docs/qa/F-008-contract-review-2.md, docs/qa/F-008-contract.md, docs/qa/F-008-2026-09-09.md, docs/qa/F-009-2026-09-09.md, docs/qa/F-011-2026-09-10.md]
---
# App Factory hattı — G0→G1 gözlemi

App Factory kalibrasyon provasında (bkz. [[proje/gorev-listesi-denemesi]]) hat uçtan uca G0→G1 aralığında çalıştırıldı: ceo → idea-validator → pm → pm (revizyon), 3 alt agent, ~139k token.

## Gözlenen akış
- ceo tek oturum olarak kullanıcıyla konuştu, alt agent'ları eksiksiz brief ile başlattı
- idea-validator rakip/talep/farklılaşma/risk analizi yaptı; "DEVAM" kararını ürün başarısına değil kalibrasyon amacına göre gerekçelendirdi
- pm PRD'yi üretti, 6 açık ürün davranışı sorusu bıraktı
- CEO, PROCESS §3 uyarınca sorulardan düşük etkili 4 tanesini kendi karara bağlayıp ADR-001'e yazdı; yalnızca ürün davranışını belirgin değiştiren 2 tanesini (silme davranışı, öncelik kademeleri) kullanıcıya sordu — sorular toptan kullanıcıya yıkılmadı
- Hook'lar canlı devreye girdi: kurulum sırasında mağaza gönderim komutu içeren bir yazma girişimi G6 onayı yok diye engellendi

## Delegasyon brief'i
Bu ortamda ToolSearch kapalı, dolayısıyla SendMessage yok — bir alt agent'ın işini başka agent'a "devam ettir" diye aktarmak mümkün değil, agent'lar birbirinin geçmişini görmüyor. Bu kısıtlama nedeniyle her agent'a brief eksiksiz yeniden yazıldı ve akış yine de temiz kapandı (bkz. [[hata/claude-code-arac-tuzaklari]]).

## Henüz kalibre edilmedi
- Sözleşme → kod → QA döngüsü
- qa-evaluator'ın gerçek bir bulgu yakalama kabiliyeti
- KALDI/düzeltme turları
- 3-tur eskalasyonu
- G2 hook'unun gerçek kod yazımını engellemesi
- G4, G5, G6 kapıları
- higgsfield asset akışı (MCP kimlik doğrulaması hiç yapılmadı, asset akışı hiç denenmedi)

## Sözleşme turunun ölçülmüş getirisi (Faz 2 kapanışı)

Bir "sözleşme turu" — kod yazılmadan önce, bir QA rolünün özellik sözleşmesini (kabul kriterleri,
test/mutasyon planı, güvenlik sınırı analizi) baştan sona denetlemesi — güvenlik sınırını
değiştiren feature'larda kendini fazlasıyla ödüyor. Kapıları onaylama/reddetme akışını (bir
güvenlik sınırı feature'ı) değiştiren F-008'de **üç sözleşme turu 20 bulgu kapattı, hiç kod
yazılmadan**: 1. tur 6 bloklayıcı + 11 önemli bulgu buldu (`docs/qa/F-008-contract-review-1.md`),
2. tur bunların 17'sini kapattı ve 2 yeni bloklayıcı + 1 önemli bulgu ekledi
(`docs/qa/F-008-contract-review-2.md`), 3. tur (sözleşmenin kendisine işlendi) kapanışı sağladı ve
kod turu tek seferde **GEÇTİ** aldı (`docs/qa/F-008-2026-09-09.md`). Bulguların **üçü**, kod
turunda çok daha pahalıya patlardı:
- **E2E test katmanı hiçbir Playwright config'inde çalışmıyordu** (`gates.spec.ts` dört config'in
  hiçbirinin `testMatch` listesinde yoktu) — kod yazılıp `verify` çalıştırıldıktan sonra fark
  edilseydi, o katmana atanan kabul kriterlerinin (gerçek dosya sistemi testleri dahil) **hiç
  koşmadığı** sessizce kaçabilirdi.
- **Panelin ürettiği bir davranış, onaylanmış UX + ADR + PRD'nin birlikte yasakladığı bir
  durumu üretiyordu** (sözleşme "onaylı bir kapı reddedilebilir" diye kural koymuştu; üç belge
  de bunu açıkça yasaklıyordu) — kod yazıldıktan sonra bu ancak manuel bir UX denetimiyle
  yakalanabilirdi.
- **Yeni eklenen bir mutasyon testinin iddiası tersti**: doğru kodda KIRMIZI, mutasyona uğramış
  kodda YEŞİL veriyordu (§6'nın yarı-başarı sırasıyla çelişiyordu) — bu tür bir mutasyon, kod
  turunda "test yazıldı, mutasyonla doğrulandı" güveniyle fark edilmeden geçebilirdi, çünkü
  doğru kod zaten mutasyon testinden **kırmızı** geçtiği için kimse tersine bakmaz.

Genel kural: sözleşme turunun maliyeti gerçek ama sabit (üç tur ≈ birkaç yüz bin jeton); kod
turunda aynı bulguları yakalamanın maliyeti değişken ve genelde daha yüksektir, çünkü bulgu ne
kadar geç yakalanırsa etrafına o kadar çok kod/test birikir. Güvenlik sınırını değiştiren her
feature'da sözleşme turu **zorunlu** sayılmalı (bkz. [[desen/cit-tasarimi]]).

## Tur bölünmesi ve "önce commit" disiplini

Büyük feature'ları (özellikle sunucu + arayüz ikisini birden içerenleri) tek bir agent turuna
sığdırmaya çalışmak, bu ortamın 150-turluk sınırına tekrar tekrar çarpar. Bu depoda dokuz kez
aynı feature (F-012) için tur sınırına takılındı; "her 2-3 adımda commit at" talimatı **tek
başına** yetmedi — dokuz turun dokuzu da sınıra takıldı, ikisinde iş **tamamen** commit'siz
kaldı. Talimat ancak devam brief'inin **ilk maddesi** "ŞİMDİ commit at, başka hiçbir şey yapma"
olarak yazıldığında tuttu. İki ders birlikte çalışıyor: (1) büyük feature'ları önceden tur
bazında böl (ör. sunucu turu + arayüz turu, ayrı brief'lerle), (2) her devam brief'inin ilk
satırı zorunlu commit olsun — testler kırmızıyken bile WIP commit kabul edilir. Kesilen agent'ın
tur sınırına takılmadan hemen önceki son cümlesi, nerede kalındığını en iyi anlatan bilgidir;
devam brief'ine aynen taşınmalı.

## Feature'ın ana vaadi, en az test edilen şeydir

Faz 2 kapanışında üç ayrı feature'da art arda gözlenen desen: bir feature'ın **var olma
gerekçesi** olan tek iddia (ekranın gösterdiği rakamın doğruluğu, fixture'ların gerçekten
anonim olması, self-approval'in gerçekten mümkün olmaması), o feature'ın **en zayıf
test edilen** yüzeyi çıkıyor — çünkü geliştirici doğal olarak "mekanizmanın çalıştığını"
(ör. toplama aritmetiği doğru mu) test ediyor, "mekanizmanın **doğru şeyi** ölçtüğünü" değil:
- **F-011 (Token kullanımı ekranı):** ekranın tek varlık gerekçesi gösterdiği rakamın doğru
  olmasıydı. QA'nın bağımsız yeniden uygulaması panelin kodunu **birebir** doğruladı — ama
  panel yine de gerçek harcamanın **iki katına yakın** (%101 fazla) bir sayı gösteriyordu, çünkü
  aynı API çağrısı transkriptte birden çok satıra yayılıyor ve her satır aynı `usage` nesnesini
  taşıyordu; hiçbir birim testi bunu görmedi çünkü hepsi elle yazılmış, tekrarsız fixture'lara
  dayanıyordu (`docs/qa/F-011-2026-09-10.md` B1).
- **F-009 (Transkript spike'ı):** feature'ın "asıl riski" açıkça sızıntıydı ve onu taşıyan tek
  yapısal savunma (gizlilik çiti) ilk turda **12 sızdıran fixture'ın 12'sinde de** yenildi —
  okuyucunun kendisi (asla fırlatmama, yol kaçışı reddi) kusursuzdu, ama feature'ın var olma
  sebebi olan gizlilik garantisi hiç sağlanmıyordu (`docs/qa/F-009-2026-09-09.md` B1).
- **F-008 (Kapılar paneli):** feature'ın merkezi güvenlik iddiası "barındırılan CEO oturumu
  kendi kapılarını onaylayamaz" idi; sözleşme bu iddiayı yalnızca **HTTP yolu** üzerinden
  kanıtlamıştı ("ağa çıkabilecek tek araç Bash") ve dosyayı **doğrudan `Write` aracıyla** yazma
  yolunu hiç değerlendirmemişti — beş dolaylı kanıt zinciri bu yolun izin kartı çıkmadan
  geçebileceğini gösteriyordu (`docs/qa/F-008-contract-review-1.md` B1).

Genel kural: bir feature'ın kabul testi listesini gözden geçirirken "hangi test, bu feature'ın
var olma sebebini doğrudan ölçüyor?" diye ayrı bir soru sor — o test genellikle listede ya hiç
yok, ya da dolaylı bir yolla (mekanizmanın iç tutarlılığıyla) ölçülüyor, dış bir referansla değil
(bkz. [[desen/cit-tasarimi]] §5).

İlgili: [[proje/gorev-listesi-denemesi]] [[hata/claude-code-arac-tuzaklari]] [[desen/cit-tasarimi]] [[desen/onay-mekanizmasi-tasarimi]]
