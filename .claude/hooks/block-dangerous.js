// PreToolUse (Bash): yayın/push için G6 onayı, yıkıcı komut için tek kullanımlık DANGER.ok.
const fs = require('fs');
const { readInput, exists, block } = require('./_common');
readInput((j) => {
  const cmd = (j.tool_input && j.tool_input.command) || '';
  if (!cmd) process.exit(0);
  const release = /\b(git\s+push|vercel(\s+--prod)?\b|fly\s+deploy|railway\s+up|gh\s+release|npm\s+publish|eas\s+submit|eas\s+build\b.*--auto-submit)/i;
  // Genel yıkıcı komutlar — büyük/küçük harf duyarsız.
  const danger = /(\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bdrop\s+(table|database)\b|Remove-Item[^\n]*-Recurse|\bdel\s+\/[sq]\b|\btruncate\s+table\b)/i;
  // git force — harf duyarlı OLMALI: "-f" force'tur ama "-F" commit mesajını dosyadan okur (zararsız).
  // Duyarsız eşleşme "git commit -F" gibi normal komutları yanlışlıkla engelliyordu.
  const gitForce = /\bgit\b[^\n]*\s(--force\b|--force-with-lease\b|-f\b)/;
  if (release.test(cmd) && !exists('docs/approvals/G6.ok')) {
    block('Engellendi: yayın/push için G6 onayı (docs/approvals/G6.ok) gerekli. Kullanıcıya AskUserQuestion ile sor.');
  }
  if (danger.test(cmd) || gitForce.test(cmd)) {
    if (exists('docs/approvals/DANGER.ok')) { try { fs.unlinkSync('docs/approvals/DANGER.ok'); } catch (_) {} process.exit(0); }
    block('Engellendi: yıkıcı komut. Kullanıcıya sor; onaylarsa docs/approvals/DANGER.ok yaz (tek kullanımlık) ve komutu tekrar dene.');
  }
  process.exit(0);
});
