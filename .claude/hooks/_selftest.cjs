// Regresyon testi — block-dangerous.cjs VE gate-check.cjs için.
// Çalıştır: node .claude/hooks/_selftest.cjs
// Test dizeleri parça parça kurulur ki bu dosyanın kendisi hook'a takılmasın.
//
// TUR 4 (docs/qa/g5-guard-json-contract.md): GUARD.ok markdown'dan JSON'a taşındı. Bu dosyadaki
// eski markdown-biçimi vakaları (y1-*, y1t2-*, sentetik (c)/(e)/(f)) JSON karşılıklarına
// çevrildi — her çeviri NEDEN çevrildiğini kendi yorumunda açıklıyor. Tüketim modeli de değişti:
// token artık kapsamdaki bir dosya yazıldığında TÜKENMİYOR, yalnızca zaman penceresi dolunca
// SİLİNİYOR — bu, birçok eski "GUARD.ok tuketilmeliydi" beklentisini "GUARD.ok
// tuketilmemeliydi" olarak tersine çeviriyor (kasıtlı, bkz. sözleşme §2.2).
//
// TUR 5 (aynı sözleşme, M1+M2 kapanışı — QA'nın G5-sozlesme-kararlari-2026-09-10-tur4.md
// bulguları): M1 — `D-WHITELIST-*` vakaları eklendi, çünkü mevcut D-TRAVERSAL/D-ABS/D-UNC/
// D-LONGPREFIX/D-BACKSLASH/D-UNI vakalarının hiçbiri beyaz listeyi (normalizeScopeEntry) ÖLÇMÜYORDU
// (§1.5). M2 — `D-SCANNER-DEPTH-*` vakaları eklendi, çünkü yinelenen-anahtar tarayıcısının kendi
// çağrı-yığını taşmasını yutan catch bloğu MAX_GUARD_BYTES'e gizlice bağımlıydı (§1.3).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Y3 düzeltmesi (docs/qa/g5-tur5-kapsam-ve-selftest-contract.md): bu betik ARTIK GERÇEK
// docs/approvals/ yollarına hiç dokunmuyor. Aşağıdaki blok, betiğin geri kalanının çalışacağı
// izole bir sandbox dizinine `process.chdir()` yapar: gerçek `.claude/hooks/*.cjs` dosyaları
// (bu dosyanın kendisi HARİÇ) BİREBİR, değiştirilmeden sandbox'a kopyalanır; testler o
// kopyalar üzerinden ve sandbox'ın KENDİ `docs/approvals/` dizini üzerinden çalışır.
//
// Emniyet kemeri (ikinci, bağımsız katman): sandbox'a geçmeden ÖNCE, ÇAĞIRANIN GERÇEK
// cwd'sindeki docs/approvals/ altında PUSH.ok/DANGER.ok/GUARD.ok/.guard-state.json var mı
// kontrol edilir. Varsa betik hiçbir şeye dokunmadan reddeder (exit 3).
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
const UNLINK = 'un' + 'link';
const FLAG_S = '/' + 's';
const FLAG_Q = '/' + 'q';
const FLAG_F = '/' + 'f';

const PUSH_OK = path.join('docs', 'approvals', 'PUSH.ok');
const DANGER_OK = path.join('docs', 'approvals', 'DANGER.ok');
const GUARD_OK = path.join('docs', 'approvals', 'GUARD.ok');
const GUARD_STATE = path.join('docs', 'approvals', '.guard-state.json');

function write(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'selftest\n'); }
function rm(p) { try { fs.unlinkSync(p); } catch (_) {} }
function existsFile(p) { return fs.existsSync(p); }

// --- GUARD.ok JSON yardımcıları (tur 4) ---------------------------------------------------
// docs/qa/g5-guard-json-contract.md: GUARD.ok artık serbest markdown değil, bir JSON belgesidir.
// Kapsam YALNIZCA "scope" alanından okunur (dolu bir dize dizisi, her eleman tam olarak
// ".claude/hooks/<ad>.cjs" ya da ".claude/settings.json" biçiminde); "created_at" (ISO 8601) +
// "valid_minutes" (opsiyonel, varsayılan 30, üst sınır 120) bir zaman penceresi tanımlar. Süre
// dolunca dosya SİLİNİR; süre dolmadığı sürece kapsamdaki bir dosya istenildiği kadar
// yazılabilir (token bir YAZMADA tükenmez — bu, eski "kapsam tamamen dolaşılınca tüketilir"
// modelinin YERİNE geçen kasıtlı bir tasarım değişikliğidir).
function nowIso(offsetMs) { return new Date(Date.now() + (offsetMs || 0)).toISOString(); }
function toScopeEntry(n) { return n === '.claude/settings.json' ? n : ('.claude/hooks/' + n); }
// writeGuardScope(names, opts?) — kolaylık sarmalayıcı: bare hook adlarını (ör.
// 'block-dangerous.cjs') ya da '.claude/settings.json'ı tam kapsam yoluna çevirip geçerli bir
// GUARD.ok JSON'u üretir. opts: { createdOffsetMs, validMinutes, reason }.
function writeGuardScope(names, opts) {
  opts = opts || {};
  const doc = { scope: names.map(toScopeEntry), created_at: nowIso(opts.createdOffsetMs) };
  if (opts.validMinutes !== undefined) doc.valid_minutes = opts.validMinutes;
  if (opts.reason !== undefined) doc.reason = opts.reason;
  writeGuardRaw(JSON.stringify(doc));
}
// writeGuardRaw(content) — HAM içerik yazar (dize ya da Buffer): bozuk JSON, saldırı vektörleri
// ve elle kurulmuş belgeler için. content bir Buffer da olabilir (ör. ham NUL bayt testleri).
function writeGuardRaw(content) {
  fs.mkdirSync(path.dirname(GUARD_OK), { recursive: true });
  fs.writeFileSync(GUARD_OK, content);
}

