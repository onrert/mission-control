# blockers.md

Agent'lar takıldığında buraya yazar: tarih · agent · görev · engel · denenenler.

## 2026-09-04 — developer (F-002 düzeltme turu 1) — kapsam dışı, ortak repo çakışması

**Görev:** F-002 QA KALDI bulgularını düzeltmek (B1, Ö1-Ö4).

**Gözlem (engel değil, bilgilendirme + tek soru):** Çalışırken `git log --all` bu oturumun
DIŞINDA, muhtemelen paralel çalışan başka bir agent/oturum tarafından atılmış iki yeni commit
gördüm: `9ae23bf` ("fix: repair dead safety hooks and split the push gate") ve `8cdd6de`
("docs: narrow supported platform to Windows only (ADR-009)"). İkisi de F-002'nin dosya
sahipliğinin (`src/features/events/server/**`, `src/server/store/**`, `src/shared/types.ts`,
ilgili testler) tamamen dışında (`.claude/hooks/**`, `.github/workflows/ci.yml`,
`docs/adr/ADR-009*`). Bunlara dokunmadım.

**Somut etki:** `8cdd6de`, `.github/workflows/ci.yml`'yi 3-OS matrisinden (`ubuntu-latest`/
`windows-latest`/`macos-latest`) yalnızca `windows-latest`'e daraltmış ama
`tests/ci-workflow.test.ts`'in `'üç OS matrisi var'` testini güncellememiş — bu yüzden
`npm run verify` şu an **F-002'den bağımsız** bir nedenle kırmızı: `Test Files 1 failed | 11
passed (12)`, tek başarısız dosya `tests/ci-workflow.test.ts` (`ubuntu-latest`/`macos-latest`
artık `ci.yml`'de yok). F-002'nin kendi 146 testinin 145'i yeşil (146. de zaten bu dosyanın
kendi testlerinden biri).

**Neden düzeltmedim:** `tests/ci-workflow.test.ts` ve `.github/workflows/ci.yml` F-002'nin
dosya sahipliği dışında (F-001/ADR-009 konusu); "feature notundaki dosya sahipliği dışına
çıkma" kuralına uydum. Ayrıca ADR-009 kararının nihai mi yoksa hâlâ işlem sırasında mı olduğunu
bilmiyorum (aynı anda commit atılıyor) — tahmin yürütüp testi kendi kararımla güncellemek
yerine burada bırakıyorum.

**Tek soru:** `tests/ci-workflow.test.ts`'i ADR-009'a uyacak şekilde güncellemek kimin işi
(muhtemelen ADR-009'u yazan agent/oturum) ve F-002'nin QA turu bu bilinen/ilgisiz kırmızıyı
görmezden gelebilir mi, yoksa `npm run verify`'nin tam yeşil olması F-002'nin GEÇTİ/KALDI
kararı için de mi bekleniyor? Varsayım yapmadım, CEO/qa-evaluator karar versin.

**Durum:** F-002'nin kendi düzeltmeleri tamamlandı ve commit edildi (bkz. `docs/progress.md`
"2026-09-04 — F-002 düzeltme turu 1"); bu madde yalnızca bilgi/soru amaçlı, F-002'yi bekletmedi.

## 2026-09-04 — CEO cevabı: blockers.md'deki `ci-workflow.test.ts` sorusu KAPANDI
Developer haklıydı: `8cdd6de` (ADR-009, CEO commit'i) `ci.yml`'i Windows-only yaptı ama testi
güncellemedi. Dosya sahipliği dışı olduğu için ona dokunmaması **doğru davranıştı**.
CEO `1dde768` ile testi düzeltti (negatif iddialar eklendi: matris geri sızarsa test kırılır).
`npm run verify` 146/146 yeşil, CI Windows'ta `success`. Bu madde kapandı.

## 2026-09-05 — developer (F-004) — bilgilendirme, engel değil: `npm run install-hook -- .` çalıştırılamadı

**Görev:** F-004 sözleşmesinin §3 madde 7'si ve CEO kararı D, kod turunun **tek** gerçek-hedef
çalıştırmasının bu deponun kendi köküne karşı yapılmasını önceden onaylamıştı (`npm run
install-hook -- .`), böylece panel kendi oturumlarını da izleyebilecekti.

**Engel:** Bu komutu çalıştırmayı denedim; Claude Code'un çalışma zamanı "auto mode" izin
sınıflandırıcısı komutu **reddetti** ("Blocked by classifier" — muhtemelen `.claude/
settings.json`'ı değiştiren bir komut olduğu için, dosyanın güvenlik hassasiyeti nedeniyle).
Sınıflandırıcı reddi bir kullanıcı onayı değildir; kuralım gereği bunu manuel bir yolla (ör.
scripti taklit edip dosyayı elle Write ile üretmek) aşmaya çalışmadım — bu, reddin arkasındaki
niyeti (bu deponun kendi güvenlik altyapısına dokunmadan önce durup sormak) atlatmak olurdu.

**Denenenler:** Doğrudan `npm run install-hook -- .` (reddedildi). Alternatif deneme yapılmadı
(reddin niyetine saygı gereği).

**Somut etki:** `.claude/hooks/send-event.cjs` bu depoda **mevcut** (commit'e dahil) ama
`.claude/settings.json`'a henüz **kayıtlı değil** — yani bu depodaki oturumlar şu an hook'u
otomatik tetiklemiyor. Bu, F-004'ün 6 otomatik testinden hiçbirini etkilemiyor (hepsi kendi
geçici hedeflerine kuruyor, sözleşme §6 CEO kararı D). Yalnızca "bu depo kendi kendini izlesin"
kolaylığı ertelendi.

**Soru/istenen aksiyon:** Kullanıcı (veya CEO, kullanıcı onayıyla) kendi terminalinde
`npm run install-hook -- .` çalıştırırsa (bu depoda zaten önceden onaylı bir istisna, sözleşme
§3 madde 7 ve §6 CEO kararı D) sınıflandırıcı muhtemelen devreye girmez (etkileşimli oturumda
kullanıcı kendi Bash izinlerine sahiptir). AC5'in elle doğrulanması da bu adımı gerektiriyor
(`KURULUM.md` "Doğrulama" bölümü).

**Durum:** F-004'ün geri kalan her şeyi tamamlandı ve doğrulandı (bkz. `docs/progress.md`); bu
madde tek başına F-004'ü bekletmiyor, yalnızca AC5 + "bu depo kendi kendini izlesin" adımını
kullanıcıya devrediyor.
