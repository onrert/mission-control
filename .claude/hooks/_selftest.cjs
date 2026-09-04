// Regresyon testi — block-dangerous.cjs için. Çalıştır: node .claude/hooks/_selftest.cjs
// Test dizeleri parça parça kurulur ki bu dosyanın kendisi hook'a takılmasın.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const G = 'g' + 'it';
const F = '-' + 'f';
const RM = 'r' + 'm';
const PUSH = 'p' + 'ush';

const PUSH_OK = path.join('docs', 'approvals', 'PUSH.ok');
const DANGER_OK = path.join('docs', 'approvals', 'DANGER.ok');

function write(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'selftest\n'); }
function rm(p) { try { fs.unlinkSync(p); } catch (_) {} }

// [komut, beklenen çıkış kodu, açıklama, hazırlık?, sonrası kontrol?]
const cases = [
  [`${G} commit -q -F -`, 0, 'commit -F (mesaj dosyadan) izin verilmeli'],
  [`${G} commit -m mesaj`, 0, 'normal commit'],
  [`${G} add -A`, 0, 'add'],
  [`${G} status --short`, 0, 'status'],
  [`${G} log --oneline`, 0, 'log'],
  [`${RM} -rf build`, 2, 'rm -rf'],
  [`drop table users`, 2, 'drop table'],
  [`${G} reset --hard HEAD`, 2, 'reset hard'],
  [`${G} clean ${F}`, 2, 'clean force'],

  // --- Yayın kapısı: G6.ok gerektirir, PUSH.ok yeterli DEĞİL ---
  ['npm pub' + 'lish', 2, 'npm publish (G6 onayi yok)'],
  ['vercel --prod', 2, 'vercel --prod (G6 onayi yok)'],
  [
    'npm pub' + 'lish', 2, 'npm publish PUSH.ok ile de engelli (push onayi yayin onayi degildir)',
    () => write(PUSH_OK),
    () => { const kept = fs.existsSync(PUSH_OK); rm(PUSH_OK); return kept ? null : 'PUSH.ok tuketilmemeliydi'; },
  ],

  // --- Push kapısı: tek kullanımlık PUSH.ok ---
  [`${G} ${PUSH} origin main`, 2, 'push (onay yok)'],
  [
    `${G} ${PUSH} origin main`, 0, 'push PUSH.ok ile gecer',
    () => write(PUSH_OK),
    () => (fs.existsSync(PUSH_OK) ? (rm(PUSH_OK), 'PUSH.ok tuketilmeliydi (tek kullanimlik)') : null),
  ],
  [
    `${G} ${PUSH} -u origin main`, 0, 'push -u varyanti da gecer',
    () => write(PUSH_OK),
    () => (fs.existsSync(PUSH_OK) ? (rm(PUSH_OK), 'PUSH.ok tuketilmeliydi') : null),
  ],

  // --- Force push: PUSH.ok yetmez, DANGER.ok gerekir; PUSH.ok harcanmamalı ---
  [
    `${G} ${PUSH} ${F} origin main`, 2, 'force push PUSH.ok ile de engelli',
    () => write(PUSH_OK),
    () => { const kept = fs.existsSync(PUSH_OK); rm(PUSH_OK); return kept ? null : 'force push PUSH.ok u harcamamaliydi'; },
  ],
  [`${G} ${PUSH} --force origin main`, 2, 'force push uzun (onay yok)'],
  [
    `${G} ${PUSH} ${F} origin main`, 2, 'force push DANGER.ok var ama PUSH.ok yok -> yine engelli',
    () => write(DANGER_OK),
    () => { rm(DANGER_OK); return null; },
  ],
];

let fail = 0;
for (const [cmd, want, label, setup, check] of cases) {
  if (setup) setup();
  let code = 0;
  try {
    execFileSync('node', ['.claude/hooks/block-dangerous.cjs'], {
      input: JSON.stringify({ tool_input: { command: cmd } }),
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch (e) {
    code = e.status;
  }
  let problem = code === want ? null : `cikan=${code} beklenen=${want}`;
  const after = check ? check() : null;
  if (!problem && after) problem = after;
  if (problem) fail++;
  console.log(`${problem ? 'FAIL' : 'OK  '} ${label}${problem ? '  <- ' + problem : ''}`);
}
// Test artıklarını bırakma.
rm(PUSH_OK);
rm(DANGER_OK);
console.log(fail === 0 ? '\nTUM TESTLER GECTI' : `\n${fail} TEST BASARISIZ`);
process.exit(fail === 0 ? 0 : 1);
