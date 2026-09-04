---
id: F-011
title: Token kullanımı ekranı (proje / gün / oturum / agent grupları)
status: todo
owner: developer
deps: [F-009]
sprint: 2
---
## Açıklama
Yerel transkriptlerden token tüketimini toplar ve gösterir. Kendi minimal okuyucumuz kullanılır (G2'de onaylandı); ccusage yalnızca elle çapraz kontrol için README'de önerilir.
Kaynak: PRD özellik 6; `docs/03-ux.md` ekran 6; ADR-007 karar 3.

## Kabul kriterleri
- [ ] Yalnızca `type: "assistant"` satırları okunur; `message.usage.*` alanları (input, output, cache_creation, cache_read) toplanır. Konuşma yeniden kurulmaz.
- [ ] Rakamlar proje, gün, oturum ve agent bazında gruplanabilir; agent bilgisi `subagents/*.meta.json` içindeki `agentType`'tan gelir (PRD F6/AC1, AC3).
- [ ] Kaynak okunamadığında ekran "veri yok / okunamadı" gösterir; panel çökmez, diğer ekranlar etkilenmez (PRD F6/AC2).
- [ ] Tanınan satır oranı düştüğünde "veri eksik olabilir" uyarısı gösterilir (ADR-007 risk azaltımı).
- [ ] Hesaplama tamamen yereldir; hiçbir ağ isteği atılmaz (PRD F6/AC4).
- [ ] README'de `ccusage` ile elle çapraz kontrol yöntemi anlatılır.
- [ ] 64 MB üzeri transkript dosyalarında yalnızca son 32 MB okunur ve bu davranış testlidir.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/usage/**`, ilgili testler, `README.md` (çapraz kontrol bölümü).

## Notlar / kararlar
- G0.ok'taki "hazır kaynak öncelikli" daralmasından bilinçli sapma; G2'de kullanıcı onayladı.
