---
name: once-plan-sonra-uygula
description: Birden fazla acik is varken once bagimlilik sirali bir plan iste, sonra beklemeden uygulamaya basla
metadata:
  type: feedback
---

Ortada birden fazla acik is varsa, Veron once **hangi sirayla yapilacagini** gormek istiyor —
ama plani onaylamak icin durmak istemiyor: *"hangi siralamayla yapilmasi gerekiyor? bir plan yap
ve plani uygulamaya basla."* Yani plan bir **onay kapisi degil**, bir seffaflik araci.

**Why:** G5 kapanisinda dort acik is vardi (QA kararlari, kayit hijyeni, duzeltme turu, push) ve
aralarinda gercek bagimliliklar vardi — ornegin bekleyen bir onay dosyasi varken self-test
calismayi reddediyor, yani push'u QA turundan once yapmak turu kilitliyordu. Sirayi yazili
gorunce bu tur tuzaklar ortaya cikiyor.

**How to apply:** Uc-dort acik is birikince kisa bir tablo ver: **adim · neden bu sirada**.
Sirayi gerekcelendir (bagimlilik, maliyet, geri alinabilirlik) — sadece listeleme. Sonra
**sormadan** 1. adimi baslat ve her adim bitince tabloyu durum isaretleriyle tekrar goster.
Yalnizca gercek karar kapilarinda dur (kapi onayi, push, geri alinamaz islem) — bkz.
[[kesintisiz-ilerleme]] ve [[kisa-sade-cevap]].
