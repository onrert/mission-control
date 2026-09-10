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
const GUARD_STATE = path.join('docs', 'approvals', '.guard-state.json');

function write(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'selftest\n'); }
// Madde 4 (docs/qa/g5-guvenlik-duzeltme-tur3-contract.md): GUARD.ok artık kapsamını backtick
// ile listeleyen bir onay metnidir. Sentetik/regresyon testleri için gerçek .cjs dosyalarına
// DOKUNMADAN (hook script'i hedef dosyaya hiçbir zaman yazmıyor, yalnızca stdin'deki
// file_path'i değerlendiriyor) uydurma veya gerçek dosya adları backtick ile anılır.
function writeGuardScope(names) {
  fs.mkdirSync(path.dirname(GUARD_OK), { recursive: true });
  const list = names.map((n) => '`' + n + '`').join(' ve ');
  fs.writeFileSync(GUARD_OK, `selftest onayi: ${list} icin\n`);
}
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
  [`${RI} -r build`, 2, '(g) PowerShell ri -r (kisaltma zinciri, 1/7)'],
  [`${RI} -Recurse build`, 2, '(g) PowerShell ri -Recurse (kisaltma zinciri, tam hali)'],

  // --- (g) GG2 kısaltma zinciri (madde 2, tur3): -re/-rec/-recu/-recur/-recurs ara adımları ---
  [`${RI} -re build`, 2, '(g) PowerShell ri -re (kisaltma zinciri, 2/7)'],
  [`${RI} -rec build`, 2, '(g) PowerShell ri -rec (kisaltma zinciri, 3/7)'],
  [`${RI} -recu build`, 2, '(g) PowerShell ri -recu (kisaltma zinciri, 4/7)'],
  [`${RI} -recur build`, 2, '(g) PowerShell ri -recur (kisaltma zinciri, 5/7)'],
  [`${RI} -recurs build`, 2, '(g) PowerShell ri -recurs (kisaltma zinciri, 6/7)'],
  [`${RI} build`, 0, '(g) ri bayraksiz — yanlis pozitif olmamali'],
  [`${RI} -Force build`, 0, '(g) ri -Force — farkli bayrak, yanlis pozitif olmamali'],
  [`${RI} -Recreate build`, 0, '(g) ri -Recreate — benzer ama farkli kelime, yanlis pozitif olmamali'],

  [`${RMDIR} emptydir`, 0, 'rmdir bayraksiz (bos dizin, yikici degil) — yanlis pozitif olmamali'],
  [`${G} commit -m "update ${RD} readme"`, 0, 'metinde bare "rd" kelimesi, bayrak yok — yanlis pozitif olmamali'],

  // --- Katman B (docs/qa/g5-onay-dosyasi-korumasi-contract.md, bypass envanteri madde 2/3):
  // kabuktan docs/approvals altina yazma/silme. b1 = klasik yazma fiili, b2 = satir ici betik.
  [`echo x > docs/approvals/GUARD.ok`, 2, '(b1) yonlendirme > ile docs/approvals altina yazma'],
  [`echo x >> docs/approvals/GUARD.ok`, 2, '(b1) yonlendirme >> ile docs/approvals altina ekleme'],
  [`cp foo docs/approvals/GUARD.ok`, 2, '(b1) cp ile docs/approvals altina kopyalama'],
  [`copy foo docs\\approvals\\GUARD.ok`, 2, '(b1) Windows copy, ters bolu ayraci'],
  [`mv foo docs/approvals/GUARD.ok`, 2, '(b1) mv ile docs/approvals altina tasima'],
  [`tee docs/approvals/GUARD.ok`, 2, '(b1) tee ile docs/approvals altina yazma'],
  [`sed -i s/a/b/ docs/approvals/GUARD.ok`, 2, '(b1) sed -i ile yerinde duzenleme'],
  [`Set-Content docs/approvals/GUARD.ok -Value x`, 2, '(b1) PowerShell Set-Content'],
  [`Out-File -FilePath docs/approvals/GUARD.ok`, 2, '(b1) PowerShell Out-File'],
  [`Add-Content docs/approvals/GUARD.ok -Value x`, 2, '(b1) PowerShell Add-Content'],
  [`del docs\\approvals\\GUARD.ok`, 2, '(b1) del, bayraksiz TEK dosya (eski danger deseni bunu yakalamiyordu)'],
  [`erase docs\\approvals\\GUARD.ok`, 2, '(b1) erase, bayraksiz TEK dosya'],
  [`rd docs\\approvals\\GUARD.ok`, 2, '(b1) rd, bayraksiz TEK dosya'],
  [`rmdir docs\\approvals\\GUARD.ok`, 2, '(b1) rmdir, bayraksiz TEK dosya'],
  [`ri docs/approvals/GUARD.ok`, 2, '(b1) PowerShell ri, bayraksiz TEK dosya'],
  [`Remove-Item docs/approvals/GUARD.ok`, 2, '(b1) PowerShell Remove-Item, bayraksiz TEK dosya'],
  [`echo x > DOCS\\APPROVALS\\guard.ok`, 2, '(b1) harf duyarsizlik + ters bolu ayraci'],
  [
    `node -e "require('fs').writeFileSync('docs/approvals/GUARD.ok','x')"`, 2,
    '(b2) QA PoC birebir: node -e ile writeFileSync (docs/qa/G5-guvenlik-denetimi-2026-09-10-tur3.md §0.2)',
  ],
  [`node --eval "fs.appendFileSync('docs/approvals/GUARD.ok','x')"`, 2, '(b2) node --eval + appendFileSync (QA §0.3 kapsam genisletme PoC ailesi)'],
  [`npx tsx -e "require('fs').writeFileSync('docs/approvals/GUARD.ok','x')"`, 2, '(b2) npx tsx -e satir ici betik'],
  [`python -c "open('docs/approvals/GUARD.ok','w').write('x')"`, 2, '(b2) python -c satir ici betik'],
  [`node -e "console.log('hello')"`, 0, '(b2) yanlis pozitif olmamali: docs/approvals gecmeyen zararsiz node -e'],
  [`cat docs/approvals/G5.ok`, 0, 'yanlis pozitif olmamali: docs/approvals okuma (cat)'],
  [`ls docs/approvals`, 0, 'yanlis pozitif olmamali: docs/approvals okuma (ls)'],
  [`git add docs/approvals/G5.ok`, 0, 'yanlis pozitif olmamali: git add docs/approvals altinda'],
  [`git commit -m "add G5.ok"`, 0, 'yanlis pozitif olmamali: git commit, docs/approvals disinda'],
  [`cat docs/approvals/G5.ok 2>/dev/null`, 0, 'yanlis pozitif olmamali: docs/approvals okuma + ILGISIZ stderr yonlendirmesi (ilk surumde bu KIRMIZI veriyordu, elle bulunup duzeltildi)'],
  [`ls -la docs/approvals/ 2>&1`, 0, 'yanlis pozitif olmamali: ls + 2>&1 (ayni sinif)'],
  [`type docs\\approvals\\GUARD.ok`, 0, 'yanlis pozitif olmamali: Windows type (yonlendirmesiz okuma)'],
];