// --- block-dangerous.cjs vakaları -------------------------------------------------------
// [komut, beklenen çıkış kodu, açıklama, hazırlık?, sonrası kontrol?]
// B-6/Y2/Y4 KAPANIŞI (docs/qa/hook-borclari-contract.md): block-dangerous.cjs bu turda
// SEGMENTASYON mekanizmasıyla değişti (bkz dosya başı yorumu). Aşağıdaki vakaların BÜYÜK
// ÇOĞUNLUĞU DEĞİŞMEDİ (segmentasyon, AYNI segment içindeki fiil+hedef kombinasyonlarını asla
// etkilemez) — yalnızca dosya sonundaki "B-6/Y4 SEGMENTASYON" ve "Y4 HOOKS/SETTINGS" blokları
// YENİ.
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

  ['npm pub' + 'lish', 2, 'npm publish (G6 onayi yok)'],
  ['vercel --prod', 2, 'vercel --prod (G6 onayi yok)'],
  [
    'npm pub' + 'lish', 2, 'npm publish PUSH.ok ile de engelli (push onayi yayin onayi degildir)',
    () => write(PUSH_OK),
    () => { const kept = fs.existsSync(PUSH_OK); rm(PUSH_OK); return kept ? null : 'PUSH.ok tuketilmemeliydi'; },
  ],

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

  [`${DEL} ${FLAG_S} ${FLAG_Q} build`, 2, 'del /s /q (regresyon, onceden de engelliydi)'],
  [`${DEL} ${FLAG_F} ${FLAG_S} ${FLAG_Q} build`, 2, 'del /f /s /q — bayrak sirasi degisince kaciyordu, artik engelli'],
  [`${DEL} ${FLAG_Q} ${FLAG_S} build`, 2, 'del /q /s — ters sira'],
  [`${RD} ${FLAG_S} ${FLAG_Q} build`, 2, 'rd /s /q — hic taninmiyordu, artik engelli'],
  [`${RMDIR} ${FLAG_S} ${FLAG_Q} build`, 2, 'rmdir /s /q — hic taninmiyordu, artik engelli'],
  [`${ERASE} ${FLAG_S} ${FLAG_Q} build`, 2, 'erase /s /q (del esdegeri)'],
  [`${RI} -r build`, 2, '(g) PowerShell ri -r (kisaltma zinciri, 1/7)'],
  [`${RI} -Recurse build`, 2, '(g) PowerShell ri -Recurse (kisaltma zinciri, tam hali)'],

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

  [`${ML} link target`, 2, '(mklink) bayraksiz (sembolik baglanti) — engellenmeli'],
  [`${ML} /J link target`, 2, '(mklink) /J (junction) — engellenmeli'],
  [`${ML} /D link target`, 2, '(mklink) /D (dizin sembolik baglantisi) — engellenmeli'],
  [`${ML} /H link target`, 2, '(mklink) /H (sabit baglanti) — engellenmeli'],
  [`${ML.toUpperCase()} /J link target`, 2, '(mklink) buyuk harf MKLINK — harf duyarsiz eslesme'],

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
  [`cat docs/approvals/G5.ok 2>/dev/null`, 0, 'yanlis pozitif olmamali: docs/approvals okuma + ILGISIZ stderr yonlendirmesi'],
  [`ls -la docs/approvals/ 2>&1`, 0, 'yanlis pozitif olmamali: ls + 2>&1 (ayni sinif)'],
  [`type docs\\approvals\\GUARD.ok`, 0, 'yanlis pozitif olmamali: Windows type (yonlendirmesiz okuma)'],

  // --- B-6/Y2 SEGMENTASYON: bugün kilitlenen dört gerçek komut sınıfının birebir karşılığı ---
  // (docs/blockers.md B-6/Y2, docs/qa/hook-borclari-contract.md). Her biri: ÖNCE (mutasyonsuz,
  // segmentasyon-öncesi blob mantığıyla) YANLIŞ POZİTİF üretirdi (iki bağımsız segmentteki
  // ilgisiz sinyaller birleşirdi); ARTIK (segmentasyonla) geçer. Her birinin bir İKİZ POZİTİF
  // KONTROLÜ var: AYNI aile, ama yazma fiili GERÇEKTEN korumalı yola uygulanıyor -> hâlâ engelli.

  // (1) Kopyalama + zincirin sonundaki ilgisiz OKUMA (docs/blockers.md Y2 örnek a).
  [`cp scratchpad/a.txt scratchpad/b.txt && cat docs/approvals/G5.ok`, 0, '(SEG-1) kopyalama + ilgisiz okuma zinciri -> artik gecer (segmentasyon)'],
  [`cp scratchpad/a.txt docs/approvals/G5.ok`, 2, '(SEG-1-TWIN) ayni aile, TEK segmentte gercek yazma -> hala engelli'],

  // (2) Salt-okunur sha256sum + zincirdeki ilgisiz yazma (docs/blockers.md B-6 "sonuncusunda
  // salt-okunur bir listeleme cagrisi").
  [`sha256sum docs/approvals/G2.ok && mv scratchpad/x.txt scratchpad/y.txt`, 0, '(SEG-2) salt-okunur sha256sum + ilgisiz mv -> artik gecer'],
  [`sha256sum docs/approvals/G2.ok && mv docs/approvals/G2.ok docs/approvals/G2.ok.bak`, 2, '(SEG-2-TWIN) ayni aile, ikinci segmentte GERCEK approvals yazma -> hala engelli'],

  // (3) Scratchpad'de sed -i + zincirdeki commit, commit mesaji korunan yolu ANIYOR ama
  // YAZMIYOR (docs/blockers.md Y2 ornek b, "commit mesaji ... fiilin adini icerdigi icin").
  [`sed -i "s/a/b/" scratchpad/notes.txt && git commit -am "fix: docs/approvals GUARD.ok scope wording"`, 0, '(SEG-3) ilgisiz sed -i + docs/approvals ANAN commit mesaji -> artik gecer'],
  [`sed -i "s/a/b/" docs/approvals/G2.ok`, 2, '(SEG-3-TWIN) ayni aile, TEK segmentte gercek sed -i yazma -> hala engelli'],

  // (4) Kendini anlatan not (printf, docs/approvals'i YALNIZCA yol olarak anar, fiil kelimesi
  // TASIMAZ) + zincirdeki ilgisiz cp (docs/blockers.md B-6 "o olayi anlatan duzeltme metninin
  // kendisi"). NOT: notun kendisi bilerek bir yazma fiili (cp/mv/tee/...) İÇERMEZ — aksi hâlde
  // fiil+yol AYNI segmentte (printf argümanı) olur ve segmentasyon (doğru şekilde) bunu YİNE
  // engeller (bu, aşağıdaki RETREAT-HEREDOC vakasının gösterdiği aynı, düzeltilemeyen sınıftır).
  [`printf "not: bir onceki incelemede docs/approvals referansi vardi\\n" >> scratchpad/notes.txt && cp scratchpad/a.txt scratchpad/b.txt`, 0, '(SEG-4) kendini anlatan not (fiil kelimesi yok) + ilgisiz cp -> artik gecer'],
  [`printf "x" >> docs/approvals/G2.ok`, 2, '(SEG-4-TWIN) ayni aile, yonlendirme hedefi GERCEKTEN docs/approvals -> hala engelli'],

  // Bonus (ayni kok neden, gitForce icin): `[^\\n]*` zincir sinirini tanimadigi icin
  // "git log && npm run build --force" gibi bir zincirde ilgisiz bir --force bayragi git'e
  // ait sanilip yanlislikla engelleniyordu.
  [`git log --oneline && npm run build --force`, 0, '(SEG-5 bonus) ilgisiz --force bayragi baska segmentte -> artik gecer (gitForce zincir sinirini asmiyor)'],
  [`git commit --force -m x`, 2, '(SEG-5-TWIN bonus) ayni aile, --force GERCEKTEN git komutuyla AYNI segmentte -> hala engelli'],

  // --- Segmentasyon GERİ ÇEKİLMESİ: tırnak/heredoc/$() içeren komutlar bugünkü (kısıtlayıcı)
  // blob davranışına düşer — kasıtlı, docs/qa/hook-borclari-contract.md'de kabul edilmiş sınır.
  [
    `cat >> scratchpad/notes.txt <<'EOF'\nnot: cp ve docs/approvals ayni satirda\nEOF`, 2,
    '(RETREAT-HEREDOC) heredoc govdesi mention+fiil tasiyor -> segmentasyona GIRILMEZ, blob gibi engellenir (kabul edilmis asiri engelleme)',
  ],
  [
    `echo $(cat docs/approvals/G2.ok) && cp scratchpad/a.txt scratchpad/b.txt`, 2,
    '(RETREAT-SUBSHELL) $(...) komut ikamesi -> segmentasyona GIRILMEZ, blob gibi engellenir (kabul edilmis asiri engelleme)',
  ],
  [
    `cp scratchpad/a.txt scratchpad/b.txt && git commit -m "note with && inside and docs/approvals mention"`, 0,
    '(QUOTE-AWARE) tirnak icindeki sahte "&&" gercek ayirac SAYILMAZ, iki GERCEK segment dogru bulunur -> gecer',
  ],

  // --- Y4 KAPANIŞI: .claude/hooks/** ve .claude/settings.json artik Katman B'de de korunuyor.
  // Okuma (cat/ls/git add/git commit/git diff) HICBIR ZAMAN engellenmez; yazma/silme engellenir.
  [`cp scratchpad/evil.cjs .claude/hooks/gate-check.cjs`, 2, '(Y4-1) kabuktan hook dosyasina cp ile yazma -> engellenir'],
  [`mv scratchpad/evil.cjs .claude/settings.json`, 2, '(Y4-2) kabuktan settings.json uzerine mv ile yazma -> engellenir'],
  [`rd /s /q .claude\\hooks`, 2, '(Y4-3) kabuktan hooks dizinini silme (rd /s /q) -> engellenir (danger deseni de ayrica yakalar)'],
  [`tee .claude/hooks/gate-check.cjs`, 2, '(Y4-4) tee ile hook dosyasina yazma -> engellenir'],
  [`node -e "require('fs').writeFileSync('.claude/hooks/gate-check.cjs','x')"`, 2, '(Y4-5) node -e ile hook dosyasina yazma -> engellenir'],
  [`cat .claude/hooks/gate-check.cjs`, 0, '(Y4-READ-1) okuma (cat) engellenmemeli'],
  [`ls .claude/hooks`, 0, '(Y4-READ-2) okuma (ls) engellenmemeli'],
  [`git add .claude/hooks/gate-check.cjs`, 0, '(Y4-READ-3) git add engellenmemeli'],
  [`git commit -m "update hook docs reference"`, 0, '(Y4-READ-4) git commit (hooks disi mesaj) engellenmemeli'],
  [`git diff .claude/hooks/gate-check.cjs`, 0, '(Y4-READ-5) git diff engellenmemeli'],
  [
    `git add .claude/hooks/gate-check.cjs && git commit -F scratchpad/msg.txt`, 0,
    '(Y4-READ-6) zincirlenmis git add + commit -F, ikisi de okuma/mesaj-dosyasi -> engellenmemeli',
  ],
  [`cp scratchpad/a.txt scratchpad/b.txt && cat .claude/hooks/gate-check.cjs`, 0, '(Y4-SEG-1) ilgisiz cp + hook okumasi zinciri -> engellenmemeli (segmentasyon)'],

  // --- RM KAPANIŞI (docs/qa/hook-borclari-contract.md §8-ek, CEO'nun probe-segment.mjs E1/E2
  // sondasi): bayraksiz `rm`/`unlink` artik del/erase/rd/rmdir/ri ile AYNI muameleyi goruyor —
  // hem docs/approvals/** hem .claude/hooks/**+.claude/settings.json icin.
  [`${RM} .claude/hooks/gate-check.cjs`, 2, '(RM-1) bayraksiz rm ile hook dosyasi silme -> engellenir (Y4 ailesi)'],
  [`${RM} docs/approvals/GUARD.ok`, 2, '(RM-2) bayraksiz rm ile onay dosyasi silme -> engellenir'],
  [`${RM} .claude/settings.json`, 2, '(RM-3) bayraksiz rm ile settings.json silme -> engellenir'],
  [`${G} log --oneline && ${RM} docs/approvals/GUARD.ok`, 2, '(RM-4) segment icinde rm ile korumali yol silme -> engellenir (segmentasyon atlatma olmamali)'],
  [`${RM} build/tmp.txt`, 0, '(RM-5) rm ile korumasiz yol -> yanlis pozitif olmamali'],
  [`${RM} build/tmp.txt && ls docs/approvals`, 0, '(RM-6) korumasiz rm + ilgisiz okuma zinciri -> gecmeli (segmentasyon, fiil+hedef ayri segmentte)'],
  [`npm run confirm-something`, 0, '(RM-7) alt dize yanlis pozitifi: "confirm-something" icindeki "rm" kelime siniri gecmiyor -> gecmeli'],
  [`${UNLINK} .claude/hooks/gate-check.cjs`, 2, '(UNLINK-1) bayraksiz unlink ile hook dosyasi silme -> engellenir'],
  [`${UNLINK} docs/approvals/GUARD.ok`, 2, '(UNLINK-2) bayraksiz unlink ile onay dosyasi silme -> engellenir'],
  [`${UNLINK} build/tmp.txt`, 0, '(UNLINK-3) unlink ile korumasiz yol -> yanlis pozitif olmamali'],
  [`${G} rm docs/approvals/GUARD.ok`, 2, '(GITRM-1) git rm ile onay dosyasi silme -> engellenir (\\brm\\b "git" onekinden bagimsiz eslesir, ek desen gerekmedi)'],
  [`${G} rm build/tmp.txt`, 0, '(GITRM-2) git rm ile korumasiz yol -> yanlis pozitif olmamali'],
];

