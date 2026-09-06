// PreToolUse (mcp__<higgsfield sunuculari>__*): kredi harcayan üretimler ASSETS.ok olmadan çalışmaz.
const { readInput, exists, block } = require('./_common.cjs');
readInput((j) => {
  const t = j.tool_name || '';
  const SERVERS = '(?:[Hh]iggsfield|21483710-7850-4248-ab7a-1fb9bc4656ee)';
  const spends = new RegExp('^mcp__' + SERVERS + '__(generate|create_website|deploy_website|dubbing|upscale|motion_control|shorts_studio_create|outpaint|remove_background|voice_change|personal_clipper_create|reframe)', 'i');
  if (spends.test(t) && !exists('docs/approvals/ASSETS.ok')) {
    block('Engellendi: Higgsfield üretimi kredi harcar. Kullanıcıdan bütçe onayı al ve docs/approvals/ASSETS.ok yaz.');
  }
  process.exit(0);
});
