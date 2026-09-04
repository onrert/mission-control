---
type: desen
updated: 2026-09-04
sources: [docs/progress.md, docs/00-idea.md, docs/decisions/ADR-001-mvp-davranis-kararlari.md, CLAUDE.md]
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

İlgili: [[proje/gorev-listesi-denemesi]] [[hata/claude-code-arac-tuzaklari]]