// --- gate-check.cjs vakaları (K1) --------------------------------------------------------
const HOOK_FILE = path.join('.claude', 'hooks', 'block-dangerous.cjs');
const SETTINGS_FILE = path.join('.claude', 'settings.json');
const SRC_FILE = path.join('src', 'server', 'index.ts');
const AGENT_FILE = path.join('.claude', 'agents', 'selftest-fixture.md');
const AGENT_MEMORY_FILE = path.join('.claude', 'agent-memory', 'selftest-fixture.md');

const gateCases = [
  [HOOK_FILE, 2, 'K1: hook dosyasina yazma GUARD.ok yokken engelli'],
  [SETTINGS_FILE, 2, 'K1: settings.json yazma GUARD.ok yokken engelli'],
  [
    // TUR 4 degisikligi: artik "gecer VE TUKETILMEZ" (eski davranis "tuketilirdi" idi).
    HOOK_FILE, 0, 'K1: hook dosyasina yazma GUARD.ok ile (JSON kapsam) gecer VE TUKETILMEZ (yeni zaman-pencereli model)',
    () => writeGuardScope(['block-dangerous.cjs']),
    () => { const kept = fs.existsSync(GUARD_OK); rm(GUARD_OK); rm(GUARD_STATE); return kept ? null : 'GUARD.ok zaman penceresi icinde tuketilmemeliydi (yeni model)'; },
  ],
  [
    SETTINGS_FILE, 0, 'K1: settings.json yazma GUARD.ok ile (JSON kapsam) gecer VE TUKETILMEZ',
    () => writeGuardScope(['.claude/settings.json']),
    () => { const kept = fs.existsSync(GUARD_OK); rm(GUARD_OK); rm(GUARD_STATE); return kept ? null : 'GUARD.ok tuketilmemeliydi'; },
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
    SRC_FILE, 0, 'regresyon: src/** (G2.ok mevcut) serbest, GUARD.ok ile ilgisiz ve onu tuketmez',
    () => write(GUARD_OK),
    () => { const kept = fs.existsSync(GUARD_OK); rm(GUARD_OK); return kept ? null : 'src/** GUARD.ok tuketmemeliydi (korumali degil)'; },
  ],

  [
    '.CLAUDE/HOOKS/block-dangerous.cjs', 2, '(a) tamamen buyuk harfli hook yolu GUARD.ok yokken engellenir',
    () => { rm(GUARD_OK); rm(GUARD_STATE); },
  ],
  [
    '.claude/Hooks/block-dangerous.cjs', 2, '(b) karisik harfli hook yolu GUARD.ok yokken engellenir',
    () => { rm(GUARD_OK); rm(GUARD_STATE); },
  ],

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

// --- GUARD.ok JSON kapsam mekanizması sentetik testleri ------------------------------------
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

// (D-CASE-VARIANT, eski (c)): tek dosyalık kapsam, harf varyantıyla istek de geçer AMA
// TUKETILMEZ (tur 4: eski "tuketilir" beklentisi tersine cevrildi).
rm(GUARD_OK); rm(GUARD_STATE);
writeGuardScope(['selftest-c.cjs']);
{
  const code = callGate('.CLAUDE/Hooks/Selftest-C.CJS');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-CASE-VARIANT) harf varyantiyla istek gecer, token TUKETILMEZ (yeni model)', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-OUT-OF-SCOPE, eski (e)): kapsam dışı yol, geçerli GUARD.ok varken bile reddedilir; token
// harcanmaz (davranış DEĞİŞMEDİ, yalnızca JSON biçiminde kuruldu).
writeGuardScope(['selftest-e.cjs']);
{
  const code = callGate('.claude/hooks/selftest-e-disinda.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-OUT-OF-SCOPE) kapsam disi yol, gecerli GUARD.ok varken bile reddedilir; token harcanmaz', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-MULTI-WRITE, eski (f) + y1t2-g): iki dosyalık kapsam — HER İKİSİNE de ayrı ayrı
// yazılabiliyor VE token HİÇBİRİNDE tükenmiyor (tur 4'ün ana davranış değişikliğinin testi).
writeGuardScope(['selftest-f1.cjs', 'selftest-f2.cjs']);
{
  const code1 = callGate('.claude/hooks/selftest-f1.cjs');
  const remainsAfterFirst = fs.existsSync(GUARD_OK);
  const code2 = callGate('.claude/hooks/selftest-f2.cjs');
  const remainsAfterSecond = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-MULTI-WRITE) iki dosyali kapsam: her iki dosyaya da yazilabilir, token HICBIRINDE tukenmez',
    code1 === 0 && remainsAfterFirst && code2 === 0 && remainsAfterSecond,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-REGRESSION-MULTI-WRITE): bugunku kusurun regresyon testi — AYNI dosyaya pencere icinde
// IKI kez yazma: ikisi de kabul, token her ikisinde de KALIR (eski modelde ikinci yazma yeni
// bir kullanici onayi gerektirirdi).
writeGuardScope(['selftest-regr.cjs']);
{
  const code1 = callGate('.claude/hooks/selftest-regr.cjs');
  const remainsAfterFirst = fs.existsSync(GUARD_OK);
  const code2 = callGate('.claude/hooks/selftest-regr.cjs');
  const remainsAfterSecond = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(T-REGRESSION-MULTI-WRITE) ayni dosyaya pencere icinde iki yazma: ikisi de kabul, token tukenmez (kusur regresyonu)',
    code1 === 0 && remainsAfterFirst && code2 === 0 && remainsAfterSecond,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-FIELD-ISOLATION, eski y1-b/y1-c): "reason" alaninda anilan bir ad kapsama GIRMEZ; "scope"
// alanindaki asil ad hala kabul edilir. Ceviri nedeni: markdown'daki "bolum" kavrami yerini
// JSON'da tek bir "scope" ALANINA birakti — reason artik hicbir zaman taranmiyor.
writeGuardScope(['selftest-y1c.cjs'], { reason: 'Bu KAPSAM DISI birakildi: .claude/hooks/selftest-y1d.cjs bu turda degismeyecek' });
{
  const code = callGate('.claude/hooks/selftest-y1d.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-FIELD-ISOLATION) "reason" alaninda anilan dosya reddedilir, token harcanmaz', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/selftest-y1c.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-FIELD-ISOLATION-2) ayni belgede "scope" alanindaki dosya hala kabul edilir, tukenmez', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-NO-SCOPE-FIELD, eski y1-d): "scope" alani hic yoksa fail-closed. NOT: "note" burada
// ALLOWED_ROOT_KEYS'te OLMAYAN bir alan olduğu için bu vaka aslında P5'e (bilinmeyen kök alan)
// takılıyor, P6'ya (scope dizi/boş kontrolü) HİÇ ULAŞMIYOR — QA'nın tur-4 taramasının bulduğu
// tam bu ayrımdı (bkz D-NO-SCOPE-FIELD-REAL aşağıda, P6'nın GERÇEK/tek başına testi). Bu vaka
// KENDİ BAŞINA hâlâ geçerli bir regresyon testi (P5'in de fail-closed olduğunu doğrular),
// bilerek KORUNUYOR ama ismi P6 iddiası taşımayacak şekilde netleştirildi.
writeGuardRaw(JSON.stringify({ note: 'onay metni, scope alani yok', created_at: nowIso() }));
{
  const code = callGate('.claude/hooks/selftest-y1e.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-NO-SCOPE-FIELD) "scope" alani hic yoksa fail-closed (bilinmeyen "note" alani -> P5 devreye girer)', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-NO-SCOPE-FIELD-REAL, B-2 KAPANIŞI, P6'nın GERÇEK/tek başına testi — docs/qa/
// hook-borclari-contract.md): YALNIZCA izin verilen kök alanlar (created_at, reason) kullanılır,
// "scope" GERÇEKTEN hiç yok — böylece P5 (bilinmeyen kök alan) hiç devreye girmez ve akış P6'ya
// (`!Array.isArray(doc.scope) || doc.scope.length === 0`) ulaşır. QA'nın ölçtüğü mutasyon (bu
// kontrolün kaldırılması): `for (const item of doc.scope)` `doc.scope` `undefined` olduğu için
// `TypeError: doc.scope is not iterable` fırlatır, YAKALANMAZ, süreç Node varsayılanıyla exit 1
// verir — Claude Code SADECE exit 2'yi engelleme saydığı için bu FAIL-OPEN'dır (sessiz izin).
writeGuardRaw(JSON.stringify({ reason: 'onay metni, "scope" alani GERCEKTEN yok (P5 devreye girmez)', created_at: nowIso() }));
{
  const code = callGate('.claude/hooks/selftest-p6-real.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-NO-SCOPE-FIELD-REAL / P6) yalnizca izin verilen alanlar + "scope" GERCEKTEN yok -> fail-closed (exit 2, FAIL-OPEN degil)', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-CREATED-AT-NUMERIC-YEAR, B-2 KAPANIŞI, P9 belgelemesi — kısmen fazlalık): "created_at"
// SAYI olarak 4 haneli bir yıl (2026) -> P9 (`typeof !== 'string'`) bunu YAKALAR (asıl kontrol).
// QA'nın notu: bu SPESİFİK sayı ("2026" gibi 4 haneli) P9 kaldırılsa bile SIZINTI ÜRETMEZ, çünkü
// `Date.parse(2026)` (örtük ToString ile "2026") GEÇERLİ bir tarihe (2026-01-01) ayrışır ve bu
// tarih "şimdi"nin çok gerisinde kaldığı için P14 (süre dolmuş kontrolü) devreye girip belgeyi
// yine reddeder — yalnızca "error" yerine "expired" olarak. Bu test P9'un BUGÜN doğru çalıştığını
// (fail-closed) doğrular; P9 kaldırılırsa AYNI SONUÇ (fail-closed, ama P14 üzerinden) beklenir —
// bu yüzden P9 "kısmen fazlalık" sayılır (bkz gate-check.cjs P9 yorumu).
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/selftest-p9-numeric.cjs'], created_at: 2026 }));
{
  const code = callGate('.claude/hooks/selftest-p9-numeric.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-CREATED-AT-NUMERIC-YEAR / P9) created_at sayisal 4 haneli yil -> fail-closed (P9 dogrudan yakalar)', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-EMPTY-ARRAY, eski y1-h): "scope" bos dizi -> fail-closed.
writeGuardRaw(JSON.stringify({ scope: [], created_at: nowIso() }));
{
  const code = callGate('.claude/hooks/selftest-y1j.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-EMPTY-ARRAY) "scope" bos dizi -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-DUP-KEY / P7b KAPANIŞI — CEO sondası P7b'nin birebir regresyonu): P7 turunda "yinelenen
// scope anahtari guvenlik acigi degil, JSON'un kendi kurali (SONUNCUSU gecerli)" denip mesru
// sayilmisti. CEO'nun bagimsiz sondasi (probe-json-guard.mjs P7b) bunun TAM TERSINI kanitladi:
// SONUNCU deger ("evil-payload.cjs" gibi) beyaz listeye UYAN bir ad olabilir ve GORUNMEZ kalarak
// KABUL EDILEBILIR — yani belge "gate-check.cjs" gosterirken makine "evil-payload.cjs"i
// yetkilendirebilir. Karar degisti: JSON.parse'a ULASMADAN ham metin taranir, HER SEVIYEDE
// yinelenen anahtar TUM belgeyi gecersiz kilar (kayipsiz ayristirma zorunlulugu). Asagida HEM
// gorunen (ilk) HEM gizli (ikinci) ad da REDDEDILIR — "sonuncusu kazanir" davranisi artik hic
// devreye girmiyor, cunku JSON.parse'a hic ulasilmiyor.
{
  const decoy = '.claude/hooks/block-dangerous.cjs';
  const real = '.claude/hooks/selftest-dupkey-real.cjs';
  const raw = '{"scope":["' + decoy + '"],"created_at":"' + nowIso() + '","scope":["' + real + '"]}';
  writeGuardRaw(raw);
  const codeDecoy = callGate(decoy);
  const untouchedAfterDecoy = fs.existsSync(GUARD_OK);
  const codeReal = callGate(real);
  const untouchedAfterReal = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-DUP-KEY / P7b) yinelenen "scope" anahtari: HEM gorunen HEM gizlenen ad reddedilir, belge TAMAMEN gecersiz (dosya SILINMEZ)',
    codeDecoy === 2 && untouchedAfterDecoy && codeReal === 2 && untouchedAfterReal,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-DUP-KEY-CREATED-AT): yinelenen "created_at" anahtari (kok seviye) -> belge TAMAMEN gecersiz.
writeGuardRaw('{"scope":[".claude/hooks/selftest-dup-created.cjs"],"created_at":"' + nowIso() + '","created_at":"' + nowIso(-1000) + '"}');
{
  const code = callGate('.claude/hooks/selftest-dup-created.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-DUP-KEY-CREATED-AT) yinelenen "created_at" anahtari -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-DUP-KEY-VALID-MINUTES): yinelenen "valid_minutes" anahtari (kok seviye) -> belge TAMAMEN gecersiz.
writeGuardRaw('{"scope":[".claude/hooks/selftest-dup-vm.cjs"],"created_at":"' + nowIso() + '","valid_minutes":30,"valid_minutes":5}');
{
  const code = callGate('.claude/hooks/selftest-dup-vm.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-DUP-KEY-VALID-MINUTES) yinelenen "valid_minutes" anahtari -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-DUP-KEY-NESTED): yinelenen anahtar KOK seviyede DEGIL, ic ice bir nesnenin ("reason" bir
// JSON object olarak yazilmis) KENDI seviyesinde. Tarayici HER SEVIYEYI ayri ayri kontrol eder
// (brief karari: "her seviye" — belirsizlik burada da sifir erisime cozulur).
writeGuardRaw(
  '{"scope":[".claude/hooks/selftest-dup-nested.cjs"],"created_at":"' + nowIso() + '",' +
  '"reason":{"a":1,"b":2,"a":3}}',
);
{
  const code = callGate('.claude/hooks/selftest-dup-nested.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-DUP-KEY-NESTED) ic ice nesnenin KENDI seviyesinde yinelenen anahtar -> fail-closed (kok temiz olsa bile)', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-DUP-KEY-STRING-DECOY, asiri engelleme YOK): "reason" ICINDE anahtar gibi GORUNEN metin
// ("\"scope\": [...]") bir JSON dize DEGERIDIR, yapi degil — tarayici bunu asla anahtar
// SANMAMALI. Belge GECERLI kalmali (D-REASON-CANNOT-LEAK'in tarayici-duzeyindeki karsiligi).
writeGuardRaw(JSON.stringify({
  reason: '"scope": [".claude/hooks/evil-in-string.cjs"] - bu sadece bir metin, JSON yapisi degil',
  scope: ['.claude/hooks/selftest-string-decoy.cjs'],
  created_at: nowIso(),
}));
{
  const code = callGate('.claude/hooks/selftest-string-decoy.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-DUP-KEY-STRING-DECOY) dize DEGERI icindeki "anahtar gibi" metin yinelenen anahtar SAYILMAZ -> kabul (asiri engelleme yok)', code === 0 && remains);
}
{
  const code = callGate('.claude/hooks/evil-in-string.cjs');
  const stillAlive = fs.existsSync(GUARD_OK); // zaman penceresi modeli: kapsam disi deneme token'i harcamaz
  fail += reportScope('(D-DUP-KEY-STRING-DECOY-2) dize icindeki ad kapsama HALA giremez (reason hicbir zaman taranmaz)', code === 2 && stillAlive);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-UNKNOWN-ROOT-KEY): baska turlu TAMAMEN gecerli bir belgeye izin verilmeyen bir kok alan
// eklenirse -> fail-closed ("gizli alan" saldirilarina karsi kapali liste, brief karari).
writeGuardRaw(JSON.stringify({
  scope: ['.claude/hooks/selftest-unknown-key.cjs'],
  created_at: nowIso(),
  extra_hidden_field: ['.claude/hooks/should-not-matter.cjs'],
}));
{
  const code = callGate('.claude/hooks/selftest-unknown-key.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-UNKNOWN-ROOT-KEY) izin verilmeyen kok alan (kapali liste disinda) -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-UNKNOWN-ROOT-KEY-APPROVED-BY, negatif kontrol): "approved_by" kapali listede -> kabul
// edilir (icerigi hicbir zaman okunmaz/dogrulanmaz, "reason" ile ayni muamele).
writeGuardRaw(JSON.stringify({
  scope: ['.claude/hooks/selftest-approved-by.cjs'],
  created_at: nowIso(),
  approved_by: 'Kullanici (Veron)',
}));
{
  const code = callGate('.claude/hooks/selftest-approved-by.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-UNKNOWN-ROOT-KEY-APPROVED-BY) "approved_by" bilinen bir alan -> kabul', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-TRAILING-GARBAGE): gecerli JSON degerinden SONRA fazladan metin -> fail-closed.
// (JSON.parse'in kendi native davranisi zaten reddeder — bu, o davranisin KILITLENMESI icin
// bir regresyon testidir, brief'in acikca istedigi "artik veri" vektoru.)
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/selftest-trailing.cjs'], created_at: nowIso() }) + '  bu-fazladan-metin');
{
  const code = callGate('.claude/hooks/selftest-trailing.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-TRAILING-GARBAGE) JSON degerinden sonra fazladan veri -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-MULTI-JSON-DOCS): iki ardisik JSON belgesi ayni dosyada -> fail-closed (brief'in acikca
// istedigi "birden fazla JSON belgesi" vektoru).
writeGuardRaw(
  JSON.stringify({ scope: ['.claude/hooks/selftest-multidoc-decoy.cjs'], created_at: nowIso() }) +
  JSON.stringify({ scope: ['.claude/hooks/selftest-multidoc-real.cjs'], created_at: nowIso() }),
);
{
  const codeDecoy = callGate('.claude/hooks/selftest-multidoc-decoy.cjs');
  const untouchedAfterDecoy = fs.existsSync(GUARD_OK);
  const codeReal = callGate('.claude/hooks/selftest-multidoc-real.cjs');
  const untouchedAfterReal = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-MULTI-JSON-DOCS) ardisik iki JSON belgesi -> fail-closed, HICBIRI kabul edilmez',
    codeDecoy === 2 && untouchedAfterDecoy && codeReal === 2 && untouchedAfterReal,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-UNICODE-ESCAPED-KEY-SINGLE, negatif kontrol): "\u0073cope" (kacisli "s") TEK basina, normal
// "scope" ile CAKISMADAN kullanilirsa -> JSON.parse bunu zaten "scope" olarak COZER, gecerli bir
// belge gibi davranilir (bu bir saldiri degil, sadece JSON'un ayni anahtari yazmanin baska bir
// yolu — kabul edilmeli, asiri engelleme yok).
writeGuardRaw('{"\\u0073cope":[".claude/hooks/selftest-unicode-key.cjs"],"created_at":"' + nowIso() + '"}');
{
  const code = callGate('.claude/hooks/selftest-unicode-key.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-UNICODE-ESCAPED-KEY-SINGLE) "\\u0073cope" tek basina "scope" ile ES DEGERDIR -> kabul', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-UNICODE-ESCAPED-KEY-DUP): literal "scope" VE kacisli "\u0073cope" AYNI ANDA -> ikisi de
// CANONICAL olarak "scope"a cozulur, bu YINELENEN ANAHTARDIR (tarayici dize icerigini decode
// EDEREK karsilastirir, raw metni degil) -> fail-closed.
writeGuardRaw('{"scope":[".claude/hooks/selftest-unicode-decoy.cjs"],"\\u0073cope":[".claude/hooks/selftest-unicode-real.cjs"],"created_at":"' + nowIso() + '"}');
{
  const codeDecoy = callGate('.claude/hooks/selftest-unicode-decoy.cjs');
  const untouchedAfterDecoy = fs.existsSync(GUARD_OK);
  const codeReal = callGate('.claude/hooks/selftest-unicode-real.cjs');
  const untouchedAfterReal = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-UNICODE-ESCAPED-KEY-DUP) literal "scope" + kacisli "\\u0073cope" CANONICAL olarak ayni anahtar -> yinelenen sayilir, fail-closed',
    codeDecoy === 2 && untouchedAfterDecoy && codeReal === 2 && untouchedAfterReal,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-PROTO, P7b sonrasi GUCLENDIRILDI): "__proto__" alanina konan sahte bir "scope" zaten
// HICBIR ETKI yapmiyordu (JSON.parse "__proto__"yu OZ ozellik olarak yazar, prototipi
// degistirmez — V8/ES2019 davranisi) — bu ONCEDEN de dogruydu. P7b kapanisiyla eklenen kapali
// kok-alan listesi (ALLOWED_ROOT_KEYS) bunun USTUNE ikinci bir katman ekliyor: `Object.keys(doc)`
// "__proto__"yu da OZ ozellik olarak GORUR (asagida dogrulandi), ve "__proto__" izin verilen
// alanlar arasinda OLMADIGI icin belgenin TAMAMI artik gecersiz sayilir — yalniz "sahte scope
// etkisiz kaliyor" degil, "boyle bir alan tasiyan belge hic kabul edilmiyor". Yani hem GUVENLI
// (evil hicbir zaman kapsam kazanamaz) HEM DE gercek dosya da bu YAPIDAKI bir belgeyle ARTIK
// gecmiyor — bu bilinçli bir sikilastirma, "asiri engelleme" degil: mesru bir GUARD.ok'un
// "__proto__" adinda bir kok alani OLMASI icin hicbir sebep yok.
{
  const safe = '.claude/hooks/selftest-proto-safe.cjs';
  const evil = '.claude/hooks/selftest-proto-evil.cjs';
  const raw = '{"scope":["' + safe + '"],"created_at":"' + nowIso() + '","__proto__":{"scope":["' + evil + '"]}}';
  writeGuardRaw(raw);
  const codeEvil = callGate(evil);
  const untouchedAfterEvil = fs.existsSync(GUARD_OK);
  const codeSafe = callGate(safe);
  const untouchedAfterSafe = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-PROTO) "__proto__" alani hem sahte scope\'u etkisiz birakir HEM DE (bilinmeyen kok alan olarak) TUM belgeyi gecersiz kilar',
    codeEvil === 2 && untouchedAfterEvil && codeSafe === 2 && untouchedAfterSafe,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);
// Ayri, dar bir pozitif kontrol: "__proto__" YOKKEN ayni "safe" scope'un normal kabul edildigini
// dogrula — yukaridaki testin KOD REDDI "__proto__" yuzunden mi, yoksa baska bir sebepten mi
// oldugunu ayirt eder (regresyon izolasyonu).
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/selftest-proto-safe-alone.cjs'], created_at: nowIso() }));
{
  const code = callGate('.claude/hooks/selftest-proto-safe-alone.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-PROTO-ISOLATION) ayni scope, "__proto__" OLMADAN, normal kabul edilir (reddin sebebi gercekten "__proto__")', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-SCOPE-NOT-ARRAY): "scope" bir dize -> fail-closed.
writeGuardRaw(JSON.stringify({ scope: '.claude/hooks/block-dangerous.cjs', created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-SCOPE-NOT-ARRAY) "scope" dizi degil (dize) -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-NESTED): "scope" icinde ic ice bir dizi elemani -> TUM kapsam gecersiz.
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/block-dangerous.cjs', ['nested']], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-NESTED) scope icinde ic ice dizi elemani -> TUM kapsam gecersiz (gecerli eleman de reddedilir)', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-NULL-ELEMENT): "scope" icinde null eleman -> TUM kapsam gecersiz.
writeGuardRaw(JSON.stringify({ scope: [null], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-NULL-ELEMENT) scope icinde null eleman -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-MIXED-TYPE-ARRAY, eski y1t2-h): bir GECERLI + bir GECERSIZ (sayi) eleman -> TUM kapsam
// gecersiz; daha once kabul edilecek gecerli ad bile artik reddedilir.
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/block-dangerous.cjs', 42], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-MIXED-TYPE-ARRAY) gecerli+gecersiz (sayi) karisik dizi -> TUM kapsam gecersiz (onceki gecerli ad da reddedilir)', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-OVERSIZED): dosya boyutu ust sinirin (8192 bayt) uzerinde -> JSON.parse denenmeden fail-closed.
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/block-dangerous.cjs'], created_at: nowIso(), reason: 'x'.repeat(9000) }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-OVERSIZED) dosya boyutu ust sinirin uzerinde -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (C-BOM, negatif kontrol): UTF-8 BOM ile baslayan GECERLI belge kabul edilir (mesru editor
// artefakti, asiri engelleme YOK).
{
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const jsonText = Buffer.from(JSON.stringify({ scope: ['.claude/hooks/block-dangerous.cjs'], created_at: nowIso() }), 'utf8');
  writeGuardRaw(Buffer.concat([bom, jsonText]));
  const code = callGate(HOOK_FILE);
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(C-BOM) UTF-8 BOM ile baslayan gecerli belge kabul edilir (asiri engelleme yok)', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (C-CRLF, negatif kontrol): jetonlar arasi CRLF ile bicimlendirilmis gecerli belge kabul edilir.
{
  const doc = { scope: ['.claude/hooks/block-dangerous.cjs'], created_at: nowIso() };
  const pretty = JSON.stringify(doc, null, 2).split('\n').join('\r\n');
  writeGuardRaw(pretty);
  const code = callGate(HOOK_FILE);
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(C-CRLF) jetonlar arasi CRLF ile bicimlendirilmis gecerli belge kabul edilir', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-NUL-RAW): dosya metninde HAM (kacissiz) NUL bayti -> fail-closed. NUL, bir JSON dize
// degerinin ICINE gomulur (kapanan tirnaktan once) — bu, gecerli-gorunen bir scope elemanini da
// bozar.
{
  const prefix = Buffer.from('{"scope":[".claude/hooks/block-dangerous.cjs', 'utf8');
  const nul = Buffer.from([0]);
  const suffix = Buffer.from('"],"created_at":"' + nowIso() + '"}', 'utf8');
  writeGuardRaw(Buffer.concat([prefix, nul, suffix]));
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-NUL-RAW) dosya metninde ham NUL bayti -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-NUL-ESCAPED): scope elemani icinde KACISLI (escaped) bir NUL karakteri (JSON.stringify'in
// urettigi \u0000 kacis dizisi) -> JSON.parse basariyla bir NUL iceren dizeye cozer, ama bu
// dize beyaz liste regex'ine UYMADIGI icin (sonuna fazladan karakter eklenir) reddedilir.
{
  const poisoned = '.claude/hooks/block-dangerous.cjs' + String.fromCharCode(0);
  writeGuardRaw(JSON.stringify({ scope: [poisoned], created_at: nowIso() }));
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-NUL-ESCAPED) scope elemaninda kacisli NUL karakteri -> beyaz liste reddeder, fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-UNI): ASCII olmayan bir "homoglif" karakter (Kiril "с", U+0441) icin \w (bayraksiz, ASCII)
// eslesmez -> beyaz liste reddeder. Ayri bir Unicode-normalizasyon adimina GEREK YOK.
{
  const cyrillicEs = String.fromCharCode(0x0441); // Kiril kucuk "es", Latin "c"ye gorsel olarak benzer
  const homoglyph = '.claude/hooks/gate-' + cyrillicEs + 'heck.cjs'; // "gate-check.cjs" taklidi
  writeGuardRaw(JSON.stringify({ scope: [homoglyph], created_at: nowIso() }));
  const code = callGate('.claude/hooks/gate-check.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-UNI) Kiril homoglif karakter iceren ad ASCII beyaz listeye uymaz -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-TRAVERSAL): "../evil.cjs" literal onekle baslamadigi icin otomatik reddedilir (yol olarak
// COZULMEZ, sabit dize karsilastirmasi).
writeGuardRaw(JSON.stringify({ scope: ['../evil.cjs'], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-TRAVERSAL) "../evil.cjs" beyaz listeye uymaz -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-ABS): mutlak yol (surucu harfi) literal onekle baslamiyor -> reddedilir.
writeGuardRaw(JSON.stringify({ scope: ['C:/Temp/evil.cjs'], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-ABS) mutlak yol (surucu harfi) beyaz listeye uymaz -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-UNC): UNC yolu hem literal onekle baslamiyor hem de ters bolu iceriyor -> reddedilir.
writeGuardRaw(JSON.stringify({ scope: ['\\\\server\\share\\evil.cjs'], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-UNC) UNC yolu (ters bolu + onek uyumsuzlugu) -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-LONGPREFIX): Windows \\?\ uzun-yol oneki de ayni sekilde reddedilir.
writeGuardRaw(JSON.stringify({ scope: ['\\\\?\\C:\\evil.cjs'], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-LONGPREFIX) \\\\?\\ uzun-yol oneki -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-BACKSLASH): Windows-stili ters bolu ayracli bir "kapsam gibi gorunen" yol acikca reddedilir
// (regex zaten reddeder; ayrica acik indexOf('\\') kontrolu de var, cift katman).
writeGuardRaw(JSON.stringify({ scope: ['.claude\\hooks\\block-dangerous.cjs'], created_at: nowIso() }));
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-BACKSLASH) ters bolu ayracli yol -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-WHITELIST-*, M1 kapanışı — docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md §1.5 KALDI
// gerekçesi): yukarıdaki D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/D-BACKSLASH/D-UNI vakalarının
// HİÇBİRİ beyaz listeyi (`normalizeScopeEntry`) ÖLÇMÜYORDU — hepsi HOOK_FILE'a
// (.claude/hooks/block-dangerous.cjs) yazmayı deniyor ama `scope`'a HOOK_FILE'DAN FARKLI bir
// değer yazıyordu; bu yüzden kapsam ÜYELİK kontrolü (`parsed.scope.has(relLower)`) TEK BAŞINA
// reddediyordu — beyaz liste tamamen kaldırılsa bile AYNI ŞEKİLDE reddederdi. QA ölçtü:
// `normalizeScopeEntry` TAMAMEN kaldırılınca self-test 157/157 YEŞİL kalıyordu (çit YOKMUŞ gibi
// görünüyordu, oysa YÜK TAŞIYAN bir kontroldü). AYIRT EDİCİ vakalar: `scope` elemanı, YAZILMAK
// İSTENEN HEDEFİN KANONİK YOLUNA TAM OLARAK EŞİT (yani kapsam-üyelik kontrolü GEÇER) ama beyaz
// liste BİÇİMİNE UYMUYOR (alt dizin, .cjs dışı uzantı, boşluk, çift uzantı). Bu durumda TEK ret
// nedeni beyaz listedir — kaldırılırsa bu 6 vakanın HEPSİ KIRMIZI (SIZINTI) vermeli. QA'nın
// raporundaki (§1.5) ayırt edici sondanın birebir karşılığı.
const whitelistDiscriminatingCases = [
  ['.claude/hooks/sub/evil.cjs', 'D-WHITELIST-SUBDIR: alt dizin (.cjs dogru ama .claude/hooks/ DOGRUDAN altinda degil)'],
  ['.claude/hooks/notes.md', 'D-WHITELIST-EXT-MD: .claude/hooks/ altinda ama uzanti .cjs DEGIL (.md)'],
  ['.claude/hooks/config.json', 'D-WHITELIST-EXT-JSON: .claude/hooks/ altinda ama uzanti .cjs DEGIL (.json, .claude/settings.json ile KARISTIRILMAMALI)'],
  ['.claude/hooks/evil file.cjs', 'D-WHITELIST-SPACE: dosya adinda bosluk ([\\w-]+ bosluk kabul etmez)'],
  ['.claude/hooks/evil.payload.cjs', 'D-WHITELIST-DOUBLE-EXT: dosya adinda ikinci bir nokta (evil.payload.cjs)'],
  ['.claude/hooks/a/b/c.cjs', 'D-WHITELIST-NESTED: iki seviyeli alt dizin'],
];
for (const [vectorPath, label] of whitelistDiscriminatingCases) {
  writeGuardRaw(JSON.stringify({ scope: [vectorPath], created_at: nowIso() }));
  const code = callGate(vectorPath);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope(
    `(${label}) scope = hedefin kanonik yolu (kapsam UYELIGI gecer) ama beyaz liste BICIMINE uymuyor -> fail-closed`,
    code === 2 && untouched,
  );
  rm(GUARD_OK); rm(GUARD_STATE);
}

// (D-ROOT-NOT-OBJECT): kok deger bir JSON object olmali; dizi/dize/null kok degerler reddedilir.
for (const [rootVal, label] of [
  [['./.claude/hooks/block-dangerous.cjs'], 'kok bir dizi'],
  ['sadece bir dize', 'kok bir dize'],
  [null, 'kok null'],
]) {
  writeGuardRaw(JSON.stringify(rootVal));
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope(`(D-ROOT-NOT-OBJECT) ${label} -> fail-closed`, code === 2 && untouched);
  rm(GUARD_OK); rm(GUARD_STATE);
}

// (D-SYNTAX-ERROR): gecersiz JSON sozdizimi -> fail-closed, dosya SILINMEZ (kullanici duzeltip
// tekrar denesin diye).
writeGuardRaw('{ scope: [oops, bozuk json');
{
  const code = callGate(HOOK_FILE);
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-SYNTAX-ERROR) gecersiz JSON sozdizimi -> fail-closed, dosya silinmez', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-SCANNER-DEPTH-*, M2 kapanışı — docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md §1.3):
// `scanForDuplicateKeys` artık MAX_GUARD_BYTES'TEN BAĞIMSIZ, KASITLI bir iç içe derinlik sınırına
// (`MAX_SCAN_DEPTH`, gate-check.cjs) sahip. QA'nın ölçümü: tarayıcının kendi JS çağrı yığını
// sınırı ~5074 seviyede RangeError fırlatıyordu ve bu ESKİDEN `catch (_) { dup = null; }` ile
// SESSİZCE yutuluyordu (fail-OPEN) — yani koruma yalnızca MAX_GUARD_BYTES'in (8192 bayt, sadece
// DoS gerekçesiyle seçilmiş) o derinliğe ULAŞILAMAMASINA güveniyordu (emniyet payı ~1.26x).
// Aşağıdaki iki test: (1) makul derinlik hiç sorun çıkarmaz (aşırı engelleme yok), (2) sınırın
// ÇOK altında bir bayt boyutuyla (MAX_GUARD_BYTES'e ULAŞMADAN ÖNCE) derinlik sınırı KENDİ BAŞINA
// devreye girer ve belge FAIL-CLOSED reddedilir — yani koruma artık MAX_GUARD_BYTES'in DEĞERİNDEN
// bağımsız. (DİZİ iç içe geçmesi kullanılıyor: QA'nın gerçek sızıntı denemesi de dizilerledi,
// tarayıcının "level" sayacı YALNIZCA object'lerde arttığı için bir derinlik sınırı "level"
// üzerinden yazılsaydı diziler için işlemezdi — gate-check.cjs bu yüzden ayrı bir "depth" sayacı
// kullanıyor.)
function nestedArrayJson(depth) { return '['.repeat(depth) + '0' + ']'.repeat(depth); }

// (D-SCANNER-DEPTH-OK, negatif kontrol): 50 seviye ic ice bir "reason" degeri tarayiciyi hic
// zorlamiyor (MAX_SCAN_DEPTH'in COK altinda), belge normal kabul edilir.
writeGuardRaw('{"scope":[".claude/hooks/depth-ok.cjs"],"created_at":"' + nowIso() + '","reason":' + nestedArrayJson(50) + '}');
{
  const code = callGate('.claude/hooks/depth-ok.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-SCANNER-DEPTH-OK) 50 seviye ic ice "reason" -> tarayici siniri asilmaz, belge kabul edilir (asiri engelleme yok)', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-SCANNER-DEPTH-EXCEEDED, M2 zorunlu kanit): 400 seviye ic ice "reason" (~800 bayt —
// MAX_GUARD_BYTES'in (8192) COK altinda, yani boyut siniri devreye GIRMEDEN once derinlik siniri
// tetiklenir) -> tarayici KASITLI olarak vazgecer (__scanDepthExceeded), YENI catch mantigi bunu
// __scanErr SAYMAZ ve belgeyi FAIL-CLOSED reddeder (dosya SILINMEZ, kullanici duzeltip tekrar dener).
{
  const raw = '{"scope":[".claude/hooks/depth-exceeded.cjs"],"created_at":"' + nowIso() + '","reason":' + nestedArrayJson(400) + '}';
  writeGuardRaw(raw);
  const code = callGate('.claude/hooks/depth-exceeded.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-SCANNER-DEPTH-EXCEEDED) 400 seviye ic ice "reason" (bayt sinirinin COK altinda, ~800B) -> derinlik siniri KENDI BASINA tetiklenir, fail-closed',
    code === 2 && untouched,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-SCANNER-DEPTH-OBJECT-*, B-5 KAPANIŞI — docs/blockers.md B-5, docs/qa/hook-borclari-
// contract.md): yukarıdaki D-SCANNER-DEPTH-* vakalarının HİÇBİRİ `parseObject`'in KENDİ
// `depth + 1` artışını ölçmüyordu — hepsi DİZİ (`nestedArrayJson`) iç içe geçmesi kullanıyordu.
// `parseObject`'teki `depth + 1` → `depth` mutasyonu (yalnızca OBJECT dalı, ARRAY dalı
// DOKUNULMAMIŞ) bu yüzden 165/165 self-test'i YEŞİL bırakıyordu — obje dalının kendi artışı
// ÇİTSİZDİ (sömürülebilirlik ayrı ölçüldü: bayt sınırı içinde en derin obje 1611 seviye,
// RangeError eşiği ~5074, pay 3,1x — SIZINTI YOK, ama ölçülmüyordu). Aşağıdaki iki vaka SADECE
// nesne iç içe geçmesi (`nestedObjectJson`) kullanır; DİZİ hiç kullanılmaz, yani obje dalının
// KENDİ derinlik artışı tek başına test edilir.
function nestedObjectJson(depth) {
  let s = '0';
  for (let i = 0; i < depth; i++) s = '{"a":' + s + '}';
  return s;
}

// (D-SCANNER-DEPTH-OBJECT-OK, negatif kontrol): 50 seviye ic ice OBJE (dizi degil) tarayiciyi
// hic zorlamiyor, belge normal kabul edilir (asiri engelleme yok).
writeGuardRaw('{"scope":[".claude/hooks/depth-obj-ok.cjs"],"created_at":"' + nowIso() + '","reason":' + nestedObjectJson(50) + '}');
{
  const code = callGate('.claude/hooks/depth-obj-ok.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-SCANNER-DEPTH-OBJECT-OK) 50 seviye ic ice OBJE "reason" -> siniri asilmaz, kabul edilir (asiri engelleme yok)', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-SCANNER-DEPTH-OBJECT-EXCEEDED, B-5 ZORUNLU KANIT): 400 seviye ic ice OBJE (~800B, bayt
// sinirinin COK altinda) -> derinlik siniri KENDI BASINA (obje dalinin artisiyla) tetiklenir,
// fail-closed. `parseObject`'teki `depth + 1` -> `depth` mutasyonuyla bu test TEK BASINA
// KIRMIZI verir (mutasyon kaniti docs/qa/hook-borclari-contract.md'de kayitlidir) — cunku obje
// dali artik derinligi hic artirmaz, 400 seviye ic ice obje MAX_SCAN_DEPTH'i (200) hicbir zaman
// asmaz, tarayici basariyla tamamlar ve belge KABUL EDILIR (code 0, beklenen 2 degil).
{
  const raw = '{"scope":[".claude/hooks/depth-obj-exceeded.cjs"],"created_at":"' + nowIso() + '","reason":' + nestedObjectJson(400) + '}';
  writeGuardRaw(raw);
  const code = callGate('.claude/hooks/depth-obj-exceeded.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-SCANNER-DEPTH-OBJECT-EXCEEDED / B-5) 400 seviye ic ice OBJE (bayt sinirinin COK altinda) -> obje dalinin KENDI derinlik artisi fail-closed tetikler',
    code === 2 && untouched,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// --- Turun ZORUNLU bloklayici senaryosu: baslik-kimligi-devralma artik YAPISAL OLARAK
// IMKANSIZ (docs/qa/G5-sozlesme-kararlari-2026-09-10-tur3.md D1-D10 ailesinin JSON'daki karsiligi)
// "reason" alanina harfiyen tur-3'un sizdiran belgesi gomulur (tam bir eski-bicim "## Kapsam"
// blogu + arsivlenmis bir dosya adi icerir); "scope" yalnizca GERCEKTEN onaylanan dosyayi
// listeler. Ayristirici "reason"a HIC BAKMADIGI icin gomulu ad HER ZAMAN reddedilir — bu tek
// bir sondaya bagli bir "kapandi" iddiasi degil, ayristiricinin scope disinda hicbir alani
// okumamasinin YAPISAL sonucudur.
{
  const embeddedMarkdown =
    '## Kapsam (2 dosya)\n\n- `gate-check.cjs`\n\n' +
    '## Onceki onayin metni (arsiv, referans icin)\n\n## Kapsam\n\n- `evil-payload.cjs`\n';
  writeGuardRaw(JSON.stringify({
    scope: ['.claude/hooks/gate-check.cjs'],
    reason: embeddedMarkdown,
    created_at: nowIso(),
  }));
  const codeEvil = callGate('.claude/hooks/evil-payload.cjs');
  const untouchedAfterEvil = fs.existsSync(GUARD_OK);
  const codeApproved = callGate('.claude/hooks/gate-check.cjs');
  const remainsAfterApproved = fs.existsSync(GUARD_OK);
  fail += reportScope(
    '(D-REASON-CANNOT-LEAK / TUR-3 BLOKLAYICISI) "reason" icine gomulu eski-bicim "## Kapsam" blogundaki ad ASLA kapsama giremez; gercek onayli dosya kabul edilir',
    codeEvil === 2 && untouchedAfterEvil && codeApproved === 0 && remainsAfterApproved,
  );
}
rm(GUARD_OK); rm(GUARD_STATE);

// (D-REALISTIC-CEO-DOC, eski y1t2-d): gercekci CEO belgesi JSON'da yeniden kuruldu — iki dosya
// acikca "DOKUNULMAYACAK"/"KAPSAMI DISINDADIR" diye "reason" icinde reddediliyor, sadece bir
// dosya "scope"ta.
writeGuardRaw(JSON.stringify({
  scope: ['.claude/hooks/gate-check.cjs'],
  reason: 'G5 tur 6 hook bakimi. Bu turda _selftest.cjs dosyasina DOKUNULMAYACAK, kapsam disidir. ' +
    'Ayrica block-dangerous.cjs da bu onayin KAPSAMI DISINDADIR.',
  approved_by: 'Kullanici (Veron) - AskUserQuestion',
  created_at: nowIso(),
}));
{
  const code = callGate('.claude/hooks/_selftest.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-REALISTIC-CEO-DOC) "reason"da "DOKUNULMAYACAK" denen dosya reddedilir', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/block-dangerous.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-REALISTIC-CEO-DOC-2) "reason"da "KAPSAMI DISINDADIR" denen dosya reddedilir', code === 2 && untouched);
}
{
  const code = callGate('.claude/hooks/gate-check.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(D-REALISTIC-CEO-DOC-3) "scope"taki tek dosya kabul edilir, TUKENMEZ, bilinmeyen "approved_by" alani zararsizca yoksayilir', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// --- Zaman penceresi (T-*) vakalari ---------------------------------------------------------
// Gercek 30 dakika BEKLENMEDEN test edilir: "created_at" gecmise/gelecege yazilarak (brief'in
// onerdigi ikinci yontem). Her hesaplama gercek Date.now() referans alinir.

// (T-FRESH): created_at=simdi, varsayilan pencere (30 dk) -> kabul.
writeGuardScope(['t-fresh.cjs']);
{
  const code = callGate('.claude/hooks/t-fresh.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-FRESH) created_at=simdi, varsayilan pencere -> kabul, TUKENMEZ', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-EXPIRED-DEFAULT): created_at=41 dk once, varsayilan 30 dk -> red VE DOSYA SILINIR.
writeGuardScope(['t-expired.cjs'], { createdOffsetMs: -41 * 60 * 1000 });
{
  const code = callGate('.claude/hooks/t-expired.cjs');
  const deleted = !fs.existsSync(GUARD_OK);
  fail += reportScope('(T-EXPIRED-DEFAULT) created_at=41 dk once, varsayilan 30 dk -> red VE dosya silinir', code === 2 && deleted);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-BOUNDARY-VALID): created_at=29 dk 59 sn once -> hala gecerli (kabul).
writeGuardScope(['t-boundary-valid.cjs'], { createdOffsetMs: -(29 * 60 + 59) * 1000 });
{
  const code = callGate('.claude/hooks/t-boundary-valid.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-BOUNDARY-VALID) created_at=29dk59sn once -> hala gecerli (kabul)', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-BOUNDARY-EXPIRED): created_at=30 dk 1 sn once -> suresi dolmus (red+silinir).
writeGuardScope(['t-boundary-expired.cjs'], { createdOffsetMs: -(30 * 60 + 1) * 1000 });
{
  const code = callGate('.claude/hooks/t-boundary-expired.cjs');
  const deleted = !fs.existsSync(GUARD_OK);
  fail += reportScope('(T-BOUNDARY-EXPIRED) created_at=30dk1sn once -> suresi dolmus (red+silinir)', code === 2 && deleted);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-CUSTOM-WINDOW): valid_minutes=90, created_at=60 dk once -> hala gecerli (kabul).
writeGuardScope(['t-custom.cjs'], { createdOffsetMs: -60 * 60 * 1000, validMinutes: 90 });
{
  const code = callGate('.claude/hooks/t-custom.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-CUSTOM-WINDOW) valid_minutes=90, created_at=60dk once -> kabul', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-OVER-MAX): valid_minutes=121 (ust siniri asiyor) -> fail-closed, created_at=simdi olsa bile.
writeGuardScope(['t-overmax.cjs'], { validMinutes: 121 });
{
  const code = callGate('.claude/hooks/t-overmax.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-OVER-MAX) valid_minutes=121 ust siniri asiyor -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-NEGATIVE-MINUTES): valid_minutes<=0 -> fail-closed (iki alt vaka: 0 ve -5).
for (const vm of [0, -5]) {
  writeGuardScope(['t-negmin.cjs'], { validMinutes: vm });
  const code = callGate('.claude/hooks/t-negmin.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope(`(T-NEGATIVE-MINUTES) valid_minutes=${vm} -> fail-closed`, code === 2 && untouched);
  rm(GUARD_OK); rm(GUARD_STATE);
}

// (T-NON-NUMERIC-MINUTES): valid_minutes bir dize ("30") -> fail-closed.
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/t-strminutes.cjs'], created_at: nowIso(), valid_minutes: '30' }));
{
  const code = callGate('.claude/hooks/t-strminutes.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-NON-NUMERIC-MINUTES) valid_minutes dize ("30") -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-FUTURE): created_at=simdi+10 dk (tolerans disinda gelecek) -> fail-closed.
writeGuardScope(['t-future.cjs'], { createdOffsetMs: 10 * 60 * 1000 });
{
  const code = callGate('.claude/hooks/t-future.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-FUTURE) created_at gelecekte (10 dk, tolerans disi) -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-CLOCK-SKEW-TOLERATED, negatif kontrol): created_at=simdi+30 sn (60 sn tolerans icinde) ->
// KABUL edilir (asiri engelleme yok).
writeGuardScope(['t-skew.cjs'], { createdOffsetMs: 30 * 1000 });
{
  const code = callGate('.claude/hooks/t-skew.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-CLOCK-SKEW-TOLERATED) created_at=simdi+30sn (60sn tolerans icinde) -> kabul', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-NO-CREATED-AT): "created_at" alani hic yok -> fail-closed.
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/t-nocreated.cjs'] }));
{
  const code = callGate('.claude/hooks/t-nocreated.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-NO-CREATED-AT) "created_at" alani yok -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-BAD-CREATED-AT): "created_at" ayristirilamayan bir dize -> fail-closed.
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/t-badcreated.cjs'], created_at: 'bu bir tarih degil' }));
{
  const code = callGate('.claude/hooks/t-badcreated.cjs');
  const untouched = fs.existsSync(GUARD_OK);
  fail += reportScope('(T-BAD-CREATED-AT) "created_at" ayristirilamiyor -> fail-closed', code === 2 && untouched);
}
rm(GUARD_OK); rm(GUARD_STATE);

// (T-EXPIRED-OUT-OF-SCOPE): suresi dolmus token + KAPSAM DISI bir hedefe yazma denemesi ->
// yine dosya SILINIR (brief'in acik sordugu soru: evet, kapsam disi denemede de silinir).
writeGuardScope(['t-expired-other.cjs'], { createdOffsetMs: -41 * 60 * 1000 });
{
  const code = callGate(HOOK_FILE); // HOOK_FILE kapsamda DEGIL (kapsamda sadece t-expired-other.cjs var)
  const deleted = !fs.existsSync(GUARD_OK);
  fail += reportScope('(T-EXPIRED-OUT-OF-SCOPE) suresi dolmus token + kapsam disi hedef -> yine silinir', code === 2 && deleted);
}
rm(GUARD_OK); rm(GUARD_STATE);

// --- Asiri engelleme negatif kontrolleri: gecerli bir belge reddedilmemeli -------------------
writeGuardRaw(JSON.stringify({ scope: ['.claude/hooks/c-minimal.cjs'], created_at: nowIso() }));
{
  const code = callGate('.claude/hooks/c-minimal.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(C-VALID-MINIMAL) yalnizca scope+created_at (valid_minutes yok -> varsayilan) -> kabul', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

writeGuardRaw(JSON.stringify({
  scope: ['.claude/hooks/c-withreason.cjs'],
  created_at: nowIso(),
  reason: 'Bu uzun, cok satirli bir gerekce metnidir.\nBirden fazla satir icerir.\nHicbir zaman taranmaz, sadece insan icindir.',
}));
{
  const code = callGate('.claude/hooks/c-withreason.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(C-VALID-WITH-REASON) uzun cok satirli "reason" iceren gecerli belge -> kabul', code === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

writeGuardScope(['c-two-a.cjs', 'c-two-b.cjs']);
{
  const code1 = callGate('.claude/hooks/c-two-a.cjs');
  const code2 = callGate('.claude/hooks/c-two-b.cjs');
  const remains = fs.existsSync(GUARD_OK);
  fail += reportScope('(C-VALID-TWO-SCOPE) iki elemanli scope, ikisine de yazilabilir -> kabul', code1 === 0 && code2 === 0 && remains);
}
rm(GUARD_OK); rm(GUARD_STATE);

// --- Katman A (docs/qa/g5-onay-dosyasi-korumasi-contract.md): docs/approvals/** ask/blok
// testleri. DEĞİŞMEDİ — scope-ayristirma biciminden bagimsiz.
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
  const { code, stdout } = callGateCapture('docs/qa/some-unrelated-note.md');
  const ok = code === 0 && stdout === '';
  fail += reportScope('(katman A) docs/approvals DISI docs/** hala sessizce serbest (regresyon)', ok);
}

// --- G5 tur4 (docs/qa/g5-tur4-yol-kanoniklestirme-contract.md): yol kanoniklestirme
// regresyon testleri. DEĞİŞMEDİ — scope-ayristirma biciminden bagimsiz.
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
cleanupKbJunction();
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
