// PreToolUse (mcp__higgsfield__*): kredi harcayan üretimler ASSETS.ok olmadan çalışmaz.
const { readInput, exists, block } = require('./_common.cjs');
readInput((j) => {
  const t = j.tool_name || '';
  const spends = /^mcp__higgsfield__(generate|create_website|deploy_website|dubbing|upscale|motion_control|shorts_studio_create|outpaint|remove_background|voice_change|personal_clipper_create|reframe)/i;
  if (spends.test(t) && !exists('docs/approvals/ASSETS.ok')) {
    block('Engellendi: Higgsfield üretimi kredi harcar. Kullanıcıdan bütçe onayı al ve docs/approvals/ASSETS.ok yaz.');
  }
  process.exit(0);
});
