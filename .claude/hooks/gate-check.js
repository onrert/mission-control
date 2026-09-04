// PreToolUse (Edit|Write): G2 onayı yokken kod dizinine yazılamaz.
const path = require('path');
const { readInput, exists, block } = require('./_common');
readInput((j) => {
  const f = (j.tool_input && (j.tool_input.file_path || j.tool_input.path)) || '';
  if (!f) process.exit(0);
  let rel = path.relative(process.cwd(), path.resolve(f)).replace(/\\/g, '/');
  if (rel.startsWith('..')) process.exit(0); // proje dışı: karışma
  const free = [/^docs\//, /^\.claude\//, /^assets\//, /^README\.md$/, /^\.gitignore$/, /^CLAUDE\.md$/, /^KURULUM\.md$/];
  if (free.some((r) => r.test(rel))) process.exit(0);
  if (!exists('docs/approvals/G2.ok')) {
    block(`Engellendi: "${rel}" yazılamaz — G2 (mimari) onayı yok. Önce kullanıcıdan G2 onayı al ve docs/approvals/G2.ok oluştur.`);
  }
  process.exit(0);
});
