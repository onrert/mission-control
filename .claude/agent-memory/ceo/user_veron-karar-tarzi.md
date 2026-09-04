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

## İstisna: güvenlik/geri alınamazlık söz konusuysa kontrolü elinde tutar (2026-09-04, F-002)

"Kapsamlı olanı seçer" kuralı **güvenlik kapılarında geçerli değil.** Push kapısı kararında
CEO'nun "(Önerilen)" işaretlediği kapsamlı seçeneği (hook'u ikiye ayır, `PUSH.ok` diye kalıcı
hafif bir kapı ekle) **reddetti**; en el işi olan "depoyu sen hazırla, push'u ben çalıştırırım"
seçeneğini aldı — her feature sonunda tekrar edeceğini bilerek.

Aynı oturumda GitHub deposu açmayı hemen onayladı (yeni yetenek = evet), ama **push'u kendi
terminalinde tutmayı** seçti. Ayrım net: *yeni iş yapmak* konusunda cömert, *kendi adına geri
alınamaz işlem tetikleyen bir otomatizmayı kalıcılaştırmak* konusunda cimri.

**Nasıl uygulanır:**
- Güvenlik hook'unu gevşetmeyi/otomatikleştirmeyi öneren seçenekleri "(Önerilen)" yapma;
  manuel seçeneği eşit ağırlıkta sun ve tekrar maliyetini dürüstçe yaz.
- Geri alınamaz komutları (push, deploy, publish, silme) ona hazır komut bloğu olarak ver,
  kendin çalıştırmayı teklif etme.
- Tekrarlayan el işinden şikâyet edene kadar otomatikleştirmeyi tekrar önerme;
  önerirsen "kaçıncı tekrar" olduğunu belirt.
