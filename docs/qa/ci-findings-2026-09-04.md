# CI ilk koşu bulguları — 2026-09-04

Koşu: https://github.com/onrert/mission-control/actions/runs/33909204942 (commit `9ae23bf`)
Sonuç: **failure** · `verify (ubuntu-latest)` → 2 failed / 131 passed (133) ·
macOS ve Windows job'ları iptal edildi (fail-fast), yani **henüz doğrulanmadılar**.

Bu, F-001'in AC2 (macOS/Linux kurulumu) ve AC9 (CI gerçekten koşuyor) borcunun kapanması için
atılan ilk push'tur. İlk koşuda iki platform bağımlı test yakalandı — yerelde (Windows) 133/133
yeşildi.

## CI-1 — `tests/server/store/retention.test.ts:76`

```
AssertionError: expected false to be true
expect(isInsideDataRoot(root, mixed)).toBe(true)
```

Karışık yol ayracı (`\` ve `/`) içeren bir yolun veri kökü içinde sayılması bekleniyor.
Windows'ta `\` bir ayraçtır, **Linux'ta ise dosya adında geçerli bir karakterdir** — dolayısıyla
Linux'ta `false` dönmesi büyük ihtimalle **doğru davranıştır** ve kusur testin kendisindedir
(platform varsayımı). Düzeltirken dikkat: `isInsideDataRoot` bir **güvenlik çitidir** (AC-6);
testi geçirmek için çiti gevşetmek YASAK. Beklenti platforma göre koşullanmalı, çit değil.

## CI-2 — `tests/server/store/jsonl-store.test.ts:175`

```
AssertionError: expected 9 to be 10
```

Kaynağı belirsiz. İki hipotez, ikisi de doğrulanmalı:
- **Gün sınırı / saat dilimi:** gün dosyası adı yerel tarihe göre üretiliyor (mimari §5.5,
  TC gün sınırı). CI **UTC** koşuyor; yerel gün ile UTC gün ayrıştığında dosya dağılımı ve
  sayımlar kayabilir.
- **Seq semantiği (Ö1):** QA'nın bulduğu `.seq` kayma hatasının Linux'ta farklı tezahürü.

## Sonraki adım
Bu iki madde, süren düzeltme turundan **sonra** açılacak turun kapsamına eklenecek.
Ek olarak: fail-fast yüzünden macOS/Windows job'ları hiç koşmadı; CI yeşile döndüğünde
üç platformun da gerçekten geçtiği teyit edilmeli (AC2 ancak o zaman kapanır).
