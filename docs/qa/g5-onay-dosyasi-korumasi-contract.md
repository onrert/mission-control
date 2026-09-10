---
type: qa
gate: G5
date: 2026-09-10
feature: g5-onay-dosyasi-korumasi (G5 tur3 KRİTİK bulgusunun düzeltmesi)
kaynak: docs/qa/G5-guvenlik-denetimi-2026-09-10-tur3.md
status: qa
---

# Sözleşme — onay dosyalarının kendi kendine üretilebilirliği düzeltmesi

## (a) Bu düzeltme neden var — tek cümle

**Barındırılan bir oturum, `docs/approvals/` altındaki hiçbir dosyaya (onay dosyaları dahil)
dokunmadan kullanıcının gerçekten "onaylıyorum" dediğini garanti edemiyordu — bu turun tek
işi, o dizine yapılan HER yazmanın kullanıcının kendi izin kartından geçmesini zorunlu kılmak.**

Ölçüt: aşağıdaki §(d)'de sayılan her sondanın, düzeltmeden ÖNCE sessizce geçtiği (exit 0,
hiçbir kullanıcı etkileşimi olmadan), düzeltmeden SONRA ya sert engellendiği (exit 2) ya da
harness'e "kullanıcıya sor" kararını (`permissionDecision: 'ask'`) ilettiği gösterilmeli.

## (b) BYPASS ENVANTERİ

Kapsam: `docs/approvals/` altına bir dosyanın yazılabileceği/değiştirilebileceği/silinebileceği
her yol. Her biri için karar: **kapatıldı** (bu turda çitlendi) / **kabul edilmiş sınır**
(kapatılamaz, dürüstçe açık) / **kapsam dışı** (bu turun brief'i src/'e dokunmayı yasaklıyor).

### 1. `Write` / `Edit` araçları — **KAPATILDI (Katman A + D)**
`gate-check.cjs`'in `free` listesi `docs/` yolunun TAMAMINI serbest bırakıyordu (QA §0.1).
Yeni bir kontrol, `free` kontrolünden ÖNCE çalışır: `docs/approvals/` altındaki HER dosya
(`.guard-state.json` hariç — o doğrudan sert engellenir) artık `permissionDecision: 'ask'`
ile harness'e devredilir. Ayrıca `.claude/settings.json`'ın `permissions.ask` listesine
`Edit(docs/approvals/**)`/`Write(docs/approvals/**)` eklenir — bu, mevcut geniş
`Write(docs/**)`/`Edit(docs/**)` `allow` kuralını `docs/approvals/**` için ÖNCELİKLE geçersiz
kılar (bkz. §(c) "İki katman, iki mekanizma").