// --- gate-check.cjs vakaları (K1) --------------------------------------------------------
// [file_path, beklenen çıkış kodu, açıklama, hazırlık?, sonrası kontrol?]
const HOOK_FILE = path.join('.claude', 'hooks', 'block-dangerous.cjs');
const SETTINGS_FILE = path.join('.claude', 'settings.json');
const SRC_FILE = path.join('src', 'server', 'index.ts');
const AGENT_FILE = path.join('.claude', 'agents', 'selftest-fixture.md');
const AGENT_MEMORY_FILE = path.join('.claude', 'agent-memory', 'selftest-fixture.md');

const gateCases = [
  [HOOK_FILE, 2, 'K1: hook dosyasina yazma GUARD.ok yokken engelli'],
  [SETTINGS_FILE, 2, 'K1: settings.json yazma GUARD.ok yokken engelli'],
  [
    HOOK_FILE, 0, 'K1: hook dosyasina yazma GUARD.ok ile (gercek dosya kapsami) gecer VE tuketilir',
    () => writeGuardScope(['block-dangerous.cjs']),
    () => (fs.existsSync(GUARD_OK) ? (rm(GUARD_OK), rm(GUARD_STATE), 'GUARD.ok tuketilmeliydi (tek kullanimlik)') : null),
  ],
  [
    SETTINGS_FILE, 0, 'K1: settings.json yazma GUARD.ok ile (gercek dosya kapsami) gecer VE tuketilir',
    () => writeGuardScope(['.claude/settings.json']),
    () => (fs.existsSync(GUARD_OK) ? (rm(GUARD_OK), rm(GUARD_STATE), 'GUARD.ok tuketilmeliydi') : null),
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

  // --- (a)/(b) harf varyantı regresyon: isGuarded case-insensitive olmalı (GUARD.ok yokken) ---
  [
    '.CLAUDE/HOOKS/block-dangerous.cjs', 2, '(a) tamamen buyuk harfli hook yolu GUARD.ok yokken engellenir',
    () => { rm(GUARD_OK); rm(GUARD_STATE); },
  ],
  [
    '.claude/Hooks/block-dangerous.cjs', 2, '(b) karisik harfli hook yolu GUARD.ok yokken engellenir',
    () => { rm(GUARD_OK); rm(GUARD_STATE); },
  ],

  // --- (d) .claude/agent-memory/** de agents/** gibi serbest, güvenlik sınırı değil ---
  [
    AGENT_MEMORY_FILE, 0, '(d) .claude/agent-memory/** serbest, GUARD.ok yokken de gecer',
    null,
    () => (existsFile(GUARD_OK) ? 'GUARD.ok olmamaliydi (hic yazilmadi)' : null),
  ],
  [
    AGENT_MEMORY_FILE, 0, '(d) .claude/agent-memory/** icin GUARD.ok bosuna harcanmaz',
    () => write(GUARD_OK),
    () => { const kept = fs.existsSync(GUARD_OK); rm(GUARD_OK); return kept ? null : 'agent-memory/** korumali degil, GUARD.ok harcanmamaliydi'; },
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

// --- Madde 4 (GUARD.ok kapsam mekanizması) sentetik testleri: (c)/(e)/(f) ------------------
// Sentetik dosya adları kullanılır — hook script'i hedef dosyaya HİÇBİR ZAMAN yazmıyor,
// yalnızca stdin'deki file_path'i değerlendirip izin/red kararı veriyor.
function callGate(filePath) {
  let code = 0;
  try {
    execFileSync('node', ['.claude/hooks/gate-check.cjs'], {
      input: JSON.stringify({ tool_input: { file_path: filePath } }),
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch (e) { code = e.status; }
  return code;
}
function reportScope(label, ok) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} [gate-check.cjs] ${label}`);
  return ok ? 0 : 1;
}

// (c) tek dosyalık sentetik kapsam: harf varyantıyla istek de geçer VE tüketilir.
rm(GUARD_OK); rm(GUARD_STATE);
writeGuardScope(['selftest-c.cjs']);
{
  const code = callGate('.CLAUDE/Hooks/Selftest-C.CJS');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(c) tek dosyalik sentetik kapsam: harf varyantiyla istek de gecer ve tuketir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (e) kapsam dışı yol, geçerli (sentetik) GUARD.ok varken bile reddedilir; token harcanmaz.
writeGuardScope(['selftest-e.cjs']);
{
  const code = callGate('.claude/hooks/selftest-e-disinda.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(e) kapsam disi yol, gecerli GUARD.ok varken bile reddedilir; token harcanmaz', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (f) iki dosyalık sentetik kapsam: ilk yazma geçer + token KALIR, ikinci yazma geçer + token TÜKENİR.
writeGuardScope(['selftest-f1.cjs', 'selftest-f2.cjs']);
{
  const code1 = callGate('.claude/hooks/selftest-f1.cjs');
  const remainsAfterFirst = fs.existsSync(GUARD_OK);
  const code2 = callGate('.claude/hooks/selftest-f2.cjs');
  const consumedAfterSecond = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope(
    '(f) iki dosyalik sentetik kapsam: ilk yazma gecer+token kalir, ikinci yazma gecer+token tukenir',
    code1 === 0 && remainsAfterFirst && code2 === 0 && consumedAfterSecond,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// --- Katman A (docs/qa/g5-onay-dosyasi-korumasi-contract.md): docs/approvals/** ask/blok
// testleri. `run()`'ın aksine STDOUT'u da yakalar — bir "ask" kararının gerçekten
// permissionDecision:'ask' JSON'u ile mi geldiğini, yoksa sessiz exit 0 (hiç sorulmadan izin)
// mi olduğunu ayırt etmek İÇİN gerekli (yalnızca exit kodu 0/0 ile ayırt edilemez — "her çitin
// kendi pozitif kontrolü olmalı" dersi, bu tam olarak o kontrol).
function callGateCapture(filePath) {
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', ['.claude/hooks/gate-check.cjs'], {
      input: JSON.stringify({ tool_input: { file_path: filePath } }),
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString('utf8');
  } catch (e) {
    code = e.status;
    stdout = e.stdout ? e.stdout.toString('utf8') : '';
  }
  return { code, stdout };
}
function isAskJson(stdout, expectedReasonSubstring) {
  let parsed;
  try { parsed = JSON.parse(stdout); } catch (_) { return false; }
  const out = parsed && parsed.hookSpecificOutput;
  if (!out || out.hookEventName !== 'PreToolUse' || out.permissionDecision !== 'ask') return false;
  if (expectedReasonSubstring && !String(out.permissionDecisionReason || '').includes(expectedReasonSubstring)) return false;
  return true;
}
const approvalsAskCases = [
  ['docs/approvals/G5.ok', 'permissionDecision:ask (gercek gate onayi, sentetik dosya adi)'],
  ['docs/approvals/GUARD.ok', 'permissionDecision:ask (onay dosyasinin KENDISI)'],
  ['docs/approvals/DANGER.ok', 'permissionDecision:ask'],
  ['docs/approvals/PUSH.ok', 'permissionDecision:ask'],
  ['docs/approvals/README.md', 'permissionDecision:ask (README dahil, brief acikca istedi)'],
  ['docs/approvals/archive/G2-2026-01-01T00-00-00-000Z.deny.md', 'permissionDecision:ask (archive/** dahil)'],
  ['DOCS/APPROVALS/g5.OK', 'permissionDecision:ask (harf duyarsiz)'],
];
for (const [filePath, label] of approvalsAskCases) {
  const { code, stdout } = callGateCapture(filePath);
  const ok = code === 0 && isAskJson(stdout, 'GÜVENLİK KAPISINI');
  fail += reportScope(`(katman A) ${filePath} -> ${label}`, ok);
}
{
  const { code, stdout } = callGateCapture('docs/approvals/.guard-state.json');
  const ok = code === 2 && stdout === '';
  fail += reportScope('(katman A) .guard-state.json her zaman SERT engellenir, ask DEGIL', ok);
}
{
  // Regresyon: docs/approvals DISINDAKI docs/** hala tamamen serbest, ask YOK.
  const { code, stdout } = callGateCapture('docs/qa/some-unrelated-note.md');
  const ok = code === 0 && stdout === '';
  fail += reportScope('(katman A) docs/approvals DISI docs/** hala sessizce serbest (regresyon)', ok);
}

// Test artıklarını bırakma.
rm(PUSH_OK);
rm(DANGER_OK);
rm(GUARD_OK);
rm(GUARD_STATE);
console.log(fail === 0 ? '\nTUM TESTLER GECTI' : `\n${fail} TEST BASARISIZ`);
process.exit(fail === 0 ? 0 : 1);
