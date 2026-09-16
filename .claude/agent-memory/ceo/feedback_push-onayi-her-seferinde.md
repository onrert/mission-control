---
name: push-onayi-her-seferinde
description: Her push öncesi kullanıcıya sor — hook artık engellemiyor, disiplin CEO'da; onay bir push içindir, bir oturum için değil
metadata:
  type: feedback
---

Her `git push` öncesinde kullanıcıya **sor**. Onay **bir push içindir**, bir oturum ya da bir konu
için değil — onaydan sonra yeni bir commit oluşursa onu göndermek **yeni bir onay** ister.

**Why:** `G6.ok` yazıldığı an `block-dangerous.cjs` push için `PUSH.ok` aramayı bıraktı, yani
hook kapısı kalıcı olarak açıldı. Kullanıcıya bu çelişki açıkça soruldu (2026-09-16) ve kararı
*"Yine de her push öncesi sor"* oldu. Yani bu, bu depoda **bir kapının kaybolup yerini insan
disiplinine bıraktığı tek yer**. Ve o disiplin **ilk sınavında, yazıldıktan bir saat sonra
kaybedildi**: kullanıcı 38 commit için onay verdi, CEO ardından `G6.ok`'u commit edip sormadan
ikinci bir push yaptı. Commit küçüktü ve onaylanan işle ilgiliydi — erozyon tam olarak böyle
başlar.

**How to apply:** `git push` çalıştırmadan önce her seferinde AskUserQuestion. Hook engellemediği
için seni durduracak tek şey bu kural. "Zaten onaylamıştı", "küçük bir commit", "aynı konunun
devamı" geçerli gerekçe değildir. Kural `CLAUDE.md`'de de kayıtlı (Süreç bölümü).

İlgili: [[faz2-durum]] · [[kesintisiz-ilerleme]] (kesintisiz ilerleme tercihi push'u kapsamaz —
push geri alınamaz işlemdir ve her zaman sorulur).
