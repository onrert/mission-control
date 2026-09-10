// Regresyon testi — block-dangerous.cjs VE gate-check.cjs için.
// Çalıştır: node .claude/hooks/_selftest.cjs
// Test dizeleri parça parça kurulur ki bu dosyanın kendisi hook'a takılmasın.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const G = 'g' + 'it';
const F = '-' + 'f';
const RM = 'r' + 'm';
const PUSH = 'p' + 'ush';
const DEL = 'd' + 'el';
const ERASE = 'era' + 'se';
const RD = 'r' + 'd';
const RMDIR = 'rm' + 'dir';
const RI = 'r' + 'i';
const FLAG_S = '/' + 's';
const FLAG_Q = '/' + 'q';
const FLAG_F = '/' + 'f';

const PUSH_OK = path.join('docs', 'approvals', 'PUSH.ok');
const DANGER_OK = path.join('docs', 'approvals', 'DANGER.ok');
const GUARD_OK = path.join('docs', 'approvals', 'GUARD.ok');

function write(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'selftest\n'); }
function rm(p) { try { fs.unlinkSync(p); } catch (_) {} }
function existsFile(p) { return fs.existsSync(p); }

// --- block-dangerous.cjs vakaları -------------------------------------------------------
// [komut, beklenen çıkış kodu, açıklama, hazırlık?, sonrası kontrol?]
const dangerCases = [
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

  // --- K2 (docs/qa/G5-guvenlik-denetimi-2026-09-10.md): Windows silme komutları ---
  [`${DEL} ${FLAG_S} ${FLAG_Q} build`, 2, 'del /s /q (regresyon, onceden de engelliydi)'],
  [`${DEL} ${FLAG_F} ${FLAG_S} ${FLAG_Q} build`, 2, 'del /f /s /q — bayrak sirasi degisince kaciyordu, artik engelli'],
  [`${DEL} ${FLAG_Q} ${FLAG_S} build`, 2, 'del /q /s — ters sira'],
  [`${RD} ${FLAG_S} ${FLAG_Q} build`, 2, 'rd /s /q — hic taninmiyordu, artik engelli'],
  [`${RMDIR} ${FLAG_S} ${FLAG_Q} build`, 2, 'rmdir /s /q — hic taninmiyordu, artik engelli'],
  [`${ERASE} ${FLAG_S} ${FLAG_Q} build`, 2, 'erase /s /q (del esdegeri)'],
  [`${RI} -r build`, 2, 'PowerShell ri -r (Remove-Item kisaltmasi)'],
  [`${RI} -Recurse build`, 2, 'PowerShell ri -Recurse'],
  [`${RMDIR} emptydir`, 0, 'rmdir bayraksiz (bos dizin, yikici degil) — yanlis pozitif olmamali'],
  [`${G} commit -m "update ${RD} readme"`, 0, 'metinde bare "rd" kelimesi, bayrak yok — yanlis pozitif olmamali'],
];

// --- gate-check.cjs vakaları (K1) --------------------------------------------------------
// [file_path, beklenen çıkış kodu, açıklama, hazırlık?, sonrası kontrol?]
const HOOK_FILE = path.join('.claude', 'hooks', 'block-dangerous.cjs');
const SETTINGS_FILE = path.join('.claude', 'settings.json');
const SRC_FILE = path.join('src', 'server', 'index.ts');
const AGENT_FILE = path.join('.claude', 'agents', 'selftest-fixture.md');

const gateCases = [
  [HOOK_FILE, 2, 'K1: hook dosyasina yazma GUARD.ok yokken engelli'],
  [SETTINGS_FILE, 2, 'K1: settings.json yazma GUARD.ok yokken engelli'],
  [
    HOOK_FILE, 0, 'K1: hook dosyasina yazma GUARD.ok ile gecer VE tuketilir',
    () => write(GUARD_OK),
    () => (fs.existsSync(GUARD_OK) ? (rm(GUARD_OK), 'GUARD.ok tuketilmeliydi (tek kullanimlik)') : null),
  ],
  [
    SETTINGS_FILE, 0, 'K1: settings.json yazma GUARD.ok ile gecer VE tuketilir',
    () => write(GUARD_OK),
    () => (fs.existsSync(GUARD_OK) ? (rm(GUARD_OK), 'GUARD.ok tuketilmeliydi') : null),
  ],
  [
    AGENT_FILE, 0, 'yanlis pozitif: .claude/agents/** serbest, GUARD.ok yokken de gecer',
    null,
    () => (existsFile(GUARD_OK) ? 'GUARD.ok olmamaliydi (hic yazilmadi)' : null),
  ],
  [
    AGENT_FILE, 0, 'yanlis pozitif: .claude/agents/** icin GUARD.ok bosuna harcanmaz',
    () => write(GUARD_OK),
    () => { const kept = fs.existsSync(GUARD_OK); rm(GUARD_OK); return kept ? null : 'agents/** korumali degil, GUARD.ok harcanmamaliydi'; },
  ],
  [
    // Bu depoda docs/approvals/G2.ok gerçek ve dokunulmaz — o yüzden src/** zaten serbest.
    // Asıl iddia: GUARD.ok ile hiçbir ilgisi yok, src/** yazması GUARD.ok'u tüketmez.
    SRC_FILE, 0, 'regresyon: src/** (G2.ok mevcut) serbest, GUARD.ok ile ilgisiz ve onu tuketmez',
    () => write(GUARD_OK),
    () => { const kept = fs.existsSync(GUARD_OK); rm(GUARD_OK); return kept ? null : 'src/** GUARD.ok tuketmemeliydi (korumali degil)'; },
  ],
];

function run(script, cases, inputBuilder) {
  let fail = 0;
  for (const [arg, want, label, setup, check] of cases) {
    if (setup) setup();
    let code = 0;
    try {
      execFileSync('node', [script], {
        input: JSON.stringify(inputBuilder(arg)),
        stdio: ['pipe', 'ignore', 'ignore'],
      });
    } catch (e) {
      code = e.status;
    }
    let problem = code === want ? null : `cikan=${code} beklenen=${want}`;
    const after = check ? check() : null;
    if (!problem && after) problem = after;
    if (problem) fail++;
    console.log(`${problem ? 'FAIL' : 'OK  '} [${path.basename(script)}] ${label}${problem ? '  <- ' + problem : ''}`);
  }
  return fail;
}

let fail = 0;
fail += run('.claude/hooks/block-dangerous.cjs', dangerCases, (cmd) => ({ tool_input: { command: cmd } }));
fail += run('.claude/hooks/gate-check.cjs', gateCases, (filePath) => ({ tool_input: { file_path: filePath } }));

// Test artıklarını bırakma.
rm(PUSH_OK);
rm(DANGER_OK);
rm(GUARD_OK);
console.log(fail === 0 ? '\nTUM TESTLER GECTI' : `\n${fail} TEST BASARISIZ`);
process.exit(fail === 0 ? 0 : 1);
