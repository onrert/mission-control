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
