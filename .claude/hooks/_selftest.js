// Geçici regresyon testi — block-dangerous.js için. Çalıştır: node .claude/hooks/_selftest.js
// Test dizeleri parça parça kurulur ki bu dosyanın kendisi hook'a takılmasın.
const { execFileSync } = require('child_process');
const G = 'g' + 'it';
const F = '-' + 'f';
const RM = 'r' + 'm';

const cases = [
  [`${G} commit -q -F -`, 0, 'commit -F (mesaj dosyadan) izin verilmeli'],
  [`${G} commit -m mesaj`, 0, 'normal commit'],
  [`${G} add -A`, 0, 'add'],
  [`${G} status --short`, 0, 'status'],
  [`${G} log --oneline`, 0, 'log'],
  [`${G} push ${F} origin main`, 2, 'force push'],
  [`${G} push --force origin main`, 2, 'force push uzun'],
  [`${G} clean ${F}`, 2, 'clean force'],
  [`${G} reset --hard HEAD`, 2, 'reset hard'],
  [`${RM} -rf build`, 2, 'rm -rf'],
  [`drop table users`, 2, 'drop table'],
  [`${G} push origin main`, 2, 'push (G6 onayi yok)'],
];

let fail = 0;
for (const [cmd, want, label] of cases) {
  let code = 0;
  try {
    execFileSync('node', ['.claude/hooks/block-dangerous.js'], {
      input: JSON.stringify({ tool_input: { command: cmd } }),
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch (e) {
    code = e.status;
  }
  const ok = code === want;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} cikan=${code} beklenen=${want}  ${label}`);
}
console.log(fail === 0 ? '\nTUM TESTLER GECTI' : `\n${fail} TEST BASARISIZ`);
process.exit(fail === 0 ? 0 : 1);
