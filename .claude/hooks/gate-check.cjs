// PreToolUse (Edit|Write): G2 onayı yokken kod dizinine yazılamaz.
// GUARD.ok: `.claude/hooks/**` ve `.claude/settings.json` kendi güvenlik zincirini (bu hook
// dahil) taşır. Bunlar G2'nin "mimari onayı" kapsamına GİRMEZ — meşru bakım (hook `.cjs`'e
// taşınması, kredi kapısı düzeltmesi gibi) G2 onayı olmadan da olur — ama G2.ok'a hiç bakmadan
// "docs/" gibi tamamen serbest bırakılmaları da yanlıştı (bkz. docs/qa/G5-guvenlik-denetimi-
// 2026-09-10.md K1: barındırılan CEO oturumu kendi hook'unu G2 onayı olmadan sessizce
// zayıflatabiliyordu). Bu yüzden ayrı, DANGER.ok/PUSH.ok ile aynı desende, tek kullanımlık bir
// onay: docs/approvals/GUARD.ok. `.claude/agents/**` ve `.claude/agent-memory/**` güvenlik
// sınırı değildir, serbest kalır.
const path = require('path');
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

readInput((j) => {
  const f = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || '';
  if (!f) process.exit(0);
  let rel = path.relative(process.cwd(), path.resolve(f)).replace(/\\/g, '/');
  if (rel.startsWith('..')) process.exit(0); // proje dışı: karışma

  const isGuarded = /^\.claude\/hooks\//.test(rel) || rel === '.claude/settings.json';
  if (isGuarded) {
    if (!exists('docs/approvals/GUARD.ok')) {
      block(`Engellendi: "${rel}" kendi güvenlik korumanızı değiştiriyor — docs/approvals/GUARD.ok (tek kullanımlık) gerekli. Kullanıcıya AskUserQuestion ile sor; onaylarsa GUARD.ok yaz ve komutu tekrar dene.`);
    }
    consume('docs/approvals/GUARD.ok');
    process.exit(0);
  }

  const free = [/^docs\//, /^\.claude\//, /^assets\//, /^README\.md$/, /^\.gitignore$/, /^CLAUDE\.md$/, /^KURULUM\.md$/];
  if (free.some((r) => r.test(rel))) process.exit(0);
  if (!exists('docs/approvals/G2.ok')) {
    block(`Engellendi: "${rel}" yazılamaz — G2 (mimari) onayı yok. Önce kullanıcıdan G2 onayı al ve docs/approvals/G2.ok oluştur.`);
  }
  process.exit(0);
});
