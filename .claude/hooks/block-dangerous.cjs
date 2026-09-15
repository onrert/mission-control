// PreToolUse (Bash): üç ayrı kapı + bir Katman B çifti.
//  1) Gerçek yayın komutları (deploy/publish/release)  -> docs/approvals/G6.ok (kalıcı).
//  2) git push                                         -> G6.ok VEYA docs/approvals/PUSH.ok (TEK KULLANIMLIK).
//  3) Yıkıcı komutlar ve git force                     -> docs/approvals/DANGER.ok (tek kullanımlık).
//  4) Katman B: kabuktan docs/approvals/** VE .claude/hooks/**+.claude/settings.json altına
//     yazma/silme (Y4 kapanışı — bkz aşağıdaki "SEGMENTASYON" bölümü ve docs/qa/
//     hook-borclari-contract.md). Katman A (gate-check.cjs, yalnızca Edit|Write araçlarına
//     bağlı) hiçbir zaman görmediği bir kabuk kopyalama/taşıma komutunu burada yakalar.
// Kullanıcı kararı (2026-09-04): push kapısı kalıcı olarak açılmaz; her push öncesi
// kullanıcıya sorulur ve PUSH.ok yazılır, hook onu kullanınca siler.
//
// SEGMENTASYON (B-6/Y2 kapanışı, docs/qa/hook-borclari-contract.md) — KÖK NEDEN: aşağıdaki
// `danger`/`gitForce`/`approvalsWriteVerb` gibi desenler `[^\n]*` (satır sonuna kadar HER ŞEY)
// kullanıyor ve iki-sinyalli `touchesApprovals && writeVerb` deseni tüm komut METNİNİ tek blob
// sayıyordu — yani SINIR yalnızca fiziksel satır sonuydu, kabuk ayracı (`&&`, `;`, `|`) SINIR
// SAYILMIYORDU. Sonuç: "ilgisiz alt komutların PARÇALARI birleşip masum komutları engelliyor"
// (docs/blockers.md B-6/Y2) — bir kopyalama + zincirin sonundaki ilgisiz bir okuma, salt-okunur
// bir sha256sum + zincirdeki ilgisiz bir yazma, bir commit + ayrı bir segmentte geçen bir yol/fiil
// adı gibi kombinasyonlar YANLIŞ POZİTİF üretiyordu.
//
// ÇÖZÜM: komut, kabuk ayraçlarında (`&&`, `||`, `;`, `|`, satır sonu) SEGMENTLERE bölünür ve HER
// SEGMENT aşağıdaki AYNI kurallarla AYRI AYRI değerlendirilir (herhangi bir segment eşleşirse
// komutun TAMAMI engellenir — bu yalnızca YANLIŞ POZİTİFİ azaltır, hiçbir segmenti muaf tutmaz).
//
// GÜVENLİK ŞARTI (asla ihlal edilmez): segmentasyon yalnızca FARKLI segmentlerdeki İKİ AYRI
// sinyalin (ör. bir segmentteki yazma fiili + BAŞKA bir segmentteki korunan yol adı) birbirini
// YANLIŞLIKLA tetiklemesini engeller. AYNI segment içinde hem fiil hem hedef varsa (gerçek bir
// yazma/silme girişimi) segmentasyon bunu ASLA gizlemez — segment yine tam metniyle taranır.
//
// GERİ ÇEKİLME (belirsizlik → bugünkü, daha kısıtlayıcı blob davranışı): ayırıcıyı GÜVENLE
// bulamıyorsak (heredoc `<<...`, komut ikamesi `$(...)`/backtick, fiziksel satır sonuna kaçan
// `\` devamı, ya da sonlandırılmamış tırnak) segmentasyona HİÇ girilmez — komut TEK bir segment
// (tüm metin) olarak değerlendirilir, yani AYNEN bugünkü (segmentasyon-öncesi) davranış. Bu, bir
// heredoc gövdesinde ya da $() içinde geçen "docs/approvals"/fiil adı gibi metinlerin hâlâ
// (kasıtlı olarak) aşırı-engellemeye yol açabileceği anlamına gelir — kabul edilmiş sınır,
// docs/qa/hook-borclari-contract.md'de belgelenmiştir. Tek/çift TIRNAK İÇİNDEKİ bir ayıraç ("a &&
// b" gibi bir metin) ayrı bir durumdur: bu, tam bir kabuk grameri gerektirmeyen, sınırlı ve
// güvenle izlenebilir bir durumdur (yalnızca "şu an bir tırnağın içinde miyim" sorusuna cevap
// verir) — bu yüzden RETREAT değil, doğru segmentasyonun bir PARÇASIDIR: tırnak içindeki metin
// asla bir ayıraç olarak sayılmaz, ama YİNE DE kendi segmentinin parçası olarak taranır (yani
// tırnak içine gizlenmiş bir hedef/fiil hâlâ yakalanır — bkz "quoted-write" testleri).
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

