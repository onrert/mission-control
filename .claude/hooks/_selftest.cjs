// Regresyon testi — block-dangerous.cjs VE gate-check.cjs için.
// Çalıştır: node .claude/hooks/_selftest.cjs
// Test dizeleri parça parça kurulur ki bu dosyanın kendisi hook'a takılmasın.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Y3 düzeltmesi (docs/qa/g5-tur5-kapsam-ve-selftest-contract.md): bu betik ARTIK GERÇEK
// docs/approvals/ yollarına hiç dokunmuyor. Aşağıdaki blok, betiğin geri kalanının çalışacağı
// izole bir sandbox dizinine `process.chdir()` yapar: gerçek `.claude/hooks/*.cjs` dosyaları
// (bu dosyanın kendisi HARİÇ) BİREBİR, değiştirilmeden sandbox'a kopyalanır; testler o
// kopyalar üzerinden ve sandbox'ın KENDİ `docs/approvals/` dizini üzerinden çalışır. Betiğin
// geri kalanı (aşağıdaki tüm dangerCases/gateCases/(c)(e)(f)/Y1/Katman A/K-A/K-B/fail-closed
// testleri) HİÇBİR DEĞİŞİKLİK OLMADAN, salt göreli-yol varsayımına güvenerek sandbox içinde
// aynen çalışır — çünkü hook'ların kendisi (`_common.cjs`, `gate-check.cjs`,
// `block-dangerous.cjs`) zaten `process.cwd()`'ye göreli yollarla çalışıyor (ör.
// `docs/approvals/GUARD.ok`), mutlak yol hardcode etmiyorlar.
//
// Emniyet kemeri (ikinci, bağımsız katman): sandbox'a geçmeden ÖNCE, ÇAĞIRANIN GERÇEK
// cwd'sindeki docs/approvals/ altında PUSH.ok/DANGER.ok/GUARD.ok/.guard-state.json var mı
// kontrol edilir. Varsa — bu kullanıcının GERÇEK, henüz tüketilmemiş bir onayı olabilir —
// betik hiçbir şeye dokunmadan reddeder (exit 3). Sandbox izolasyonu bu dosyalara
// dokunulmasını zaten yapısal olarak imkânsız kılıyor; bu kontrol yalnızca "sandbox kurulumu
// her nasılsa başarısız olursa/ileride bozulursa" ihtimaline karşı bağımsız bir emniyettir —
// CLAUDE.md'nin kendi diliyle: "bir güvenlik testinin, koruduğu şeyi tahrip etmesi" sınıfını
// ikinci bir katmanla da kapatır.
const REAL_ROOT = process.cwd();
const REAL_APPROVALS_DIR = path.join(REAL_ROOT, 'docs', 'approvals');
const REAL_PENDING = ['PUSH.ok', 'DANGER.ok', 'GUARD.ok', '.guard-state.json']
  .map((n) => path.join(REAL_APPROVALS_DIR, n))
  .filter((p) => fs.existsSync(p));
if (REAL_PENDING.length) {
  console.error('REDDEDILDI: self-test calistirilmadi, hicbir dosyaya dokunulmadi.');
  console.error('Gercek, henuz tuketilmemis olabilecek onay/durum dosyalari mevcut:');
  for (const p of REAL_PENDING) console.error('  - ' + path.relative(REAL_ROOT, p));
  console.error('Once bu onayi isleyin (ilgili komutu calistirip GERCEKTEN tuketilmesini saglayin)');
  console.error('ya da bir kalinti oldugundan eminseniz elle inceleyip kaldirin, sonra tekrar deneyin.');
  process.exit(3);
}

const REAL_HOOKS_DIR = path.join(REAL_ROOT, '.claude', 'hooks');
let SANDBOX_ROOT;
try {
  SANDBOX_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-selftest-'));
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.claude', 'hooks'), { recursive: true });
  for (const name of fs.readdirSync(REAL_HOOKS_DIR)) {
    if (!name.endsWith('.cjs') || name === '_selftest.cjs') continue;
    fs.copyFileSync(path.join(REAL_HOOKS_DIR, name), path.join(SANDBOX_ROOT, '.claude', 'hooks', name));
  }
  fs.mkdirSync(path.join(SANDBOX_ROOT, 'docs', 'approvals'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, 'assets'), { recursive: true });
  // gateCases SRC_FILE senaryosu gercek repoda "docs/approvals/G2.ok var" varsayimina dayanir
  // (o zaman src/** serbesttir); sandbox kendi izole G2.ok fixture'ini tasir, GERCEK G2.ok'a
  // hic dokunulmaz/okunmaz.
  fs.writeFileSync(path.join(SANDBOX_ROOT, 'docs', 'approvals', 'G2.ok'), 'selftest sandbox fixture\n');
} catch (e) {
  console.error('REDDEDILDI: izole sandbox kurulamadi, self-test calistirilmadi: ' + e.message);
  process.exit(4);
}
process.chdir(SANDBOX_ROOT);
process.on('exit', () => {
  try { process.chdir(REAL_ROOT); } catch (_) {}
  try { fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true }); } catch (_) {}
});

