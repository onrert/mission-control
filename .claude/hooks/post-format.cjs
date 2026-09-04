// PostToolUse (Edit|Write): biçimlendirici varsa çalıştırır; yoksa sessizce geçer.
const { execSync } = require('child_process');
const { readInput } = require('./_common.cjs');
readInput((j) => {
  const f = (j.tool_input && j.tool_input.file_path) || '';
  if (!f || /(^|[\\/])docs[\\/]/.test(f)) process.exit(0);
  try {
    if (/\.(ts|tsx|js|jsx|json|css|scss|html)$/.test(f)) execSync(`npx --no-install prettier --log-level silent --write "${f}"`, { stdio: 'ignore' });
    else if (/\.py$/.test(f)) execSync(`ruff format "${f}"`, { stdio: 'ignore' });
  } catch (_) {}
  process.exit(0);
});