### 2. `Bash` — kabuk yönlendirme/klasik yazma komutları — **KAPATILDI (Katman B)**
`>`, `>>`, `cp`, `copy`, `mv`, `move`, `ren(ame)`, `tee`, `sed -i`, PowerShell
`Set-Content`/`Out-File`/`Add-Content`/`New-Item`/`Remove-Item`, Windows `del`/`erase`/`rd`/
`rmdir`, PowerShell `ri` — bunlardan biri **ve** komut metninde `docs/approvals` (harf
duyarsız, `/` veya `\` ayracı) geçiyorsa `block-dangerous.cjs` artık exit 2 ile engelliyor.
Önceki `danger` deseni yalnızca `/s`/`/q` gibi bayraklarla "büyük" silmeleri yakalıyordu; bu
yeni kural bayraksız TEK dosya silmeyi/üzerine yazmayı da (ör. çıplak `del docs\approvals\
GUARD.ok`) kapsıyor çünkü bir onay dosyası için TEK dosya zaten yeterince ciddi.

### 3. `Bash` — satır içi betik (`node -e`, `node --eval`, `npx tsx -e`, `python -c`) — **KAPATILDI (Katman B), kasıtlı geniş**
QA'nın §0.2/§0.3'teki BİREBİR istismarı (`node -e "require('fs').writeFileSync('docs/approvals/
GUARD.ok', ...)"`) bu sınıfa girer. Satır içi betiğin GERÇEKTEN yazıp yazmadığı metinden
güvenilir biçimde anlaşılamaz (obfuscation: `fs['writeFileSync']`, değişkene atanmış yol, vb.) —
bu yüzden kural KASITLI OLARAK geniş: `node -e`/`--eval`/`npx tsx -e`/`python -c` İÇEREN VE
aynı komut metninde `docs/approvals` geçen HER komut, içinde gerçekten bir yazma birincil
fiili olsun olmasın, engellenir. Kabul edilen maliyet: docs/approvals'ı yalnızca OKUYAN bir
satır-içi betik de (nadir, meşru bir kullanım örneği yok) yanlış pozitif alır — kara liste
felsefesiyle tutarlı bir "derinlik katmanı" tercihi, mutlak değil.

### 4. `Bash` — bir dosyaya yazan betik ÇALIŞTIRMA (`node scripts/x.mjs`) — **KABUL EDİLMİŞ SINIR, kapatılamadı**
Komut satırı yalnızca `node scripts/x.mjs` ise ve `docs/approvals` DİZESİ komut metninde HİÇ
geçmiyorsa (yazma hedefi betiğin İÇİNDE, dosya sisteminde, gömülü) — hiçbir Bash-metni
regex'i bunu göremez. Bu, F-011'in öğrettiği dersin (`CLAUDE.md`: "kodun nasıl yazıldığını
analiz eden çit sözdizimi çeşitliliğine yenilir, davranışı ölç") BİREBİR bir tekrarı: gerçek
kapanış ancak çalışma zamanı gözlemi (ör. dosya sistemi çağrılarını izleyen bir sentinel,
F-011'in ağ sentinel'i emsali) ile mümkün, ve bu bu turun brief'inin **açıkça yasakladığı**
`src/`'e dokunmayı ya da yeni bir çalışma-zamanı-izleme altyapısı kurmayı gerektirir. Dürüstçe
AÇIK bırakılıyor, `docs/blockers.md`'ye eşikle yazılacak.

### 5. Panelin kendi HTTP API'si (`POST /api/gates/:project_id/:gate/approve`) — **KABUL EDİLMİŞ SINIR (önceden mevcut mimari karar), kapsam dışı**
Kesin cevap (kod okunarak doğrulandı, `src/features/gates/server/handlers.ts` +
`src/features/gates/shared/gate-id.ts` + `src/server/index.ts` + `src/server/write-gate.ts`):
**EVET, açık.** `isValidGateId` yalnızca `^(G[0-6](-\d{1,3})?|ASSETS)$` desenini kabul eder —
yani bu uç `GUARD.ok`/`DANGER.ok`/`PUSH.ok` ÜRETEMEZ, ama gerçek bir `G*.ok` (G5.ok DAHİL)
üretebilir. Koruma katmanları yalnızca `Host` (loopback) ve `Origin` (loopback ya da HİÇ
YOK — `isAllowedOrigin` `originHeader === undefined` için `true` döner) beyaz listesi ve
sabit, depoda açıkça yazılı bir `x-mc-write: '1'` başlığıdır — hiçbiri gerçek bir tarayıcı
tıklamasını sahte bir `node -e "fetch(...)"` çağrısından AYIRT ETMEZ. `Bash(node *)` zaten
`.claude/settings.json`'ın `allow` listesinde. Yani barındırılan bir oturum, `confirmed:true`
+ doğru `expectedBody` (deterministik, `buildApprovalBody`'den hesaplanabilir) ile HERHANGİ
bir `G*.ok`'u (G5 dahil) kullanıcıya hiç sormadan onaylatabilir.

**Bu YENİ bir açık değil, ADR-005'in kendi eki (satır 52) tarafından BİLEREK kabul edilmiş bir
tasarım kararının doğal sonucu:** *"`.ok` dosyası panelden yazıldığında 'kullanıcının onayı'
sayılır (G0.ok kararı)."* Panel = CEO'nun kendi arayüzü (ADR-014) olduğu için "panelden yazılan
her onay kullanıcı onayıdır" varsayımı, barındırılan oturumun panelin HTTP ucunu kendi
`Bash` erişimiyle taklit edebileceği senaryoyu öngörmemiş. Kapatmak `src/features/gates/**`'e
(CSRF token, gerçek-tarayıcı-kanıtı gibi mimari bir değişiklik) dokunmayı gerektirir — bu
turun dosya sahipliği bunu **açıkça yasaklıyor** ("src/ altında bu turun işi yok"). `ADR-016`'ya
ve `docs/blockers.md`'ye AÇIK, kapsam dışı bir risk olarak yazılacak; eşik: `src/features/
gates/**`'e dokunan bir sonraki güvenlik turu, ya da bu yolun gerçekten sömürüldüğüne dair bir
kanıt görülürse hemen.

### 6. MCP araçları / başka bir araç yolu — **kapsam dışı, düşük risk**
`.claude/settings.json`'daki tek MCP hook eşleştiricisi (`asset-guard.cjs`) Higgsfield görsel
üretim aracına özel; genel bir dosya-yazma MCP aracı bu depoda YOK (`claude mcp list` benzeri
bir tarama bu turda yapılmadı — mcp sunucu listesi `~/.claude` altında global, proje kapsamı
dışında). Bu depoda etkin bir MCP dosya-yazma aracı bilinmiyor; eşik: yeni bir MCP sunucusu
eklenirse.

## (c) Mekanizma — sıfat değil, ad

**İki bağımsız, birbirini örtmeyen katman:**

1. **Hook katmanı (Katman A/B, derinlik/erken-uyarı).** `PreToolUse` hook'ları (`gate-check.cjs`
   Edit|Write için, `block-dangerous.cjs` Bash için) `docs/approvals/` altına yönelik her
   girişimi metin/yol eşleştirmesiyle yakalar. Bu KARA LİSTE'dir (Bash tarafı) ve BEYAZ
   LİSTE'dir (`docs/approvals/` = tamamen "izin kartına düş", `.guard-state.json` hariç =
   sert engel). Hook'un kararı (`exit 2` = sert engel, `permissionDecision:'ask'` = harness'e
   "kullanıcıya sor" sinyali) **izin kurallarından (settings.json `allow`) BAĞIMSIZDIR** — bu
   davranış zaten ÖLÇÜLÜ (mevcut `gate-check.cjs`'in `.claude/hooks/**` engeli, `allow` listesi
   `Edit(src/**)`'e izin verse bile, `.claude/hooks/**` için hiç yoktur ve yine de exit 2 verir;
   `docs/`'un tamamı serbestken bile GUARD.ok mekanizması çalışıyor olması bunun kanıtı).
2. **Harness izin katmanı (Katman D, `.claude/settings.json` `permissions.ask`).**
   `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (satır 258, 879, 2564-2568, 2577-2583,
   8489-8503) belgelenmiş sözleşme: `PreToolUseHookSpecificOutput.permissionDecision` alanı
   `'allow'|'deny'|'ask'|'defer'` değerlerini alır; `ask` "kullanıcıya sor" anlamına gelir VE
   satır 2564'teki yorum ("Same contract as PreToolUse: allow proceeds, deny cancels, **ask asks
   the user to confirm (a headless session refuses instead)**") `ask`'ın **headless (etkileşimsiz/
   alt-agent) bir oturumda otomatik REDDE dönüştüğünü** açıkça belgeliyor. Bu, tam olarak
   istenen güvenlik özelliği: gerçek kullanıcı arayüzü (CEO'nun etkileşimli sohbeti) `ask`
   ile bir onay kartı görür, headless bir alt-agent (ör. bu developer turu gibi) otomatik
   reddedilir. Ayrıca `permissions.ask` (satır 258, "user-configured ask RULE (permissions.ask)
   forced this prompt") `.claude/settings.json`'da bağımsız bir dizi olarak desteklenir ve
   var olan `allow` kuralını (`Write(docs/**)`) daha spesifik bir desenle (`Write(docs/approvals/
   **)`) ÖNCELİKLİ olarak geçersiz kılar — bu SDK tip tanımından ÇIKARILAN bir davranıştır
   (⊢ ÇIKARIM, canlı harness testiyle doğrulanmadı, §(e)'de kabul edilen sınır olarak
   işaretlendi).
3. **`.guard-state.json` — sert engel, `ask` DEĞİL.** Bu dosya bir iç durum kaydıdır
   (GUARD.ok kapsamının hangi dosyalarının "görüldüğünü" izler); kullanıcının onaylaması
   gereken bir şey değildir, HİÇBİR araç onu elle değiştirmemeli. `gate-check.cjs` bu yolu
   `docs/approvals/` genel kuralından ÖNCE, ayrı ve KOŞULSUZ `block()` (exit 2) ile ele alır.

## (d) Ölçülebilir kabul kriterleri

Her biri `node .claude/hooks/_selftest.cjs` içinde otomatik bir vaka olarak eklenir:

1. `docs/approvals/G5.ok`'a (sentetik, gerçek dosyaya dokunulmaz) `Write`/`Edit` GUARD.ok'tan
   BAĞIMSIZ olarak `permissionDecision:'ask'` JSON'u ile exit 0 döner — sessiz `exit 0` (JSON'suz)
   DEĞİL.
2. `docs/approvals/DANGER.ok`, `PUSH.ok`, `README.md`, `archive/x.deny.md` için aynı — hepsi
   `ask`'a düşer (README dahil, brief'in açık istediği).
3. `docs/approvals/.guard-state.json`'a yazma her koşulda (GUARD.ok var/yok fark etmez)
   exit 2 sert engel — HİÇBİR ask/allow yolu yok.
4. `.claude/hooks/**`/`.claude/settings.json` (mevcut K1 davranışı) DEĞİŞMEDİ — regresyon
   vakaları aynı kalır.
5. `docs/qa/*`, `docs/progress.md`, `docs/features/*.md`, `docs/PROCESS.md` gibi `docs/approvals`
   DIŞINDAKİ `docs/**` yolları hâlâ tamamen serbest (ask YOK, sessiz exit 0) — yanlış pozitif
   regresyonu yok.
6. Bash: `echo x > docs/approvals/GUARD.ok`, `>>` varyantı, `cp`/`copy`/`mv`/`tee`/`sed -i`,
   PowerShell `Set-Content`/`Out-File`/`Add-Content`/`Remove-Item`, Windows `del`/`rd`/`rmdir`
   (bayraksız TEK dosya, ör. `del docs\approvals\GUARD.ok`), hepsi `\`/`/` ayracı ve harf
   varyantlarıyla — exit 2.
7. Bash satır-içi betik: `node -e`, `node --eval`, `npx tsx -e`, `python -c` + `docs/approvals`
   aynı komutta — exit 2. QA'nın BİREBİR PoC'si (`node -e "require('fs').writeFileSync(
   'docs/approvals/GUARD.ok', ...)"`) dahil.
8. Bash negatif vakalar (yanlış pozitif YOK): `cat docs/approvals/G5.ok`, `ls docs/approvals`,
   `git status --short`, `git add docs/approvals/G5.ok`, `git commit -m "add G5.ok"` — exit 0.
9. Mutasyon: Katman A'nın yeni kontrolü (docs/approvals ask bloğu) geçici olarak devre dışı
   bırakılınca ilgili self-test vakaları KIRMIZI; Katman B'nin yeni kontrolü devre dışı
   bırakılınca ilgili vakalar KIRMIZI. İkisi de elle geri alınır (`git checkout` YOK), md5
   başlangıç değeriyle karşılaştırılır.
10. `.claude/settings.json` JSON olarak geçerli kalır (`node -e "JSON.parse(...)"`), `permissions.
    ask` dizisi `Edit(docs/approvals/**)`/`Write(docs/approvals/**)` içerir.
11. `npx tsc --noEmit`, `npx eslint .`, `npm run test`, `npm run e2e` yeşil (bu turda `src/`
    değişmediği için bunlar zaten etkilenmemeli — yine de kanıt olarak koşulur).

## (e) Kabul edilmiş sınır

Yerel makinede tam `Bash` erişimi olan bir barındırılan oturuma karşı **mutlak** koruma yoktur
(F-011'in tekrarladığı gerçek: süreç-içi/metin-tabanlı bir koruma her zaman bir sonraki
sözdizimi biçimiyle ya da davranışı gizleyen bir dolaylılıkla yenilebilir). Bu turdan sonra
kalan, bilerek KAPATILMAYAN yollar:

- **§(b) madde 4** — `docs/approvals` metnini hiç içermeyen, harici bir betiğin İÇİNDE gömülü
  bir yazma. Kapatmak çalışma-zamanı gözlemi (dosya sistemi çağrı sentinel'i, F-011 emsali)
  gerektirir — bu turun `src/`'e dokunmama kısıtıyla çelişir.
- **§(b) madde 5** — panelin kendi HTTP onay ucu, `confirmed:true` gönderen HERHANGİ bir
  `node -e fetch(...)` çağrısını gerçek bir tarayıcı tıklamasından ayırt edemiyor. Bu,
  ADR-005 ekinin ÖNCEDEN kabul ettiği "panelden yazılan onay = kullanıcı onayı" ilkesinin
  öngörmediği bir sonuç; kapatmak `src/features/gates/**`'e dokunmayı gerektirir (kapsam dışı).
- **Katman D'nin (`permissions.ask`) `allow`'u gerçekten geçersiz kıldığı** SDK tip
  tanımından ÇIKARILDI, canlı bir interaktif harness oturumuyla (gerçek bir insanın "ask"
  kartını gördüğü) DOĞRULANMADI — bu turun kendisi headless bir alt-agent turu olduğu için
  böyle bir doğrulama bu ortamda yapılamaz. Asıl/birincil savunma bu yüzden Katman A/B'nin
  hook kararlarıdır (bunlar `execFileSync` ile doğrudan çağrılıp exit kodu/stdout'la
  ÖLÇÜLEBİLİR); Katman D ikinci, doğrulanmamış bir katman olarak eklenir.

Asıl savunma her zaman kullanıcının gördüğü izin kartıdır; bu turun hook'ları bir derinlik
katmanıdır — dürüst, yanıltıcı olmayan bir güvenlik iddiası budur.

## Kapanış notu (kod turu sonrası, qa-evaluator için)

Uygulandı: Katman A (`gate-check.cjs`), Katman B (`block-dangerous.cjs`), Katman D
(`.claude/settings.json` `permissions.ask`), ADR-016. `_selftest.cjs` 50 → **88** vaka, hepsi
yeşil. İki mutasyon (Katman A ve B'nin YENİ kontrolleri, sandbox kopyalarında, gerçek dosyalar
değişmedi — md5 doğrulandı) sırasıyla **8/9** ve **21/29** vakayı KIRMIZIYA düşürdü, elle geri
alındı (kopya zaten atıldı, gerçek dosyaya hiç dokunulmadı). `npx tsc --noEmit`=0, `npx eslint
.`=0, `npm run e2e`=55/55. `npm run test`: **1 failed | 1360 passed | 4 skipped (1365)** —
tek kırmızı `tests/features/chat/server/session.test.ts`'in `.claude/settings.json`'ın TAM
içeriğine sıkı bağlı bir assert'i (F-012 dosya sahipliği, bu turun kapsamı DIŞINDA, bkz.
`docs/blockers.md` "2026-09-10 — ... kapsam dışı bırakılan cross-feature test kırmızısı").
Kalan açık maddeler (§(e) + `docs/blockers.md`): panelin HTTP onay ucu (madde 1), betik-içi
gömülü yazma (madde 2), `permissions.ask`'ın canlı doğrulanmamışlığı (madde 3) — hiçbiri bu
turun `src/`'e dokunmama kısıtı içinde kapatılamazdı, hepsi eşikleriyle kayıtlı.