const G = 'g' + 'it';
const F = '-' + 'f';
const RM = 'r' + 'm';
const PUSH = 'p' + 'ush';
const DEL = 'd' + 'el';
const ERASE = 'era' + 'se';
const RD = 'r' + 'd';
const RMDIR = 'rm' + 'dir';
const RI = 'r' + 'i';
const ML = 'mk' + 'link';
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
// Y1 tur 1 (docs/qa/g5-tur5-kapsam-ve-selftest-contract.md): parseGuardScope artık YALNIZCA
// "## Kapsam" başlığının bloğunu okuyor — bu helper da güncel format için o başlığı üretir
// (eski düzyazı-serpiştirilmiş biçim artık geçerli bir onay metni SAYILMIYOR, bilerek).
// Y1 tur 2 (docs/qa/g5-tur5-kapsam-siniri-tur2-contract.md): kapsam artık KAPALI BİÇİM (her
// satırda TEK backtick'li ad, `-` madde işaretiyle) gerektiriyor — önceki `` `a` ve `b` ``
// tek-satır-çoklu-ad biçimi artık GEÇERSİZ bir GUARD.ok üretirdi (tüm kapsam boş dönerdi). Bu
// yüzden her ad kendi madde satırını alıyor.
function writeGuardScope(names) {
  fs.mkdirSync(path.dirname(GUARD_OK), { recursive: true });
  const list = names.map((n) => '- `' + n + '`').join('\n');
  fs.writeFileSync(GUARD_OK, `## Kapsam\n${list}\n`);
}
// Y1 (docs/qa/g5-tur5-kapsam-ve-selftest-contract.md): "## Kapsam" bölüm sınırlı GUARD.ok
// senaryoları için ham içerik yazar (writeGuardScope'un aksine başlık YAPISINI test eder).
function writeGuardRaw(content) {
  fs.mkdirSync(path.dirname(GUARD_OK), { recursive: true });
  fs.writeFileSync(GUARD_OK, content);
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

  // --- G5 tur4 4-Ek2 (docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md): mklink es degeri ---
  // New-Item -ItemType Junction/SymbolicLink zaten yakalaniyordu (New-Item genel deseni), ama
  // AYNI sonucu ureten mklink (bayraksiz veya /J, /D, /H ile) yakalanmiyordu — iki esdeger
  // komuttan biri korumali digeri degildi.
  [`${ML} link target`, 2, '(mklink) bayraksiz (sembolik baglanti) — engellenmeli'],
  [`${ML} /J link target`, 2, '(mklink) /J (junction) — engellenmeli'],
  [`${ML} /D link target`, 2, '(mklink) /D (dizin sembolik baglantisi) — engellenmeli'],
  [`${ML} /H link target`, 2, '(mklink) /H (sabit baglanti) — engellenmeli'],
  [`${ML.toUpperCase()} /J link target`, 2, '(mklink) buyuk harf MKLINK — harf duyarsiz eslesme'],

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

// --- Y1 (docs/qa/g5-tur5-kapsam-ve-selftest-contract.md, tur2: g5-tur5-kapsam-siniri-tur2-
// contract.md): parseGuardScope YALNIZCA "## Kapsam" başlığının HEMEN ardından gelen, kapalı
// biçimli (`- \`ad.cjs\``, satır başına TEK ad) liste maddelerini kapsam sayar; bölüm dışında
// (ör. gerekçe metninde anılan) bir dosya adı kapsama GİRMEZ. Aşağıdaki fixture'lar tur 2'de
// düz-satır biçiminden (`` `ad.cjs` ``) madde-satırı biçimine (`` - `ad.cjs` ``) GÜNCELLENDİ —
// NEDEN: eski düz-satır biçimi artık kapalı-biçim kuralını ihlal eder (liste maddesi değil,
// tarama header'dan sonraki ilk satırda hemen durur) ve tüm kapsamı boş bırakırdı; davranışsal
// beklenti (kabul/red) fixture'larda DEĞİŞMEDİ, yalnızca üretilen GUARD.ok metninin biçimi
// güncel kurala uyacak şekilde değişti. (y1-b) gerçek CEO operasyonunda GERÇEKLEŞMİŞ bir
// sızıntının birebir regresyon testidir.

// (y1-a) "## Kapsam" bölümündeki dosya kabul edilir VE token bu tek dosyayla tüketilir.
rm(GUARD_OK); rm(GUARD_STATE);
writeGuardRaw('## Kapsam\n- `selftest-y1a.cjs`\n\n## Gerekce\nbu degisiklik gerekli.\n');
{
  const code = callGate('.claude/hooks/selftest-y1a.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1-a) "## Kapsam" bolumundeki dosya kabul edilir ve token tuketilir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1-b) Gerekçe (kapsam dışı) bölümünde "KAPSAM DIŞI" diye anılan bir dosya adı REDDEDİLİR.
writeGuardRaw('## Kapsam\n- `selftest-y1c.cjs`\n\n## Gerekce\nBu KAPSAM DISI birakildi: `selftest-y1d.cjs`\n');
{
  const code = callGate('.claude/hooks/selftest-y1d.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1-b) Gerekce bolumunde anilan (KAPSAM DISI) dosya reddedilir, token harcanmaz', code === 2 && untouched);
}
// (y1-c) Aynı GUARD.ok'ta, "## Kapsam" bölümündeki dosya HÂLÂ kabul edilir (komşu davranış
// bozulmadı) — token bu istekle tüketilir.
{
  const code = callGate('.claude/hooks/selftest-y1c.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1-c) ayni metinde "## Kapsam" bolumundeki dosya hala kabul edilir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1-d) "## Kapsam" başlığı hiç yoksa: fail-closed (hiçbir guarded yazmaya izin yok).
writeGuardRaw('Bu bir onaydir: `selftest-y1e.cjs` degisikligini onayliyorum.\n');
{
  const code = callGate('.claude/hooks/selftest-y1e.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(y1-d) "## Kapsam" basligi hic yoksa fail-closed (reddedilir)', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1-e) "## Kapsam" başlığı birden fazla kez geçiyorsa: belirsiz kapsam, fail-closed (ikisi de).
writeGuardRaw('## Kapsam\n- `selftest-y1f.cjs`\n\n## Kapsam\n- `selftest-y1g.cjs`\n');
{
  const code1 = callGate('.claude/hooks/selftest-y1f.cjs');
  const code2 = callGate('.claude/hooks/selftest-y1g.cjs');
  fail += reportScope('(y1-e) birden fazla "## Kapsam" basligi -> belirsiz, fail-closed (ikisi de reddedilir)', code1 === 2 && code2 === 2);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1-f) Başlık boşluksuz varyantla da bulunur: "##Kapsam".
writeGuardRaw('##Kapsam\n- `selftest-y1h.cjs`\n\n## Gerekce\nnot.\n');
{
  const code = callGate('.claude/hooks/selftest-y1h.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1-f) "##Kapsam" (bosluksuz varyant) da baslik olarak taninir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1-g) Başlık büyük harfle: "## KAPSAM".
writeGuardRaw('## KAPSAM\n- `selftest-y1i.cjs`\n');
{
  const code = callGate('.claude/hooks/selftest-y1i.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1-g) "## KAPSAM" (buyuk harf varyanti) da baslik olarak taninir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1-h) "## Kapsam" bölümü var ama hemen ardından liste gelmiyorsa (düzyazı ile başlıyorsa):
// fail-closed. Tur 2'de bu, YENİ "araya düzyazı girmişse" kuralının doğrudan testidir.
writeGuardRaw('## Kapsam\nbu bolumde hic dosya adi yok.\n\n## Gerekce\n`selftest-y1j.cjs` burada geciyor ama kapsam disi.\n');
{
  const code = callGate('.claude/hooks/selftest-y1j.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(y1-h) "## Kapsam" hemen ardindan liste yok (duzyazi ile basliyor) -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// --- Y1 tur 2 (docs/qa/g5-tur5-kapsam-siniri-tur2-contract.md): QA'nin uc sizdiran sondasi +
// gercekci CEO belgesi + yeni negatif kontroller. Tur 1'in "blok NEREDE BITER" tanimi, basliga
// BENZEYEN her seye (basliksiz kuyruk duzyazi, "# Gerekce" h1, "**Gerekce**" kalin sozde-
// baslik) yeniliyordu. Tur 2 "hangi satirlar SAYILIR" sorusuna gecti: yalnizca "## Kapsam"
// basligindan hemen sonraki, kapali bicimli liste maddeleri kapsam sayilir; liste maddesi
// OLMAYAN ilk bos-olmayan satir taramayi bitirir (icerigi ONEMSIZ).

// (y1t2-a) G2 sondasi: baslik + madde + bos satir + BASLIKSIZ KUYRUK DUZYAZI. Kuyrukta anilan
// ad reddedilir, kapsamdaki asil ad hala kabul edilir ve tuketilir.
writeGuardRaw('## Kapsam\n- `block-dangerous.cjs`\n\nNot: `evil-payload.cjs` bu listeye DAHIL DEGILDIR.\n');
{
  const code = callGate('.claude/hooks/evil-payload.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-a) basliksiz kuyruk duzyazidaki ad reddedilir, token harcanmaz (QA G2 sondasi)', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-a2) ayni metinde kapsamdaki asil ad hala kabul edilir ve tuketilir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-b) G3 sondasi: "# Gerekce" (h1) sonrasi ad reddedilir (h1, "##" ile eslesmiyor ama
// liste maddesi de degil -> taramayi zaten bitirir).
writeGuardRaw('## Kapsam\n- `block-dangerous.cjs`\n\n# Gerekce\nBu degisiklik gerekli: `evil-payload.cjs`\n');
{
  const code = callGate('.claude/hooks/evil-payload.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-b) "# Gerekce" (h1) sonrasindaki ad reddedilir (QA G3 sondasi)', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-b2) ayni metinde kapsamdaki asil ad hala kabul edilir ve tuketilir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-c) G4 sondasi: "**Gerekce**" kalin sozde-baslik sonrasi ad reddedilir.
writeGuardRaw('## Kapsam\n- `block-dangerous.cjs`\n\n**Gerekce**\nBaska bir ad: `evil-payload.cjs`\n');
{
  const code = callGate('.claude/hooks/evil-payload.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-c) "**Gerekce**" kalin sozde-baslik sonrasindaki ad reddedilir (QA G4 sondasi)', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-c2) ayni metinde kapsamdaki asil ad hala kabul edilir ve tuketilir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-d) Gercekci CEO belgesi (QA G5-sozlesme-kararlari-2026-09-10-tur2.md 2.3, birebir):
// iki dosya acikca "KAPSAM DISI"/"DOKUNULMAYACAK" diye reddediliyor, sadece bir dosya kapsamda.
writeGuardRaw(
  '# GUARD onayi - G5 tur 6 hook bakimi\n\nTarih: 2026-09-10\nOnaylayan: Kullanici (Veron) - AskUserQuestion\n\n' +
  '## Kapsam\n\n- `gate-check.cjs`\n\n' +
  'Not: bu turda `_selftest.cjs` dosyasina DOKUNULMAYACAK, kapsam disidir.\n' +
  'Ayrica `block-dangerous.cjs` da bu onayin KAPSAMI DISINDADIR.\n'
);
{
  const code = callGate('.claude/hooks/_selftest.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-d) gercekci CEO belgesi: "DOKUNULMAYACAK" denen dosya reddedilir', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-d2) gercekci CEO belgesi: "KAPSAMI DISINDADIR" denen dosya reddedilir', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/gate-check.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-d3) gercekci CEO belgesi: kapsamdaki tek dosya kabul edilir ve tuketilir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-e) Regresyon: "### Gerekce" (h3) sonrasi ad hala reddedilir (tur 1'de calisiyordu,
// yeni mekanizmayla da calistigini kilitle).
writeGuardRaw('## Kapsam\n- `block-dangerous.cjs`\n\n### Gerekce\nBaska bir ad: `evil-payload.cjs`\n');
{
  const code = callGate('.claude/hooks/evil-payload.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-e) "### Gerekce" (h3) sonrasindaki ad reddedilir (regresyon)', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-e2) ayni metinde kapsamdaki asil ad hala kabul edilir ve tuketilir', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-f) Negatif kontrol (asiri engelleme yok): girintili/ic ice madde satiri kabul edilir.
writeGuardRaw('## Kapsam\n  - `block-dangerous.cjs`\n');
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const consumed = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-f) girintili/ic ice liste maddesi de kabul edilir (asiri engelleme yok)', code === 0 && consumed);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-g) Negatif kontrol: liste bloğu icinde TEK bir bos satir taramayi bitirmez, sonraki
// madde de kabul edilir (bos satirlar seffaftir).
writeGuardRaw('## Kapsam\n- `selftest-y1t2g1.cjs`\n\n- `selftest-y1t2g2.cjs`\n');
{
  const code1 = callGate('.claude/hooks/selftest-y1t2g1.cjs');
  const remainsAfterFirst = fs.existsSync(GUARD_OK);
  const code2 = callGate('.claude/hooks/selftest-y1t2g2.cjs');
  const consumedAfterSecond = !fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope(
    '(y1t2-g) liste maddeleri arasindaki bos satir taramayi bitirmez, ikinci madde de kabul edilir',
    code1 === 0 && remainsAfterFirst && code2 === 0 && consumedAfterSecond,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-h) Yeni sizinti adayi: bir DISLAMA NOTU madde isaretiyle yazilmissa ("- Not: ...
// kapsam disi: `x.cjs`"), bu satir bicimi bozar (tek backtick'li ad degil) -> TUM kapsam
// gecersiz sayilir; daha once kabul edilecek GECERLI bir ad bile artik reddedilir.
writeGuardRaw('## Kapsam\n- `block-dangerous.cjs`\n- Not: `evil-payload.cjs` kapsam disi birakildi\n');
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-h) madde-bicimli dislama notu TUM kapsami gecersiz kilar (onceki gecerli ad da reddedilir)', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/evil-payload.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-h2) ayni bozuk belgede kapsam-disi ad da (zaten) reddedilir', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (y1t2-i) Cok-ad-tek-satir artik desteklenmiyor: satir kapali bicimi (TEK backtick'li ad)
// ihlal ediyor -> TUM kapsam gecersiz.
writeGuardRaw('## Kapsam\n- `selftest-y1t2i1.cjs` ve `selftest-y1t2i2.cjs`\n');
{
  const code1 = callGate('.claude/hooks/selftest-y1t2i1.cjs');
  const code2 = callGate('.claude/hooks/selftest-y1t2i2.cjs');
  const untouched = fs.existsSync(GUARD_OK) && !fs.existsSync(GUARD_STATE);
  fail += reportScope('(y1t2-i) tek satirda coklu ad artik desteklenmiyor -> tum kapsam gecersiz', code1 === 2 && code2 === 2 && untouched);
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

// --- G5 tur4 (docs/qa/g5-tur4-yol-kanoniklestirme-contract.md): yol kanoniklestirme
// regresyon testleri. resolveCanonicalRel() eklenmeden ÖNCE: (K-A) Windows'un \\?\ uzun-yol
// öneki ve (K-B) bir NTFS junction/symlink'in ARKASI, salt lexical path.relative()
// karşılaştırmasını atlatıp docs/approvals'a SESSİZCE (ask JSON'suz, exit 0) yazmaya izin
// veriyordu. Aşağıdaki testler GERÇEK (mock'lanmamış) gate-check.cjs'e karşı çalışır; K-B bu
// makinede GERÇEK bir NTFS junction oluşturup kaldırır (yönetici hakkı gerekmez — junction
// symlink'ten farklı olarak SeCreateSymbolicLinkPrivilege istemez); fail-closed ise ayrı bir
// child process'te fs.realpathSync.native'i preload ile fırlatacak şekilde monkey-patch ederek
// GERÇEK dosyaya hiç dokunmadan test edilir. (Y3 sonrası: bu blokta anılan "docs/approvals"
// artık SANDBOX'ın kendi dizinidir, gerçek proje dizini DEĞİLDİR.)
const REAL_APPROVALS_ABS = path.resolve('docs', 'approvals');
function kaProbePath() {
  return '\\\\?\\' + path.join(REAL_APPROVALS_ABS, 'SELFTEST-KA-PROBE.ok');
}
{
  const { code, stdout } = callGateCapture(kaProbePath());
  const ok = code === 0 && isAskJson(stdout, 'GÜVENLİK KAPISINI');
  fail += reportScope(
    '(K-A) \\\\?\\ uzun yol öneki ile docs/approvals hedefi hâlâ ask üretir (regresyon: önceden sessiz exit=0)',
    ok,
  );
}
{
  // Regresyon/yanlış pozitif: aynı \\?\ öneki, docs/approvals DIŞINDAKI serbest bir yol için
  // hâlâ sessizce (ask'sız) izin vermeli — normalize etmek aşırı-engelleme yaratmamalı.
  const freeLongPrefix = '\\\\?\\' + path.resolve('assets', 'SELFTEST-KA-FREE-PROBE.ok');
  const { code, stdout } = callGateCapture(freeLongPrefix);
  const ok = code === 0 && stdout === '';
  fail += reportScope(
    '(K-A) aynı \\\\?\\ öneki, docs/approvals DIŞI serbest yol için hâlâ sessizce izin verir (aşırı engelleme yok)',
    ok,
  );
}

const KB_JUNCTION = path.resolve('assets', '.selftest-kb-junction');
function cleanupKbJunction() {
  try { fs.rmdirSync(KB_JUNCTION); } catch (_) {}
}
cleanupKbJunction(); // önceki yarım kalmış bir koşudan artık olabilir
let kbSetupError = null;
try { fs.symlinkSync(REAL_APPROVALS_ABS, KB_JUNCTION, 'junction'); } catch (e) { kbSetupError = e; }
if (kbSetupError) {
  fail += reportScope(
    `(K-B) junction oluşturulamadı (${kbSetupError.message}) — bu makinede junction desteği kontrol edilmeli`,
    false,
  );
} else {
  const probePath = path.join('assets', '.selftest-kb-junction', 'SELFTEST-KB-PROBE.ok');
  const { code, stdout } = callGateCapture(probePath);
  const ok = code === 0 && isAskJson(stdout, 'GÜVENLİK KAPISINI');
  fail += reportScope(
    '(K-B) assets/** altındaki bir junction docs/approvals ARKASINA çıkınca hâlâ ask üretir (regresyon: önceden assets serbest sayılıp sessiz exit=0)',
    ok,
  );
}
cleanupKbJunction();
{
  const removed = !fs.existsSync(KB_JUNCTION);
  const targetIntact = fs.existsSync(path.join(REAL_APPROVALS_ABS, 'G2.ok'));
  fail += reportScope('(K-B) test junction kaldırıldı ve hedef (docs/approvals) bozulmadı', removed && targetIntact);
}

function failClosedProbe() {
  const preloadPath = path.join(os.tmpdir(), `selftest-realpath-throw-${process.pid}-${Date.now()}.cjs`);
  fs.writeFileSync(preloadPath, [
    "const fs = require('fs');",
    'fs.realpathSync.native = function () {',
    "  const e = new Error('ELOOP: simulated (selftest fail-closed probe)');",
    "  e.code = 'ELOOP';",
    '  throw e;',
    '};',
  ].join('\n'));
  let code = 0;
  let stderr = '';
  try {
    execFileSync('node', ['-r', preloadPath, '.claude/hooks/gate-check.cjs'], {
      input: JSON.stringify({ tool_input: { file_path: HOOK_FILE } }),
      stdio: ['pipe', 'ignore', 'pipe'],
    });
  } catch (e) {
    code = e.status;
    stderr = e.stderr ? e.stderr.toString('utf8') : '';
  }
  rm(preloadPath);
  return { code, stderr };
}
{
  const { code, stderr } = failClosedProbe();
  const ok = code === 2 && /realpath/i.test(stderr);
  fail += reportScope('(fail-closed) fs.realpathSync.native fırlatınca sert engel (exit=2, sessiz izin DEĞİL)', ok);
}

// Test artıklarını bırakma (Y3 sonrası: bu zaten SANDBOX içinde, `process.on('exit', ...)`
// ayrıca tüm sandbox dizinini siliyor — bu satırlar ek/artık bir güvenlik önlemidir).
rm(PUSH_OK);
rm(DANGER_OK);
rm(GUARD_OK);
rm(GUARD_STATE);
console.log(fail === 0 ? '\nTUM TESTLER GECTI' : `\n${fail} TEST BASARISIZ`);
process.exit(fail === 0 ? 0 : 1);
