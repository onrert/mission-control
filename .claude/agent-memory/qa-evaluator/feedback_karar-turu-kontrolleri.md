---
name: karar-turu-kontrolleri
description: Dar "karar turu" (birikmiş status:qa sözleşmelerine toplu GEÇTİ/KALDI) yaparken uygulanacak kontroller — mutasyon geçerliliği, kontrol deneyinin gerçekten koşup koşmadığı, paralel turun turu ortasında depoyu değiştirmesi, kırmızı sınıflarını ayırma
metadata:
  type: feedback
---

Bir denetim raporuna dayanarak karar verirken raporun **sonucunu** değil, iddiasının
**ölçülebilir çekirdeğini** yeniden üret; ve ürettiğin ölçümün kendisinin geçerli olduğunu
ayrıca kanıtla.

**Why:** G5'te beş sözleşme `status: qa`'da kalmıştı; beş tur denetim yapılmış ama karar
verilmemişti. Dar tur yaparken raporu doğrulamak için attığım üç ölçümün **ikisi ilk
denemede sessizce geçersizdi** — biri çöken bir mutasyon, biri hiç koşmayan bir kontrol
deneyi. İkisi de "sonuç" üretmişti; ikisi de yanlış sonuçtu.

**How to apply:**

- **Mutasyon çökerse hiçbir şey ölçmez.** `node -e "...replace(...)"` ile kabuktan mutasyon
  uygulama: kaçış katmanları (bash → node -e → regex) sessizce bozuk kod üretir. Belirti:
  mutasyon sonrası hook/betik **exit 1** veriyor ve testlerin ÇOĞU birden kırmızı
  (27/98 gibi) — davranışsal bir mutasyon dar ve seçici kırmızı verir (3/98). **Kural:**
  mutasyonu bir **dosyaya yazılmış betikle** uygula, `node --check` ile sözdizimini doğrula,
  ve kırmızı sayısı beklenenden çok büyükse önce mutasyonun kendisinden şüphelen.
  Doğru yapıldığında bağımsız mutasyonum önceki turun sonucunu **birebir** üretti (95/98,
  aynı üç vaka) — bu eşleşme, çitin gerçekten o mekanizmayı ölçtüğünün en güçlü kanıtı.
- **Kontrol deneyinin GERÇEKTEN koştuğunu doğrula.** `node scripts/x.mjs` ile
  `npm run <script>` aynı şey değildir: npm `node_modules/.bin`'i PATH'e ekler, çıplak
  `node` eklemez. İki "yarış üretemedim" denemem aslında hiç koşmamıştı (`'vitest' is not
  recognized`) — yani "yeniden üretilemedi" sonucum sahteydi. **Kural:** negatif bir sonuç
  ("reprodüksiyon başarısız") bildirmeden önce, deneyin **pozitif kontrolünü** göster
  (deney gerçekten çalıştı mı?). Bu, "her çitin kendi pozitif kontrolü olmalı" kuralının
  QA'nın **kendi deneylerine** uygulanmış hâli.
- **Kırmızı sınıflarını ayır, sıklığını say.** `npm run test` beş koşuda ikisinde kırmızı
  verdi ama **iki farklı sınıftan**: biri kayıtlı vitest fork çökmesi, biri yeni bir
  `dist/` yarışı. "Bir kez daha koştur" kuralı artık iki sınıfı birden örtüyor — bunu
  raporda ayır, yoksa gerçek bir regresyon "bilinen gürültü" diye geçer. Koşu sayısını
  ikiden fazlaya çıkarmak (5) tek başına yeni bilgi üretti.
- **Nedenselliği zorlayamıyorsan öyle yaz.** `dist/` yarışının **oluşunu** gördüm (1/5) ama
  **zorlayarak** üretemedim; mekanizmayı (`emptyOutDir: true` + iç içe suite) kodla
  gerekçelendirip "oluş ✓ DOĞRULANDI, mekanizma ? ÇIKARIM" diye etiketledim. Aynı kök nedenin
  **ikinci, kanıtlanabilir** yüzünü aramak işe yaradı: sabit port 7333'ü dışarıdan tutup
  `check-ports.test.ts`'i koşturunca çakışma **deterministik** olarak çıktı. **Kural:**
  zorlanamayan bir yarış için, aynı kök nedenin zorlanabilir bir kardeşini bul.
- **Bir testin kendi suite'ini alt süreç olarak koşturması yalnızca fork bomb riski değildir.**
  Asıl gözden kaçan: iç içe koşum, suite'teki **izole olmayan paylaşılan kaynakları**
  (sabit portlar, `dist/`, tek `MC_DATA_DIR`) ikinci kez ve **eşzamanlı** kullanır. Kendini
  dışlamak fork bomb'u çözer, paylaşılan durumu çözmez. Bu tür bir teste bakarken sor:
  "iç içe koşum hangi dosyaları ikinci kez çalıştırıyor ve onların hangisi global bir
  kaynağa dokunuyor?"
- **Paralel tur turu ortasında depoyu değiştirebilir.** Bu turda kapanış anında gerçek bir
  `GUARD.ok` belirdi (başka bir CEO turunun kullanıcı onayı) ve `gate-check.cjs` değişti.
  **Kural:** kararın dayandığı her artefaktın md5/sha'sını rapora yaz ve kararı **o duruma**
  bağla; tur sonunda `git status --porcelain` ile neyin değiştiğini tekrar ölç. Ayrıca:
  tur başında "güvenli" diye ölçtüğün bir ön koşul (ör. "bekleyen onay yok, self-test
  koşturulabilir") tur sonunda **artık geçerli olmayabilir** — o betiği bir daha koşturma.
- **Onay metnini insanın elle dolanmak zorunda kalması, kusurun kanıtıdır.** Beliren gerçek
  `GUARD.ok`, ayrıştırıcının düzyazıyı da taradığını bildiği için "bu metinde Kapsam dışında
  ters tırnak kullanmadım" diye bir feragat cümlesi taşıyordu. Bir mekanizmanın güvenliği
  kullanıcının kusuru hatırlamasına bağlıysa o bir çit değil, temenni — ve bulgunun
  bloklayıcılığını **güçlendirir**, hafifletmez.

İlgili: [[kod-turu-kontrolleri]], [[duzeltme-turu-kontrolleri]], [[statik-cit-denetimi]].
