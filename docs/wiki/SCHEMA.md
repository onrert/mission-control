# docs/wiki — Mühendislik Hafızası Şeması (Karpathy LLM Wiki deseni)

## Klasörler
- `raw/` — ham kaynaklar: kullanıcının notları, makale özetleri, dış dokümanlar. Salt-okunur; librarian burayı derler, düzenlemez.
- `pages/` — derlenmiş sayfalar. Türler: `stack/<ad>.md` (teknoloji notu), `karar/<ad>.md` (ADR özetleri, projeler arası), `hata/<ad>.md` (tekrar eden hata + çözüm), `proje/<ad>.md` (her uygulama için bir sayfa), `desen/<ad>.md` (işe yarayan akışlar/promptlar).
- `index.md` — tüm sayfaların tek satırlık listesi (tür + özet).
- `log.md` — tarih sıralı işlem günlüğü (ne eklendi/değişti, kaynağı).

## Sayfa formatı
```
---
type: stack | karar | hata | proje | desen
updated: YYYY-MM-DD
sources: [raw/…, docs/…]
---
# Başlık
Kısa özet (2–3 cümle). Gövde. İlgili: [[sayfa-adı]] …
```

## Kurallar
- Kapsamı belirtilmiş güncelleme: "X ve Y sayfalarını şu kaynağa göre güncelle." Kapsamsız istek reddedilir.
- Çelişki: silme; sayfaya "## Çelişki" bloğu ekle, tarih ve kaynakla.
- Her /retro sonrası: hata/ ve desen/ sayfaları öncelikli; log.md'ye giriş.
- Obsidian: `docs/` vault kökü; wikilink'ler `[[pages/stack/nextjs]]` biçiminde.
