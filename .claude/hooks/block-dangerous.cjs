// PreToolUse (Bash): üç ayrı kapı.
//  1) Gerçek yayın komutları (deploy/publish/release)  -> docs/approvals/G6.ok (kalıcı).
//  2) git push                                         -> G6.ok VEYA docs/approvals/PUSH.ok (TEK KULLANIMLIK).
//  3) Yıkıcı komutlar ve git force                     -> docs/approvals/DANGER.ok (tek kullanımlık).
// Kullanıcı kararı (2026-09-04): push kapısı kalıcı olarak açılmaz; her push öncesi
// kullanıcıya sorulur ve PUSH.ok yazılır, hook onu kullanınca siler.
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

readInput((j) => {
  const cmd = (j.tool_input && j.tool_input.command) || '';
  if (!cmd) process.exit(0);

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
  const danger = /(\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bdrop\s+(table|database)\b|Remove-Item[^\n]*-Recurse|\btruncate\s+table\b|\b(rd|rmdir)\b[^\n]*\/s\b|\b(del|erase)\b(?=[^\n]*\/[sq]\b)|\bri\b[^\n]*-r(e(c(u(r(s(e)?)?)?)?)?)?\b|\bmklink\b)/i;
  // git force — harf duyarlı OLMALI: "-f" force'tur ama "-F" commit mesajını dosyadan okur (zararsız).
  // Duyarsız eşleşme "git commit -F" gibi normal komutları yanlışlıkla engelliyordu.
  const gitForce = /\bgit\b[^\n]*\s(--force\b|--force-with-lease\b|-f\b)/;

  // docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman B (bypass envanteri madde 2/3) — kabuktan
  // docs/approvals/ altına yazma/silme. Bu da bir KARA LİSTEdir (aynı NOT geçerli — derinlik
  // katmanı, mutlak değil; §(b) madde 4 kapatılamıyor, dürüstçe açık). İki alt-sınıf:
  //  b1) klasik yazma/silme fiili (yönlendirme, cp/mv/tee/sed -i, Windows/PowerShell eşdeğerleri)
  //      + komut metninde docs/approvals geçmesi.
  //  b2) satır içi betik (node -e/--eval, npx tsx -e, python -c) + komut metninde docs/approvals
  //      geçmesi — betiğin GERÇEKTEN yazıp yazmadığı metinden güvenilir anlaşılamaz (obfuscation,
  //      ör. fs['writeFileSync']), bu yüzden KASITLI OLARAK geniş: içerik yazma fiili taşımasa
  //      bile engellenir. QA'nın §0.2/§0.3 birebir istismarı (`node -e "require('fs').
  //      writeFileSync('docs/approvals/GUARD.ok', ...)"`) bu sınıfa girer.
  const approvalsRef = /docs[\\/]approvals\b/i;
  // Yönlendirme (`>`/`>>`) AYRI ve DAR bir desendir — hedefin GERÇEKTEN docs/approvals'a
  // baktığını ister (`\s*['"]?docs[\\/]approvals`), aksi hâlde `cat docs/approvals/G5.ok
  // 2>/dev/null` gibi tamamen zararsız, hedefi başka yere (stderr'e) yönlendiren okuma
  // komutları yanlış pozitif alırdı (ilk sürümde tam bu oldu, elle bulundu ve düzeltildi).
  const approvalsRedirect = /(>>|>(?!=))\s*['"]?docs[\\/]approvals\b/i;
  const approvalsWriteVerb = /(\btee\b|\bcp\b|\bcopy\b|\bmv\b|\bmove\b|\bren(?:ame)?\b|\bsed\b[^\n]*-i\b|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b|\bNew-Item\b|\bRemove-Item\b|\b(del|erase)\b|\brd\b|\brmdir\b|\bri\b)/i;
  const approvalsInlineEval = /(\bnode\b[^\n]*(-e\b|--eval\b)|\bnpx\s+tsx\b[^\n]*-e\b|\bpython\b[^\n]*-c\b)/i;
  const touchesApprovals = approvalsRef.test(cmd);
  const isApprovalsWrite =
    approvalsRedirect.test(cmd) || (touchesApprovals && (approvalsWriteVerb.test(cmd) || approvalsInlineEval.test(cmd)));
  if (isApprovalsWrite) {
    block('Engellendi: docs/approvals/ altına kabuktan yazma/silme girişimi. Onay dosyaları yalnızca Write aracıyla oluşturulmalı (o da kullanıcı izin kartına düşer, docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman A).');
  }

  const isRelease = release.test(cmd);
  const isPush = pushCmd.test(cmd);
  const isDestructive = danger.test(cmd) || gitForce.test(cmd);

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