// splitCommandSegments(cmd) -> string[] | null
//   null  : ayrıştırma güvenli değil (heredoc/komut ikamesi/satır devamı/sonlandırılmamış tırnak)
//           — çağıran bunu [cmd] (tek segment = bugünkü blob davranışı) olarak ele almalı.
//   string[]: kabuk ayraçlarında (&&, ||, tek |, ;, satır sonu) TIRNAK-FARKINDA bölünmüş parçalar.
// Bu bir kabuk ayrıştırıcısı DEĞİLDİR: pipe/redirect/glob/değişken genişletme SEMANTİĞİNİ anlamaya
// çalışmaz — yalnızca "şu an tek/çift tırnak içinde miyim" durumunu izleyerek ayıraçları GÜVENLE
// bulur. Daha karmaşık her şey (aşağıdaki retreat listesi) bilinçli olarak ele alınmaz.
// M1 KAPANIŞI (docs/qa/hook-borclari-contract.md B1 — 2026-09-14 regresyonu). KÖK SORUN: `cd`
// (ve eşdeğerleri) ÇALIŞMA DİZİNİNİ DEĞİŞTİRİR; ondan SONRAKİ segmentlerdeki GÖRELİ yollar artık
// BAŞKA bir dizine bakar. "Her segment kendi başına, komşularından bağımsız değerlendirilir"
// varsayımı `cd docs/approvals && rm G5.ok` gibi bir zincirde GEÇERSİZDİR: `rm G5.ok` segmenti
// tek başına "G5.ok" bareli, korunan hiçbir yolu ANMAZ — segment-yerel akıl yürütme bunu güvenli
// sanar, ama önceki `cd` onu docs/approvals'ın İÇİNE taşımıştır. Segmentasyon bunu 12/12 gerçek
// saldırıda (R1-R12) kaçırdı (ölçüm: docs/qa/hook-borclari-contract.md §1.2).
// ÇÖZÜM: çalışma dizinini DEĞİŞTİREN bir komut GÖRÜLDÜĞÜNDE segmentasyona HİÇ GİRİLMEZ — diğer
// retreat'lerle (heredoc/$()/satır devamı) AYNI mekanizma: `null` dönülür, çağıran komutun
// TAMAMINI TEK blob olarak tarar (bugünkü, segmentasyon-öncesi kısıtlayıcı davranış). Bu, "hangi
// dizine geçildi" sorusunu ÇÖZMEYE çalışmaz (tam bir kabuk yorumlayıcısı gerektirir) — yalnızca
// "bu durumda segment-yerel akıl yürütemem" der ve daha kısıtlayıcı tarafa düşer.
// BİLEREK EKLENEN aile: `cd`, `pushd`, `popd`, `chdir` (cmd.exe eşdeğeri), `Set-Location`,
// `Push-Location`, `Pop-Location` (PowerShell TAM adları — kısaltmasız, ayırt edici, yanlış
// pozitif riski düşük).
// BİLEREK EKLENMEYEN: PowerShell `sl` (Set-Location'ın ÇOK KISA takma adı). Gerekçe: (1) R1-R12
// saldırı vektörlerinin HİÇBİRİ `sl` kullanmıyor — eklemek bu turun ölçülen kabul kriterine hiçbir
// katkı sağlamıyor; (2) iki harfli bir token, `\b` sınırına rağmen masum metinde (değişken adı,
// kısaltma, dosya adı parçası) beklenenden daha sık rastlanabilir ve blob'a çökmek gereksiz
// SÜRTÜNME (aşırı engelleme) yaratır; (3) aşağıdaki BARE-ARTIFACT korelasyonu (M1'den BAĞIMSIZ,
// `cd` İÇERMEYEN R9/R11/R12 ailesini zaten kapatan ikinci bir mekanizma) `sl` kullanan bir
// saldırıyı da YAKALAR — yani `sl`'i dışlamak bu turun ölçülen R1-R12/F1-F10 matrisinde bir
// boşluk AÇMIYOR, yalnızca gereksiz aşırı-engellemeyi önlüyor.
// NOT (stil tutarlılığı): diğer retreat kontrolleri gibi bu da TIRNAK-FARKINDA DEĞİL — "cd" bir
// tırnaklı metin İÇİNDE geçse bile (ör. `echo "please cd to src"`) retreat tetiklenir. Bu KASITLI:
// sonucu her zaman AŞIRI ENGELLEMEYE gider (blob taraması), ASLA atlatmaya değil — güvenlik kaybı
// yok, yalnızca ihtiyaç dışı ekstra tarama.
const WD_CHANGE = /\b(cd|pushd|popd|chdir|Set-Location|Push-Location|Pop-Location)\b/i;

