---
name: faz2-durum
description: Mission Control'un kapi durumu — 14 feature done, G0-G5 onayli, sirada yalnizca G6 (yayin) var
metadata:
  type: project
---

**2026-09-11 itibariyla:** **14 feature `done`** (Faz 1: F-001…F-007, Faz 2: F-008…F-014) ve
**G0 · G1 · G2 · G3 · G4-1 · G4-2 · G5** onayli. Sirada **yalnizca G6 (yayin)** var, henuz acilmadi.

**Faz 2'nin sirasi neden degisti (tarihsel):** orijinal sira F-008'le basliyordu; kullanici Faz 1'i
deneyip *"karisabilecegim bir yer yok"* deyince once konusma yuzeyi (F-012), sonra onu her gun
acabilmek (F-014) yapildi. Bkz. [[panel-ceo-sohbet-vizyonu]].

**G5 bir gunde alti denetim turu ve sekiz sozlesme uretti.** En derin bulgu: butun kapilar
`docs/approvals/*.ok` dosyalarina dayaniyordu ama o dosyalar korumasizdi — agent kendi anahtarini
uretebiliyordu. Kapsam sizintisi (Y1) dort turda kapandi ve sonunda markdown ayristirmayi tamamen
birakmak gerekti (`GUARD.ok` artik JSON). Ayrintili ozet: `docs/approvals/G5.ok`.

**How to apply:** Kapi durumunu buradan varsay ama **dogrula** — `docs/approvals/` icerigi ve
`docs/features/` frontmatter'i kaynak gercegidir, bu not eskiyebilir.

**G6 acilmadan once kapatilmasi gereken tek madde: B-4** — `npm run test` yedi kosuda uc kirmizi
veriyor (worker fork cokmesi, assert degil). "Testler yesil" iddiasi kapinin dayanagi ve su an o
iddia kosularin %57'sinde gecerli. `docs/blockers.md`'de esigiyle kayitli; yanindaki bes borc
(B-2, B-3, B-5, B-6) bloklamiyor.

**Iki CEO oturumu riski (hala gecerli):** masaustu uygulamasindaki sohbet de bir CEO oturumu —
ikisine ayni anda is verilirse ayni depoya commit atip birbirlerini bozarlar. Devir
`docs/HANDOFF.md` uzerinden yapilir.
