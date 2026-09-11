Onay dosyaları: G1.ok, G2.ok, G3.ok, ASSETS.ok, G4-1.ok, G5.ok, G6.ok, DANGER.ok (tek kullanımlık).
Yalnızca CEO, kullanıcı açıkça onayladıktan sonra yazar. İçerik: tarih + onaylanan özet.

## GUARD.ok — `.claude/hooks/**` ve `.claude/settings.json` için JSON, zaman pencereli onay (TEK KULLANIMLIK DEĞİL)

`.claude/hooks/**` (kendi güvenlik zinciri dahil) ve `.claude/settings.json` G2'nin mimari
onayı kapsamına GİRMEZ — meşru bakım (hook düzeltmesi, kredi kapısı güncellemesi vb.) G2 onayı
olmadan da yapılabilir, ama bu dosyalara `docs/` gibi tamamen serbest davranmak da yanlıştır.
Bu yüzden ayrı, AYNI DESENDE (DANGER.ok/PUSH.ok gibi) ama TÜKETİM MODELİ FARKLI bir onay dosyası
kullanılır: `docs/approvals/GUARD.ok`. **B-3 KAPANIŞI:** GUARD.ok tek kullanımlık DEĞİLDİR —
zaman penceresi boyunca kapsamdaki her dosyaya istenildiği kadar yazılabilir (aşağıya bkz).
DANGER.ok/PUSH.ok'un kendisi hâlâ gerçekten tek kullanımlıktır, bu yalnızca GUARD.ok için geçerli
bir değişikliktir.

**GUARD.ok artık serbest markdown DEĞİL, bir JSON belgesidir** (üç metin-ayrıştırma turunun
ardından alınan tasarım kararı — bkz. `docs/qa/g5-guard-json-contract.md`). Tam örnek:

```json
{
  "scope": [".claude/hooks/gate-check.cjs", ".claude/hooks/_selftest.cjs"],
  "reason": "insan için serbest metin — HİÇBİR ZAMAN taranmaz",
  "approved_by": "Kullanıcı (Veron) — AskUserQuestion",
  "created_at": "2026-09-10T19:05:00+03:00",
  "valid_minutes": 30
}
```

### Alan açıklamaları

| Alan | Zorunlu mu | Açıklama |
|---|---|---|
| `scope` | Evet | Dolu bir dize dizisi. Her eleman **tam olarak** `.claude/hooks/<ad>.cjs` ya da `.claude/settings.json` biçimine uymalı (harf duyarsız). Tek eleman bile kurala uymazsa **TÜM kapsam** geçersiz sayılır. |
| `created_at` | Evet | ISO 8601 tarih dizesi. Gelecekte olamaz (60 saniyelik saat-farkı toleransı hariç). |
| `valid_minutes` | Hayır (varsayılan 30) | Dakika cinsinden geçerlilik penceresi, en fazla 120. Süre dolunca dosya **otomatik silinir**. |
| `reason` | Hayır | Serbest metin, insan için. **Kapsam için hiçbir zaman taranmaz** — burada geçen bir dosya adı asla yetki kazanmaz. |
| `approved_by` | Hayır | Serbest metin, provenance notu. İçeriği hiçbir zaman doğrulanmaz/okunmaz. |

**İzin verilen kök alanlar SADECE bunlardır** (`scope`, `reason`, `approved_by`, `created_at`,
`valid_minutes`). Listede olmayan herhangi bir kök alan (yazım hatası dahil, `__proto__` dahil)
belgenin **tamamını** geçersiz kılar — "gizli alan" saldırılarına karşı kapalı liste.

### Kurallar

- **`scope` DIŞINDAKİ hiçbir alan kapsam için taranmaz.** `reason` içine bir dosya adı yazmak
  (örn. "bu turda X.cjs'e dokunulmayacak" notu) o adı kapsama SOKMAZ da ÇIKARMAZ da — kapsamın
  tek kaynağı `scope` alanıdır.
- **Yinelenen anahtar (herhangi bir seviyede) → belge TAMAMEN geçersiz.** `JSON.parse` yinelenen
  bir anahtarla karşılaşınca sessizce sonuncu değeri alır; bu, belgenin **görünen** hâli ile
  **yetkilendirilen** hâli arasında bir uyuşmazlık yaratabileceği için (örn. görünürde
  `"scope": ["gate-check.cjs"]` yazan bir belge, ikinci bir `"scope"` anahtarıyla farklı bir
  dosyayı yetkilendirebilir) JSON.parse'a ulaşılmadan ham metin üzerinde ayrıca kontrol edilir.
  **Tek bir `scope` alanı yazın; belgede aynı adı iki kez KULLANMAYIN.**
- **Kapsam dışı bir yol asla kabul edilmez** — elemanlar yol olarak çözülmez (resolve/realpath
  edilmez), sabit dizeler olarak karşılaştırılır; `../`, mutlak yol, UNC, ters bölü ayracı vb.
  otomatik reddedilir.
- **Token, kapsamdaki dosyalara zaman penceresi boyunca istenildiği kadar yazma izni verir**
  (tek bir yazmada tükenmez). Süre dolunca dosya bir sonraki `.claude/hooks/**` ya da
  `.claude/settings.json` yazma denemesinde (kapsamda olsun olmasın) otomatik silinir.
- Ayrıştırılamayan (bozuk JSON, şemaya uymayan) bir GUARD.ok **silinmez** — düzeltip tekrar
  deneyin. Süresi dolmuş bir GUARD.ok ise **silinir**.
