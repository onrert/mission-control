---
name: bekleme-turlarinda-sessizlik
description: Veron arka plan agent'i beklerken ara durum raporu istemiyor — yalnizca is bitince haber ver; bekleme turlarinda kisa kal
metadata:
  type: feedback
---

Arka planda bir alt agent calisirken **her turda durum raporu yazma.** Veron 2026-09-04'te
(F-002 duzeltme turu beklenirken, ust uste iki bekleme mesajindan sonra) acikca
**"bitince haber ver"** dedi.

**Why:** Bekleme turlarinda yazdigim raporlar yeni bilgi tasimiyordu — ayni durumu
("developer ucusta, ona dokunmuyorum, push bekliyor") farkli kelimelerle tekrarliyordum.
Bunun bir kismi `stop-check` hook'unun her turda yanlis pozitif uretmesinden dogdu: QA KALDI
oldugu icin hook beni durduruyor, ben de aciklama yapma ihtiyaci hissediyorum. Hook'un
gurultusu kullaniciya rapor olarak yansitilmamali.

**How to apply:**
- Alt agent uctugu surece: tek satirlik onay yeter ("tamam, bitince yazarim"). Plan tekrari,
  sira listesi, gerekce yok — bunlar zaten onceki mesajda verildi.
- `stop-check` bekleme turunda tetiklendiginde bunu **bilinen gurultu** say; kullaniciya
  hook'un ne dedigini anlatma, sadece sessizce devam et.
- Bekleme sirasinda yapilacak faydali is varsa (CLAUDE.md dersi yazmak gibi) yap ama
  **anlatma** — sonuc raporunda tek satir olarak gecir.
- Rapor esigi: agent bitti · karar gerekiyor · beklenmedik bir sey bulundu. Bunlarin disinda
  sus.

Ilgili: [[veron-karar-tarzi]]
