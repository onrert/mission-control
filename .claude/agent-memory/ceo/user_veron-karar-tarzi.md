---
name: veron-karar-tarzi
description: Veron karar kapılarında kapsamlı/sağlam seçeneği hızlı seçeneğe tercih ediyor ve onaylamadan önce belgeyi okuyor — seçenek sunarken buna göre kurgula
metadata:
  type: user
---

Veron karar kapılarında tutarlı bir örüntü gösteriyor: **CEO "basit/hızlı" olanı önerse bile kapsamlı olanı seçiyor.**

Gözlenen örnekler (2026-09-04, G0–G1 kalibrasyon provası):
- MVP kapsamı: 4 seçeneğin **hepsini** işaretledi (tek maddeyle yetinmedi).
- Silme davranışı: "doğrudan sil" önerildi, **undo çubuğunu** seçti — en pahalı, en çok kenar durumu olan seçenek.
- Artefakt temizliği: "sıfırla" önerildi, **"önce wiki'ye taşı, sonra sıfırla"** seçti — bir alt agent turu daha maliyetli olanı.
- Tek istisna: öncelik kademelerinde önerilen 3 kademeyi seçti (uç seçenekler zaten mantıksızdı).

Ayrıca: G1'de **"onaylıyorum ama önce PRD'yi okuyayım"** dedi. Onay kapılarında belgeyi gerçekten okuyor, körlemesine onay vermiyor.

**Nasıl uygulanır:**
- Seçenek sunarken "en hızlı" olanı tek başına öne çıkarma; kapsamlı seçeneğin maliyetini ve karşılığında ne kazandırdığını net yaz — o karşılaştırmaya bakarak karar veriyor.
- "(Önerilen)" etiketini basitliğe otomatik verme; kalibrasyon/sağlamlık değeri varsa kapsamlı seçenek de önerilen olabilir.
- Kapı raporlarında belgeye tıklanabilir bağlantı ver ve okuması için gerçekten bekle; `.ok` dosyasını acele yazma.
- Pahalı seçeneği seçtiğinde riski ADR'ye yaz ama seçimi tartışma — bilinçli takas yapıyor.

İlgili: [[app-factory-sablon-klasoru]]

## Guvenlik/geri alinamazlik: kontrolu elinde tutar, ama isi sana yaptirir (2026-09-04, F-002)

Push kapisi karari iki turda netlesti ve **ilk okumam yanlisti**.
- 1. tur: "Push'u sen yap" secenegini secti. Etiketteki "sen" belirsizdi; ben "kullanici yapacak"
  diye yorumladim ve ona komut blogu verdim. **Yanlis.** Sonra "nereden push edicem sen
  edemiyor musun?" diye sordu -- kastettigi bendim.
- 2. tur (net secenekler): kapiyi kalici acan "(Onerilen)" secenegimi yine reddetti,
  **"her push'ta bana sor"** dedi. Yani: isi ben yapayim, ama izin her seferinde ondan ciksin.

Sonuc kural: **islemi CEO yapar, yetkiyi kullanici tek seferlik verir.** Kalici otomatik
yetki istemiyor; el isini de kendisi yapmak istemiyor.

**Nasil uygulanir:**
- Geri alinamaz komutlarda (push, deploy, publish, silme) "ben mi sen mi" diye sorma --
  **ben yaparim** varsay; sorulacak tek sey iznin kendisi.
- Guvenlik kapisini kalici gevsetmeyi onerme; tek kullanimlik onay deseni (DANGER.ok /
  PUSH.ok gibi, kullanildiginda silinen) onun tercihidir.
- AskUserQuestion etiketlerinde **"sen"/"ben" zamiri KULLANMA** -- kim yapacagi karisiyor.
  Bunun yerine "CEO push etsin, izin her seferinde sorulsun" gibi ozne acik yaz.