function splitCommandSegments(cmd) {
  // Retreat 1: heredoc (`<<EOF`, `<<-EOF`, `<<~EOF`, `<<'EOF'`, `<<<` herestring dahil). Heredoc
  // gövdesi birden çok fiziksel satıra yayılır ve içeriği kabuk tarafından hiç yorumlanmaz —
  // ayırıcı arama burada anlamsızdır, blob'a çekiliriz.
  if (cmd.indexOf('<<') !== -1) return null;
  // Retreat 2: komut ikamesi ($(...) veya backtick). İç içe bir alt kabuk kendi ayraçlarını
  // taşıyabilir; dışarıdan güvenle ayrıştırılamaz.
  if (cmd.indexOf('$(') !== -1 || cmd.indexOf('`') !== -1) return null;
  // Retreat 3: fiziksel satır devamı (`\` + satır sonu) — tek mantıksal komut birden çok fiziksel
  // satıra yayılmış, "satır sonu" ayıracının burada ne anlama geldiği belirsiz.
  if (/\\\r?\n/.test(cmd)) return null;
  // Retreat 4 (M1 KAPANIŞI): çalışma dizinini değiştiren bir komut var — yukarıdaki uzun yorum.
  if (WD_CHANGE.test(cmd)) return null;

  const segments = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  const n = cmd.length;
  let i = 0;
  while (i < n) {
    const c = cmd[i];
    if (inSingle) {
      cur += c;
      if (c === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (c === '\\' && i + 1 < n) { cur += c + cmd[i + 1]; i += 2; continue; }
      cur += c;
      if (c === '"') inDouble = false;
      i++;
      continue;
    }
    // Tırnak dışında: kaçışlı karakter literal sayılır, ayıraç kontrolüne HİÇ girmez (`\&\&`
    // gibi kaçışlı bir ayıraç asla bölünmez).
    if (c === '\\' && i + 1 < n) { cur += c + cmd[i + 1]; i += 2; continue; }
    if (c === "'") { inSingle = true; cur += c; i++; continue; }
    if (c === '"') { inDouble = true; cur += c; i++; continue; }
    if (c === '&' && cmd[i + 1] === '&') { segments.push(cur); cur = ''; i += 2; continue; }
    if (c === '|' && cmd[i + 1] === '|') { segments.push(cur); cur = ''; i += 2; continue; }
    if (c === '|') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === ';') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === '\n') { segments.push(cur); cur = ''; i += 1; continue; }
    cur += c;
    i++;
  }
  segments.push(cur);
  // Retreat 5: sonlandırılmamış tırnak — dosyanın/komutun nerede bittiği güvenle bilinemez.
  if (inSingle || inDouble) return null;
  const trimmed = segments.map((s) => s.trim()).filter((s) => s.length > 0);
  return trimmed.length ? trimmed : [cmd];
}

