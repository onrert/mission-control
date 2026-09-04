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
  const danger = /(\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bdrop\s+(table|database)\b|Remove-Item[^\n]*-Recurse|\bdel\s+\/[sq]\b|\btruncate\s+table\b)/i;
  // git force — harf duyarlı OLMALI: "-f" force'tur ama "-F" commit mesajını dosyadan okur (zararsız).
  // Duyarsız eşleşme "git commit -F" gibi normal komutları yanlışlıkla engelliyordu.
  const gitForce = /\bgit\b[^\n]*\s(--force\b|--force-with-lease\b|-f\b)/;

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