readInput((j) => {
  const cmd = (j.tool_input && j.tool_input.command) || '';
  if (!cmd) process.exit(0);

  const segmented = splitCommandSegments(cmd);
  // Belirsizlik DAİMA bugünkü (kısıtlayıcı) davranışa çözülür: ayrıştırılamıyorsa TEK segment
  // (tüm metin) — yani segmentasyon-öncesi blob taraması, hiçbir güvenlik kaybı yok.
  const segments = segmented || [cmd];

  // Yayın: kod kullanıcıdan başkasına ulaşır veya para/servis tetiklenir.
  const release = /\b(vercel(\s+--prod)?\b|fly\s+deploy|railway\s+up|gh\s+release|npm\s+publish|eas\s+submit|eas\s+build\b.*--auto-submit)/i;
  // Push: uzak depoya yazar ama yayın değil (private depo + CI için gerekli).
  const pushCmd = /\bgit\s+push\b/i;
  // Genel yıkıcı komutlar — büyük/küçük harf duyarsız.
  // NOT (docs/qa/G5-guvenlik-denetimi-2026-09-10.md K2): bu bir KARA LİSTEdir — derinlik
  // katmanıdır, MUTLAK engel değildir. Bu depoda kara listeler dört kez yenildi
  // (docs/wiki/pages/desen/cit-tasarimi.md §1); kabuk komutları için beyaz liste pratik değil.
  // Asıl koruma kullanıcının gördüğü izin kartıdır (`canUseTool`, ADR-014) — bu hook yalnızca
  // erken/okunaklı bir uyarı ve tek-kullanımlık DANGER.ok ritüelini tetikler. `rd`/`rmdir`/`del`
  // bayrak sırasından bağımsız (lookahead) eşleşir; ADR-009 bu proje yalnızca Windows olduğu
  // için Windows'un kendi silme komutları da kapsanır.
  // GG2 (docs/qa/g5-guvenlik-duzeltme-tur3-contract.md madde 2): `ri -r...` PowerShell
  // kısaltma zinciri — -r, -re, -rec, -recu, -recur, -recurs, -recurse hepsi kapsanır
  // (iç içe opsiyonel gruplar, harf sırasını bozmadan kısmi yazımları yakalar). Zararsız
  // `ri` kullanımı (bayraksız veya farklı bir bayrakla, ör. `ri -Force`/`ri -Recreate`)
  // etkilenmez çünkü grup yalnızca tam "recurse" harf dizisini adım adım takip eder.
  // docs/qa/g5-tur4-yol-kanoniklestirme-contract.md §4 (kabul edilmiş sınır) — asıl düzeltme
  // gate-check.cjs'in kanonikleştirmesidir (junction'ın ARKASINA bakar); bu satır yalnızca
  // derinlik katmanını tutarlı hale getirir. `New-Item -ItemType Junction/SymbolicLink` zaten
  // yakalanıyordu (`New-Item` genel deseni), ama AYNI sonucu üreten `mklink` (bayraksız veya
  // `/J`/`/D`/`/H` ile) yakalanmıyordu — iki eşdeğer komuttan biri korumalı, diğeri değildi
  // (docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md 4-Ek2).
  // NOT (B-6 segmentasyonu, docs/qa/hook-borclari-contract.md): `[^\n]*` bu desenin İÇİNDE hâlâ
  // kullanılıyor ama artık zararsız — her `danger.test(...)` çağrısı TEK BİR segmente uygulanıyor,
  // ve segment tanımı gereği kendi içinde `&&`/`;`/`|` İÇERMEZ (bunlar segment sınırlarıdır).
  // Yani `[^\n]*` artık yalnızca AYNI segment içindeki bayrak/argüman mesafesini kapsar, BAŞKA bir
  // zincirlenmiş komuta asla sızmaz (eskiden `git log && npm run build --force` gibi bir zincirde
  // `gitForce` yanlışlıkla "git ... --force" eşleşmesi üretiyordu — artık segmentler ayrı).
  const danger = /(\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bdrop\s+(table|database)\b|Remove-Item[^\n]*-Recurse|\btruncate\s+table\b|\b(rd|rmdir)\b[^\n]*\/s\b|\b(del|erase)\b(?=[^\n]*\/[sq]\b)|\bri\b[^\n]*-r(e(c(u(r(s(e)?)?)?)?)?)?\b|\bmklink\b)/i;
  // git force — harf duyarlı OLMALI: "-f" force'tur ama "-F" commit mesajını dosyadan okur (zararsız).
  // Duyarsız eşleşme "git commit -F" gibi normal komutları yanlışlıkla engelliyordu.
  const gitForce = /\bgit\b[^\n]*\s(--force\b|--force-with-lease\b|-f\b)/;

  // docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman B (bypass envanteri madde 2/3) — kabuktan
  // korunan yollara yazma/silme. Bu da bir KARA LİSTEdir (aynı NOT geçerli — derinlik katmanı,
  // mutlak değil). İki alt-sınıf:
  //  b1) klasik yazma/silme fiili (yönlendirme, cp/mv/tee/sed -i, Windows/PowerShell eşdeğerleri,
  //      POSIX rm/unlink — bkz "RM KAPANIŞI" notu aşağıda)
  //      + komut metninde korunan yol geçmesi (AYNI SEGMENTTE — aşağıya bkz).
  //  b2) satır içi betik (node -e/--eval, npx tsx -e, python -c) + AYNI SEGMENTTE korunan yol
  //      geçmesi — betiğin GERÇEKTEN yazıp yazmadığı metinden güvenilir anlaşılamaz (obfuscation,
  //      ör. fs['writeFileSync']), bu yüzden KASITLI OLARAK geniş: içerik yazma fiili taşımasa
  //      bile engellenir. QA'nın §0.2/§0.3 birebir istismarı (`node -e "require('fs').
  //      writeFileSync('docs/approvals/GUARD.ok', ...)"`) bu sınıfa girer.
  //
  // Y4 KAPANIŞI (docs/blockers.md): eskiden bu katman YALNIZCA docs/approvals'ı koruyordu;
  // .claude/hooks/** ve .claude/settings.json'ın kabuktan (Edit|Write araçları DIŞINDA) yazılmasını
  // hiçbir şey engellemiyordu — gate-check.cjs (Katman A, GUARD.ok) yalnızca Edit|Write araçlarına
  // bağlı olduğu için bir `cp`/`mv` kabuk komutu o kapıyı hiç görmüyordu. Artık AYNI b1/b2
  // mekanizması iki AYRI hedef ailesi için ayrı ayrı çalıştırılıyor: docs/approvals/** VE
  // .claude/hooks/**+.claude/settings.json. Okuma (cat/ls/git add/git commit/git diff) hiçbir
  // zaman engellenmez — yalnızca (mention + yazma fiili) AYNI SEGMENTTE ya da doğrudan yönlendirme
  // hedefi eşleşirse engellenir.
  //
  // RM KAPANIŞI (docs/qa/hook-borclari-contract.md §8-ek, CEO'nun probe-segment.mjs E1/E2
  // sondası): `writeVerb` bayraksız `del`/`erase`/`rd`/`rmdir`/`ri` (Windows/PowerShell silme
  // fiilleri) içeriyordu ama bu ortamın VARSAYILAN kabuğunun (Git Bash, POSIX) birincil silme
  // fiili olan bayraksız `rm`'i HİÇ içermiyordu — tutarsız bir boşluk, atlatma değil eksiklikti.
  // Eklenen: `rm` ve `unlink` (ikisi de tek adımda, bayraksız TEK dosya siler; `rm -rf` zaten
  // `danger` deseninde ayrı ve bağımsız olarak yakalanıyor, bu ikisi ONU BOZMAZ, yalnızca
  // bayraksız tekil silmeyi de aynı muameleye sokar). `\brm\b` kelime-sınırlı olduğu için `git rm`
  // de OTOMATİK kapsanır (ekstra desen gerekmedi — `\brm\b` "git" ön ekinden bağımsız eşleşir).
  // BİLEREK EKLENMEYENLER (aynı boşluk ailesinde bulunup değerlendirildi):
  //  - `shred`: GNU coreutils'in nadir kullanılan bir aracı; bu depo ADR-009 ile yalnızca Windows
  //    hedefliyor ve Git for Windows'un minimal coreutils alt kümesinde standart olarak bulunmaz
  //    (aksine `rm`/`unlink`/`cp`/`mv` gibi temel POSIX araçları). Eklemek tutarlılığı değil
  //    listeyi büyütür; gerçekçi bir saldırı yüzeyi kapatmaz.
  //  - `truncate` (dosya sıfırlama, `truncate table` SQL bağlamından AYRI bir fiil): silme değil
  //    içerik boşaltma — farklı bir tehdit sınıfı (dosya kalır, içeriği gider). Bu turun kapsamı
  //    brief'te açıkça "bayraksız SİLME" olarak tanımlandı; truncate'i eklemek scope creep olurdu.
  //    Kayıt: gelecekte bir "içerik bozma" tehdidi ele alınırsa ayrı bir madde olarak açılmalı.
  //  - `find ... -delete`: bileşik bir deyim, tek kelimelik bir fiil DEĞİL. Bare `find` kelimesini
  //    writeVerb'e eklemek OKUMA amaçlı (arama/listeleme) sayısız zararsız komutu (`find . -name
  //    x`, `find docs/approvals -type f`) yanlış pozitif olarak engeller — kabul edilemez oranda
  //    aşırı engelleme. Hedefli bir `\bfind\b[^\n]*-delete\b` deseni teorik olarak mümkün ama bu
  //    turun brief'i yalnızca "eksik fiili ekle" diyordu; ayrı bir desen ailesi açmak yerine kayıt
  //    olarak burada bırakılıyor (kabul edilen, önceden var olan sınırın bir parçası).
  const approvalsRef = /docs[\\/]approvals\b/i;
  const hooksRef = /\.claude[\\/](hooks\b|settings\.json\b)/i;
  // Yönlendirme (`>`/`>>`) AYRI ve DAR bir desendir — hedefin GERÇEKTEN korunan yola baktığını
  // ister, aksi hâlde `cat docs/approvals/G5.ok 2>/dev/null` gibi tamamen zararsız, hedefi başka
  // yere (stderr'e) yönlendiren okuma komutları yanlış pozitif alırdı (ilk sürümde tam bu oldu,
  // elle bulundu ve düzeltildi).
  const approvalsRedirect = /(>>|>(?!=))\s*['"]?docs[\\/]approvals\b/i;
  const hooksRedirect = /(>>|>(?!=))\s*['"]?\.claude[\\/](hooks\b|settings\.json\b)/i;
  const writeVerb = /(\btee\b|\bcp\b|\bcopy\b|\bmv\b|\bmove\b|\bren(?:ame)?\b|\bsed\b[^\n]*-i\b|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b|\bNew-Item\b|\bRemove-Item\b|\b(del|erase|rm|unlink)\b|\brd\b|\brmdir\b|\bri\b)/i;
  const inlineEval = /(\bnode\b[^\n]*(-e\b|--eval\b)|\bnpx\s+tsx\b[^\n]*-e\b|\bpython\b[^\n]*-c\b)/i;

  // M2 KAPANIŞI v3 (docs/qa/hook-borclari-contract.md §12 — 2026-09-15, iki adımlı düzeltme
  // kararının 1. adımı). KÖK SORUN (v2, artık KALDIRILDI): v2 "komut konumu" kapalı listesini
  // "tırnak içinde mi" ikili sorusuyla değiştirdi — yani bir fiil eşleşmesi TIRNAKLANMIŞ bir dize
  // İÇİNDE geçiyorsa SAYILMAZ sayıldı. Bu, `grep -n "rm" dosya` gibi salt-okunur komutlardaki
  // yanlış pozitifi (B2, F2-F5/F9) doğru çözdü — AMA tırnaklı bir dizeyi GERÇEKTEN yorumlayan bir
  // alt kabuğa (`sh -c '...'`, `bash -c "..."`, `eval "..."`, `powershell -Command "..."`)
  // geçirildiğinde tırnak içi metin kabuk için DEĞİL, KODDUR — "veri" değildir. CEO'nun bağımsız
  // iç içe-kabuk sondası (12 vektör) bunu ölçtü: `prev` (değişiklikten önceki, 1fbb1eb) hepsini
  // ENGELLİYORDU, v2 **11/12'sini GEÇİRİYORDU** — `sh -c 'rm docs/approvals/G5.ok'`,
  // `bash -c "cp /tmp/evil .claude/hooks/gate-check.cjs"`, `eval "rm docs/approvals/G5.ok"`,
  // `powershell -Command "Remove-Item .claude/hooks/gate-check.cjs"` vb. Bu, "tırnakta mı?"
  // sorusunun YANLIŞ soru olduğunu kanıtladı: doğru soru "bu komut salt-okunur bir araç mı?"
  // idi — ki v2 hiç sormuyordu. Kullanıcı kararı (2026-09-15): önce bu regresyonu KAPAT (tırnak
  // muafiyetini TAMAMEN KALDIR, v0/`prev` davranışına dön — fiil eşleşmesi metnin HER YERİNDE
  // sayılır), yanlış pozitifleri BİR SONRAKİ turda OKUMA-KOMUTU BEYAZ LİSTESİYLE geri kazan
  // (segment başındaki komut bilinen salt-okunur bir araçsa o segmentin tırnaklı argümanları
  // muaf; değilse fiil her yerde sayılır — ADR-013 uyumlu allowlist, kısıtlayıcı varsayılan
  // sayesinde `sh`/`bash`/`eval` beyaz listede OLMAYACAĞI için iç içe kabuk YAPISAL olarak kapalı
  // kalır). Bu turun kapsamı SADECE kaldırma; beyaz liste henüz YOK — bkz. BİLİNÇLİ KABUL EDİLEN
  // GEÇİCİ AŞIRI ENGELLEME notu aşağıda.
  //
  // KABUL EDİLEN TAKAS (dürüstçe, aşırı engelleme yönünde — güvenlik kaybı DEĞİL, önceki v0/`prev`
  // davranışına dönüş): `grep -n "unlink" dosya`, `awk '/rm/{...}' dosya` gibi salt-okunur
  // komutlar TIRNAKLI argümanlarında fiil kelimesi taşıdığı için yeniden yanlış pozitif alır.
  // Ölçülen 6 vaka (docs/qa/hook-borclari-contract.md §12'ye kaydedildi) self-test'te expected=2
  // (ENGEL) ile işaretlendi ve her birinin açıklamasına "bir sonraki turda okuma-komutu beyaz
  // listesiyle geri kazanılacak" notu düşüldü — bu KABUL EDİLMİŞ, GEÇİCİ bir durumdur, kalıcı
  // tasarım değil.
  //
  // BİLİNEN SINIR (v2'den kalan, hâlâ AÇIK — bir sonraki turun kapsamı): tırnak muafiyeti
  // kaldırıldığı için N1-N12 artık ENGELLENİYOR (fiil tırnak içinde de sayıldığı için `sh -c
  // 'rm ...'` içindeki "rm" yakalanır) — ama bu, "alt kabuğu tanıyıp içeriğini yorumlama" değil,
  // "artık hiçbir tırnak muaf değil" sonucudur. Okuma-komutu beyaz listesi eklendiğinde bu
  // davranış YENİDEN gözden geçirilmeli (örn. `sh -c '...'`in kendisi salt-okunur bir araç
  // SAYILMAYACAĞI için N-ailesi o turda da kapalı kalmalı — brief'in "kısıtlayıcı varsayılan"
  // şartı bunu garanti ediyor, bkz. yukarıdaki not).

  // BARE-ARTIFACT KORELASYONU (docs/qa/hook-borclari-contract.md B1 — `cd` İÇERMEYEN vektör
  // ailesi + çıplak yönlendirme boşluğu). M1 yalnızca `cd`-ailesini kapsar; R9 (`ls docs/approvals
  // && node -e "...writeFileSync('G5.ok',...)"`), R11 (`echo docs/approvals ; rm G5.ok`), R12
  // (`cat docs/approvals/G5.ok | head -1 ; rm G5.ok`) HİÇ `cd` KULLANMIYOR — yazma hedefi zaten
  // BARE (yol ayracı yok, ör. `G5.ok`), yani hangi dizine yazdığı segment METNİNDEN BAĞIMSIZ
  // olarak zaten BELİRSİZ. Aynı belirsizlik çıplak yönlendirmede de var: `cd docs/approvals &&
  // echo x > G5.ok` M1 ile blob'a düşse bile `writeVerb`'de bir `>` girişi YOK, yalnızca
  // `approvalsRedirect`/`hooksRedirect` (ki onlar hedefte "docs/approvals" METNİNİ arıyor, bare
  // `G5.ok`'ta o metin YOK) — bu yüzden ayrı bir sinyal gerekiyor.
  // MEKANİZMA: bir segment (a) gerçek bir yazma EYLEMİ taşıyorsa (tırnak dışında yazma fiili,
  // satır-içi betik, YA DA herhangi bir `>`/`>>` yönlendirmesi) VE (b) o segment METNİNDE, hemen
  // ÖNCESİNDE bir yol ayracı (`/`veya `\`) OLMAYAN — yani BARE — bilinen bir korunan-eser adı
  // (`*.ok` ya da `gate-check.cjs`/`block-dangerous.cjs`/`_selftest.cjs`/`_common.cjs`/
  // `settings.json`) geçiyorsa, VE (c) komutun HERHANGİ BİR segmentinde (aynı ya da başka)
  // ilgili dizin açıkça ANILIYORSA (`docs/approvals` ya da `.claude/hooks`/`settings.json`) —
  // o zaman bu segment "belirsiz yazma" sayılır ve ilgili aile (approvals/hooks) engellenir.
  // AYRIM (neden bu, eski B-6 hatasını TEKRARLAMIYOR): eski hata "AYNI SEGMENTTE fiil+hedef" şartı
  // OLMADAN, herhangi bir mention + herhangi bir yazma fiilini HER YERDE eşleştiriyordu (kara
  // liste kadar geniş). Bu mekanizma dar: yalnızca hedefin kendisi SÖZDİZİMSEL OLARAK belirsiz
  // (bare + bilinen bir korunan ad kalıbına uyuyor) OLDUĞUNDA çapraz segment mention'a bakar —
  // açık bir hedefi olan yazmalar (ör. `cp x /tmp/other/thing.ok`, önünde `/` var) bu YOLDAN HİÇ
  // GEÇMEZ, yalnızca mevcut (aynı-segment) mekanizmayla değerlendirilir.
  // KABUL EDİLEN SINIR (dürüstçe, docs/qa/hook-borclari-contract.md'ye yazıldı): bu tarama bir
  // komutun ARGÜMAN YAPISINI (kaynak mı hedef mi) ayırt ETMEZ — `cp myfile.ok /baska/yer` gibi
  // meşru bir komut, EĞER komutun başka bir segmentinde tesadüfen "docs/approvals" geçiyorsa
  // yanlışlıkla engellenebilir. Bu AŞIRI ENGELLEME yönünde bir sınırdır (güvenlik kaybı değil) ve
  // bu turun ölçülen F1-F10 kümesinde böyle bir vektör YOK.
  const HOOK_FILENAME_RE = /^(gate-check\.cjs|block-dangerous\.cjs|_selftest\.cjs|_common\.cjs|settings\.json)$/i;
  const BARE_ARTIFACT_SCAN_RE = /([\w.-]+\.ok|gate-check\.cjs|block-dangerous\.cjs|_selftest\.cjs|_common\.cjs|settings\.json)/gi;
  // A5 KAPANIŞI (docs/qa/hook-borclari-contract.md — CEO'nun diferansiyel sondası, probe-extra.mjs
  // A5: `X=docs/approvals; rm $X/G5.ok`). KÖK SORUN: yukarıdaki "önünde `/` varsa açık yol, belirsiz
  // DEĞİL, atla" kuralı yalnızca hedefin BİR DİZİN ADIYLA açıkça nitelendiğini varsayıyordu — ama bir
  // kabuk DEĞİŞKENİ (`$X/G5.ok`) ya da göreli-dizin kısayolu (`./G5.ok`) de aynı şekilde `/` ile biter
  // ve GERÇEKTE hangi dizine baktığı segment METNİNDEN BAĞIMSIZ olarak BELİRSİZDİR (`X` başka bir
  // segmentte -- ya da hiç -- atanmış olabilir; tam bir kabuk yorumlayıcısı gerektirir). Blob taraması
  // (segmentasyon-öncesi davranış) bu vektörü YAKALIYORDU (tüm metin tek parça tarandığı için "rm" ve
  // "docs/approvals" aynı blobdaydı); segmentasyon bunu KAÇIRIYORDU (A5 = REGRESYON, blob ENGELLİYOR,
  // aday GEÇİRİYORDU) — bu turun merkezi şartını ("aday, blob'un engellediği hiçbir şeyi geçirmemeli")
  // ihlal ediyordu.
  // ÇÖZÜM: `/` ya da `\` öncesindeki hemen önceki TOKEN'a bak — eğer bu token bir kabuk DEĞİŞKENİ
  // (`$X`, `${X}`, tırnaklı `"$X"`/`'$X'`) ya da göreli-dizin kısayolu (`.`/`..`) İSE, önündeki `/`
  // bir "açık yol" SAYILMAZ (çünkü gerçek hedef hâlâ çözülmemiştir) — bu durumda BARE kabul edilip
  // normal bare-artifact akışına (cross-segment mention + write-action şartı DEĞİŞMEDİ) girer.
  // Literal bir dizin adı (`/tmp/`, `build/`, `docs/approvals/` bizzat) ÖNCEKİ gibi açık yol sayılır
  // ve atlanır — BARE-NEG-1 (`cp /tmp/backup.ok /tmp/restore.ok`) bu yüzden hâlâ GEÇER, çünkü "tmp"
  // ne bir değişken ne bir nokta-kısayolu.
  // KABUL EDİLEN SINIR (dürüstçe): bu, "değişken/nokta öneki = belirsiz" diyen dar bir sözdizimsel
  // kural — `X=/tmp; rm $X/G5.ok` gibi GERÇEKTEN docs/approvals DIŞINA yazan bir değişken de (docs/
  // approvals başka bir segmentte anıldığı için) yanlışlıkla engellenebilir. Bu AŞIRI ENGELLEME
  // yönündedir (güvenlik kaybı değil) ve dosya başındaki "bare-artifact" mekanizmasının zaten kabul
  // ettiği sınırın (argüman-yapısını ayırt etmeme) doğal bir uzantısıdır.
  const AMBIGUOUS_PREFIX_RE = /(?:^|[\s;&|(])["']?(?:\.{1,2}|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)["']?[\\/]$/;
  function findBareProtectedArtifacts(segment) {
    const found = { ok: false, hook: false };
    BARE_ARTIFACT_SCAN_RE.lastIndex = 0;
    let m;
    while ((m = BARE_ARTIFACT_SCAN_RE.exec(segment))) {
      const before = m.index > 0 ? segment[m.index - 1] : '';
      if (before === '/' || before === '\\') {
        // Görünüşte açık bir yol ("<seyler>/ARTEFAKT") -- ama önek bir DEĞİŞKEN ya da göreli-dizin
        // kısayoluysa (A5 KAPANIŞI, yukarıdaki yorum) hedef GERÇEKTE belirsizdir, atlanmaz.
        const prefix = segment.slice(0, m.index);
        if (!AMBIGUOUS_PREFIX_RE.test(prefix)) continue; // gercekten literal dizin -> acik yol, atla
      }
      if (HOOK_FILENAME_RE.test(m[0])) found.hook = true;
      else found.ok = true; // geriye kalan tek desen ailesi *.ok
    }
    return found;
  }
  const genericRedirect = /(>>|>(?!=))/;
  // v3: tırnak muafiyeti YOK (yukarıdaki M2 KAPANIŞI v3 yorumu) — fiil/satır-içi-betik eşleşmesi
  // metnin HER YERİNDE (tırnak içi dahil) sayılır, doğrudan re.test(seg) ile.
  function segmentHasWriteAction(seg) {
    return writeVerb.test(seg) || inlineEval.test(seg) || genericRedirect.test(seg);
  }

  let isRelease = false;
  let isPush = false;
  let isDestructive = false;
  let isApprovalsWrite = false;
  let isHooksWrite = false;
  let guardedSegment = null; // teşhis için: hangi segment tetikledi (ilk bulunan)

  // Cross-segment mention taraması (bare-artifact korelasyonu İÇİN — yukarıdaki yorum). Aynı-
  // segment mekanizması BUNU KULLANMAZ (o kendi approvalsRef.test(seg) çağrısını yapıyor).
  const anyMentionsApprovals = segments.some((s) => approvalsRef.test(s));
  const anyMentionsHooks = segments.some((s) => hooksRef.test(s));

  // KÖK MEKANİZMA: her segment AYNI kurallarla, TEK BAŞINA değerlendirilir. touchesApprovals/
  // touchesHooks VE writeVerb/inlineEval AYNI segmentten gelmek ZORUNDA — bu, B-6/Y2'nin kökü
  // olan çapraz-segment birleşmesini yapısal olarak imkânsız kılar (bkz dosya başı yorumu).
  for (const seg of segments) {
    if (release.test(seg)) isRelease = true;
    if (pushCmd.test(seg)) isPush = true;
    if (danger.test(seg) || gitForce.test(seg)) isDestructive = true;

    const hasWrite = writeVerb.test(seg) || inlineEval.test(seg);
    if (approvalsRedirect.test(seg) || (approvalsRef.test(seg) && hasWrite)) {
      isApprovalsWrite = true;
      if (!guardedSegment) guardedSegment = seg;
    }
    if (hooksRedirect.test(seg) || (hooksRef.test(seg) && hasWrite)) {
      isHooksWrite = true;
      if (!guardedSegment) guardedSegment = seg;
    }

    // BARE-ARTIFACT KORELASYONU: yalnızca bu segment GERÇEK bir yazma eylemi taşıyorsa taranır.
    if (segmentHasWriteAction(seg)) {
      const artifacts = findBareProtectedArtifacts(seg);
      if (artifacts.ok && anyMentionsApprovals && !isApprovalsWrite) {
        isApprovalsWrite = true;
        if (!guardedSegment) guardedSegment = seg;
      }
      if (artifacts.hook && anyMentionsHooks && !isHooksWrite) {
        isHooksWrite = true;
        if (!guardedSegment) guardedSegment = seg;
      }
    }
  }

  if (isApprovalsWrite) {
    block(`Engellendi: docs/approvals/ altına kabuktan yazma/silme girişimi (segment: "${guardedSegment}"). Onay dosyaları yalnızca Write aracıyla oluşturulmalı (o da kullanıcı izin kartına düşer, docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman A).`);
  }
  if (isHooksWrite) {
    block(`Engellendi: .claude/hooks/** veya .claude/settings.json içine kabuktan yazma/silme girişimi (segment: "${guardedSegment}", Y4 kapanışı). Bu dosyalar yalnızca Write/Edit aracıyla değiştirilmeli (GUARD.ok kapısına düşer, gate-check.cjs).`);
  }

  if (isRelease && !exists('docs/approvals/G6.ok')) {
    block('Engellendi: yayın için G6 onayı (docs/approvals/G6.ok) gerekli. Kullanıcıya AskUserQuestion ile sor.');
  }

  // Yıkıcı kontrolü push'tan ÖNCE değerlendirilir ki zorlamalı bir push
  // tek kullanımlık PUSH.ok'u boşuna harcamasın.
  if (isDestructive && !exists('docs/approvals/DANGER.ok')) {
    block('Engellendi: yıkıcı komut. Kullanıcıya sor; onaylarsa docs/approvals/DANGER.ok yaz (tek kullanımlık) ve komutu tekrar dene.');
  }

  if (isPush && !exists('docs/approvals/G6.ok')) {
    if (!exists('docs/approvals/PUSH.ok')) {
      block('Engellendi: push için tek kullanımlık onay (docs/approvals/PUSH.ok) gerekli. Kullanıcıya AskUserQuestion ile sor; onaylarsa PUSH.ok yaz ve komutu tekrar dene.');
    }
    consume('docs/approvals/PUSH.ok');
  }

  if (isDestructive) consume('docs/approvals/DANGER.ok');

  process.exit(0);
});
