// PreToolUse (Bash): üç ayrı kapı + bir Katman B çifti.
//  1) Gerçek yayın komutları (deploy/publish/release)  -> docs/approvals/G6.ok (kalıcı).
//  2) git push                                         -> G6.ok VEYA docs/approvals/PUSH.ok (TEK KULLANIMLIK).
//  3) Yıkıcı komutlar ve git force                     -> docs/approvals/DANGER.ok (tek kullanımlık).
//  4) Katman B: kabuktan docs/approvals/** VE .claude/hooks/**+.claude/settings.json altına
//     yazma/silme (Y4 kapanışı — bkz aşağıdaki "SEGMENTASYON" bölümü ve docs/qa/
//     hook-borclari-contract.md). Katman A (gate-check.cjs, yalnızca Edit|Write araçlarına
//     bağlı) hiçbir zaman görmediği bir kabuk kopyalama/taşıma komutunu burada yakalar.
// Kullanıcı kararı (2026-09-04): push kapısı kalıcı olarak açılmaz; her push öncesi
// kullanıcıya sorulur ve PUSH.ok yazılır, hook onu kullanınca siler.
//
// SEGMENTASYON (B-6/Y2 kapanışı, docs/qa/hook-borclari-contract.md) — KÖK NEDEN: aşağıdaki
// `danger`/`gitForce`/`approvalsWriteVerb` gibi desenler `[^\n]*` (satır sonuna kadar HER ŞEY)
// kullanıyor ve iki-sinyalli `touchesApprovals && writeVerb` deseni tüm komut METNİNİ tek blob
// sayıyordu — yani SINIR yalnızca fiziksel satır sonuydu, kabuk ayracı (`&&`, `;`, `|`) SINIR
// SAYILMIYORDU. Sonuç: "ilgisiz alt komutların PARÇALARI birleşip masum komutları engelliyor"
// (docs/blockers.md B-6/Y2) — bir kopyalama + zincirin sonundaki ilgisiz bir okuma, salt-okunur
// bir sha256sum + zincirdeki ilgisiz bir yazma, bir commit + ayrı bir segmentte geçen bir yol/fiil
// adı gibi kombinasyonlar YANLIŞ POZİTİF üretiyordu.
//
// ÇÖZÜM: komut, kabuk ayraçlarında (`&&`, `||`, `;`, `|`, satır sonu, tek `&` — bkz M2 KAPANIŞI v4
// aşağıda) SEGMENTLERE bölünür ve HER SEGMENT aşağıdaki AYNI kurallarla AYRI AYRI değerlendirilir
// (herhangi bir segment eşleşirse komutun TAMAMI engellenir — bu yalnızca YANLIŞ POZİTİFİ azaltır,
// hiçbir segmenti muaf tutmaz).
//
// GÜVENLİK ŞARTI (asla ihlal edilmez): segmentasyon yalnızca FARKLI segmentlerdeki İKİ AYRI
// sinyalin (ör. bir segmentteki yazma fiili + BAŞKA bir segmentteki korunan yol adı) birbirini
// YANLIŞLIKLA tetiklemesini engeller. AYNI segment içinde hem fiil hem hedef varsa (gerçek bir
// yazma/silme girişimi) segmentasyon bunu ASLA gizlemez — segment yine tam metniyle taranır.
//
// GERİ ÇEKİLME (belirsizlik → bugünkü, daha kısıtlayıcı blob davranışı): ayırıcıyı GÜVENLE
// bulamıyorsak (heredoc `<<...`, komut ikamesi `$(...)`/backtick, fiziksel satır sonuna kaçan
// `\` devamı, ya da sonlandırılmamış tırnak) segmentasyona HİÇ girilmez — komut TEK bir segment
// (tüm metin) olarak değerlendirilir, yani AYNEN bugünkü (segmentasyon-öncesi) davranış. Bu, bir
// heredoc gövdesinde ya da $() içinde geçen "docs/approvals"/fiil adı gibi metinlerin hâlâ
// (kasıtlı olarak) aşırı-engellemeye yol açabileceği anlamına gelir — kabul edilmiş sınır,
// docs/qa/hook-borclari-contract.md'de belgelenmiştir. Tek/çift TIRNAK İÇİNDEKİ bir ayıraç ("a &&
// b" gibi bir metin) ayrı bir durumdur: bu, tam bir kabuk grameri gerektirmeyen, sınırlı ve
// güvenle izlenebilir bir durumdur (yalnızca "şu an bir tırnağın içinde miyim" sorusuna cevap
// verir) — bu yüzden RETREAT değil, doğru segmentasyonun bir PARÇASIDIR: tırnak içindeki metin
// asla bir ayıraç olarak sayılmaz, ama YİNE DE kendi segmentinin parçası olarak taranır (yani
// tırnak içine gizlenmiş bir hedef/fiil hâlâ yakalanır — bkz "quoted-write" testleri).
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

// splitCommandSegments(cmd) -> string[] | null
//   null  : ayrıştırma güvenli değil (heredoc/komut ikamesi/satır devamı/sonlandırılmamış tırnak)
//           — çağıran bunu [cmd] (tek segment = bugünkü blob davranışı) olarak ele almalı.
//   string[]: kabuk ayraçlarında (&&, ||, tek |, tek &, ;, satır sonu) TIRNAK-FARKINDA bölünmüş
//   parçalar.
// Bu bir kabuk ayrıştırıcısı DEĞİLDİR: pipe/redirect/glob/değişken genişletme SEMANTİĞİNİ anlamaya
// çalışmaz — yalnızca "şu an tek/çift tırnak içinde miyim" durumunu izleyerek ayıraçları GÜVENLE
// bulur. Daha karmaşık her şey (aşağıdaki retreat listesi) bilinçli olarak ele alınmaz.
// M1 KAPANIŞI (docs/qa/hook-borclari-contract.md B1 — 2026-09-14 regresyonu). KÖK SORUN: `cd`
// (ve eşdeğerleri) ÇALIŞMA DİZİNİNİ DEĞİŞTİRİR; ondan SONRAKİ segmentlerdeki GÖRELİ yollar artık
// BAŞKA bir dizine bakar. "Her segment kendi başına, komşularından bağımsız değerlendirilir"
// varsayımı `cd docs/approvals && rm G5.ok` gibi bir zincirde GEÇERSİZDİR: `rm G5.ok` segmenti
// tek başına "G5.ok" bareli, korunan hiçbir yolu ANMAZ — segment-yerel akıl yürütme bunu güvenli
// sanar, ama önceki `cd` onu docs/approvals'ın İÇİNE taşımıştır. Segmentasyon bunu 12/12 gerçek
// saldırıda (R1-R12) kaçırdı (ölçüm: docs/qa/hook-borclari-contract.md §1.2).
// ÇÖZÜM: çalışma dizinini DEĞİŞTİREN bir komut GÖRÜLDÜĞÜNDE segmentasyona HİÇ GİRİLMEZ — diğer
// retreat'lerle (heredoc/$()/satır devamı) AYNI mekanizma: `null` dönülür, çağıran komutun
// TAMAMINI TEK blob olarak tarar (bugünkü, segmentasyon-öncesi kısıtlayıcı davranış). Bu, "hangi
// dizine geçildi" sorusunu ÇÖZMEYE çalışmaz (tam bir kabuk yorumlayıcısı gerektirir) — yalnızca
// "bu durumda segment-yerel akıl yürütemem" der ve daha kısıtlayıcı tarafa düşer.
// BİLEREK EKLENEN aile: `cd`, `pushd`, `popd`, `chdir` (cmd.exe eşdeğeri), `Set-Location`,
// `Push-Location`, `Pop-Location` (PowerShell TAM adları — kısaltmasız, ayırt edici, yanlış
// pozitif riski düşük).
// BİLEREK EKLENMEYEN: PowerShell `sl` (Set-Location'ın ÇOK KISA takma adı). Gerekçe: (1) R1-R12
// saldırı vektörlerinin HİÇBİRİ `sl` kullanmıyor — eklemek bu turun ölçülen kabul kriterine hiçbir
// katkı sağlamıyor; (2) iki harfli bir token, `\b` sınırına rağmen masum metinde (değişken adı,
// kısaltma, dosya adı parçası) beklenenden daha sık rastlanabilir ve blob'a çökmek gereksiz
// SÜRTÜNME (aşırı engelleme) yaratır; (3) aşağıdaki BARE-ARTIFACT korelasyonu (M1'den BAĞIMSIZ,
// `cd` İÇERMEYEN R9/R11/R12 ailesini zaten kapatan ikinci bir mekanizma) `sl` kullanan bir
// saldırıyı da YAKALAR — yani `sl`'i dışlamak bu turun ölçülen R1-R12/F1-F10 matrisinde bir
// boşluk AÇMIYOR, yalnızca gereksiz aşırı-engellemeyi önlüyor.
// NOT (stil tutarlılığı): diğer retreat kontrolleri gibi bu da TIRNAK-FARKINDA DEĞİL — "cd" bir
// tırnaklı metin İÇİNDE geçse bile (ör. `echo "please cd to src"`) retreat tetiklenir. Bu KASITLI:
// sonucu her zaman AŞIRI ENGELLEMEYE gider (blob taraması), ASLA atlatmaya değil — güvenlik kaybı
// yok, yalnızca ihtiyaç dışı ekstra tarama.
const WD_CHANGE = /\b(cd|pushd|popd|chdir|Set-Location|Push-Location|Pop-Location)\b/i;

function splitCommandSegments(cmd) {
  // Retreat 1: heredoc (`<<EOF`, `<<-EOF`, `<<~EOF`, `<<'EOF'`, `<<<` herestring dahil). Heredoc
  // gövdesi birden çok fiziksel satıra yayılır ve içeriği kabuk tarafından hiç yorumlanmaz —
  // ayırıcı arama burada anlamsızdır, blob'a çekiliriz.
  if (cmd.indexOf('<<') !== -1) return null;
  // Retreat 2: komut ikamesi ($(...) veya backtick). İç içe bir alt kabuk kendi ayraçlarını
  // taşıyabilir; dışarıdan güvenle ayrıştırılamaz.
  if (cmd.indexOf('$(') !== -1 || cmd.indexOf('`') !== -1) return null;
  // Retreat 3: fiziksel satır devamı (`\` + satır sonu) — tek mantıksal komut birden çok fiziksel
  // satıra yayılmış, "satır sonu" ayıracının burada ne anlama geldiği belirsiz.
  if (/\\\r?\n/.test(cmd)) return null;
  // Retreat 4 (M1 KAPANIŞI): çalışma dizinini değiştiren bir komut var — yukarıdaki uzun yorum.
  if (WD_CHANGE.test(cmd)) return null;

  const segments = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  const n = cmd.length;
  let i = 0;
  while (i < n) {
    const c = cmd[i];
    if (inSingle) {
      cur += c;
      if (c === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (c === '\\' && i + 1 < n) { cur += c + cmd[i + 1]; i += 2; continue; }
      cur += c;
      if (c === '"') inDouble = false;
      i++;
      continue;
    }
    // Tırnak dışında: kaçışlı karakter literal sayılır, ayıraç kontrolüne HİÇ girmez (`\&\&`
    // gibi kaçışlı bir ayıraç asla bölünmez).
    if (c === '\\' && i + 1 < n) { cur += c + cmd[i + 1]; i += 2; continue; }
    if (c === "'") { inSingle = true; cur += c; i++; continue; }
    if (c === '"') { inDouble = true; cur += c; i++; continue; }
    if (c === '&' && cmd[i + 1] === '&') { segments.push(cur); cur = ''; i += 2; continue; }
    // M2 KAPANIŞI v4 (tek `&` — bkz aşağıdaki büyük yorum bloğu, "OKUMA-KOMUTU BEYAZ LİSTESİ").
    // Tek `&` (arka plana alma) da bir ayıraçtır — AMA iki kaçış durumu ayıraç SAYILMAZ:
    //  (a) `N>&M` (dosya tanıtıcı çoğaltma, ör. `2>&1`) — buradaki `&` bir ayraç değil, YÖNLENDİRME
    //      SÖZDİZİMİNİN parçasıdır (hemen ÖNCESİNDE `>` var).
    //  (b) `&>`/`&>>` (bash'in "hem stdout hem stderr" kısayolu) — buradaki `&` da bir ayıraç
    //      değil, YÖNLENDİRME sözdiziminin parçasıdır (hemen SONRASINDA `>` var).
    // Bu iki durum dışında tek `&` güvenle bir ayıraç olarak bölünebilir (ölçüldü: mevcut 312
    // vakalık self-test'te `2>&1` HARİCİNDE hiçbir vaka tek `&` içermiyor — bkz
    // docs/qa/hook-allowlist-contract.md §"& kararı").
    if (c === '&' && cmd[i - 1] !== '>' && cmd[i + 1] !== '>') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === '|' && cmd[i + 1] === '|') { segments.push(cur); cur = ''; i += 2; continue; }
    if (c === '|') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === ';') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === '\n') { segments.push(cur); cur = ''; i += 1; continue; }
    cur += c;
    i++;
  }
  segments.push(cur);
  // Retreat 5: sonlandırılmamış tırnak — dosyanın/komutun nerede bittiği güvenle bilinemez.
  if (inSingle || inDouble) return null;
  const trimmed = segments.map((s) => s.trim()).filter((s) => s.length > 0);
  return trimmed.length ? trimmed : [cmd];
}

// =============================================================================================
// M2 KAPANIŞI v4 (docs/qa/hook-allowlist-contract.md — 2026-09-15, iki adımlı kararın 2. adımı).
// v3 tırnak muafiyetini TAMAMEN KALDIRMIŞTI (fiil her zaman, tırnak içinde de sayılır) — bu N/S/
// NEST ailelerini kapattı ama F2/F3/F4/F5/F9 + CEO'nun 6. FP vektörünü (`sleep 0 & grep ...`)
// YENİDEN yanlış pozitif yaptı (bkz yukarıdaki dosya-başı NOT ve _selftest.cjs TUR 6 yorumu).
//
// v4 ÇÖZÜMÜ: "tırnak içinde mi?" sorusunun YERİNE "bu segmentin BAŞ KOMUTU bilinen bir OKUYUCU
// mu?" sorusu geçti. OKUYUCU TANIMI: bir komut, KEYFİ argümanlarla çağrıldığında KEYFİ bir yola
// YAZAMIYOR/SİLEMİYORSA okuyucudur. Şüphe varsa okuyucu DEĞİLDİR (fail-closed).
//
//  Etki 1 (MUAFİYET, daha az engelleme): baş komut OKUYUCU ise, o segmentin YALNIZCA
//  TIRNAKLANMIŞ argümanlarındaki fiil/satır-içi-betik eşleşmeleri SAYILMAZ (maskQuoted). Tırnak
//  DIŞINDAKİ eşleşmeler ve YÖNLENDİRME (`>`/`>>`) kontrolleri HİÇBİR ZAMAN muaf değildir — bir
//  okuyucu bile `> docs/approvals/G5.ok` ile hedefe yazabilir (bkz `echo x > ...` testi, "echo"
//  OKUYUCU listesinde ama redirect kontrolü ham metinde kalır).
//
//  Etki 2 (VARSAYILAN ŞÜPHE, daha çok engelleme): CEO'nun 8 vektörlük "mutlak sızıntı" listesi
//  (find -delete/-exec, xargs, dd, install, ln, chmod, truncate) `writeVerb` kara listesinde HİÇ
//  yer almıyordu. Bunları KÖRÜ KÖRÜNE "baş komut beyaz listede değilse VE segment bir yol anıyorsa
//  engelle" kuralıyla kapatmak ÖLÇÜLDÜ ve REDDEDİLDİ: bu, `find docs/approvals -name "*.ok"`
//  (salt-okunur, ceo-fresh.mjs U2), `git add`/`git commit` (mevcut Y4-READ-3/4 testleri), `sh -c
//  'ls docs/approvals'` (NEST-NEG-1) gibi ONLARCA MEVCUT/PROB VAKAYI YENİ YANLIŞ POZİTİFE
//  çevirirdi (git/sh/bash/eval/powershell "okuyucu" DEĞİL ama zaten BAŞKA mekanizmalarla —
//  ham/tırnaksız fiil taraması, git alt-komut ailesi — doğru yönetiliyorlar; onları "bilinmeyen"
//  sayıp salt mention'a göre engellemek gereksiz, ölçülmüş bir regresyon açardı).
//  Bunun YERİNE Etki 2, `find`/`xargs`'ın DIŞINDAKİ 6 vektör için `writeVerb`'e HEDEFLİ yeni üye
//  eklenerek (install/ln/chmod/chown/truncate/dd-of=) kapatıldı — bunlar İSTİSNASIZ yazma/mutasyon
//  fiilleridir (find'ın aksine "salt okunur kullanım" biçimleri yoktur), bu yüzden onları
//  `writeVerb`'e eklemek "kara listeyi büyütme" riskini taşımaz (mevcut `writeVerb` zaten böyle
//  fiillerin toplandığı yer). `find` kendi flag'e-bağlı DAR deseniyle (aşağıda `findDestructive`),
//  `xargs` ise kendi flag koşulsuz-fiil deseniyle (`xargsDestructive`) + PIPE ÖNCESİ segment
//  mention korelasyonuyla (aşağıda `checkXargsPipeLeak`) ayrı ele alındı — ikisi de "salt okunur
//  kullanımı YAYGIN olan komutlar" olduğu için blanket İSTİSNAsız engellemeye ALINMADI.
//  Ölçüm ve gerekçe tam tablo: docs/qa/hook-allowlist-contract.md.
// =============================================================================================

// OKUYUCU BEYAZ LİSTESİ (Etki 1). Her üye "KEYFİ argümanla KEYFİ yola yazamaz/silemez" testini
// geçer. Koşullu üyeler (sed/git) ayrı fonksiyonlarla değerlendirilir (aşağıda).
const READER_HEADS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'findstr',
  'awk', 'nl', 'od', 'xxd', 'strings', 'stat', 'file', 'cmp', 'diff', 'ls', 'dir', 'tree',
  'basename', 'dirname', 'realpath', 'readlink', 'echo', 'printf', 'type', 'which', 'where',
  'get-content', 'select-string', 'get-childitem', 'get-item',
]);
// Baş komut çözümlemesinde atlanan öneki kelimeler (M2-PREFIX ailesi, v1'den kalan onek listesi
// — BURADA farklı bir amaçla kullanılıyor: "gerçek komut ne?" sorusuna cevap için, ayıraç
// belirlemek için DEĞİL).
const HEAD_SKIP_PREFIX = new Set(['sudo', 'env', 'time', 'exec', 'command', 'nice', 'nohup', 'builtin']);

// getHeadCommand(seg) -> string ("" ise çözülemedi, OKUYUCU/OPAK sayılmaz -> fail-closed)
// Bir segmentin GERÇEK baş komutunu bulur: başındaki boşluk/gruplama (`(`,`{`,`!`) karakterlerini,
// `VAR=deger` atamalarını ve HEAD_SKIP_PREFIX öneklerini atlayarak ilk "gerçek" token'a ulaşır.
// Bu bir kabuk ayrıştırıcısı DEĞİLDİR — yalnızca token sınırlarını (boşluk) izler; tırnaklı ilk
// token nadir olduğu için tırnak-farkında DEĞİLDİR (fail-closed: tırnaklı/garip bir baş token
// büyük ihtimalle beyaz listeye ZATEN uymaz, dolayısıyla OKUYUCU sayılmaz — güvenlik kaybı yok).
function getHeadCommand(seg) {
  let s = seg;
  for (;;) {
    const trimmed = s.replace(/^\s+/, '');
    if (trimmed !== s) { s = trimmed; continue; }
    if (/^[({!]/.test(s)) { s = s.slice(1); continue; }
    break;
  }
  for (;;) {
    s = s.replace(/^\s+/, '');
    const m = /^(\S+)/.exec(s);
    if (!m) return '';
    const tok = m[1];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) { s = s.slice(tok.length); continue; }
    if (HEAD_SKIP_PREFIX.has(tok.toLowerCase())) { s = s.slice(tok.length); continue; }
    return tok.replace(/^\\/, '').replace(/^["']+|["']+$/g, '');
  }
}

// GIT_READ_SUBCOMMANDS — git yalnızca BU alt komutlarla OKUYUCU sayılır (brief kararı). Diğer
// tüm alt komutlar (add/commit/rm/checkout/reset/push/mv/apply/stash/...) OKUYUCU DEĞİLDİR —
// ama zaten kendi mekanizmalarıyla (gitForce, writeVerb'in `\brm\b` eşleşmesi, `release`/`pushCmd`)
// yönetiliyorlar; Etki 2'nin "bilinmeyen baş komut" kovasına düşmezler (bkz KNOWN_NONREADER_HEADS).
const GIT_READ_SUBCOMMANDS = new Set(['log', 'diff', 'show', 'status', 'blame', 'grep', 'cat-file', 'ls-files', 'rev-parse']);
function isGitReader(seg) {
  const m = /\bgit\b\s+(?:--[\w-]+(?:=\S+)?\s+)*([A-Za-z-]+)/i.exec(seg);
  if (!m) return false;
  return GIT_READ_SUBCOMMANDS.has(m[1].toLowerCase());
}
// sed yalnızca `-i` (yerinde düzenleme) YOKSA OKUYUCU sayılır — `-i` varsa zaten `writeVerb`
// (`\bsed\b[^\n]*-i\b`) onu yakalar, reader sayılması hiçbir şeyi DEĞİŞTİRMEZ (aşağıdaki
// maskQuoted yalnızca "sayılmayan" eşleşmeleri etkiler; `-i` varken segment zaten OKUYUCU
// listesine ALINMAYACAK, bkz isReaderHead).
const SED_INPLACE_RE = /\bsed\b[^\n]*-i\b/i;

// KNOWN_NONREADER_HEADS — "bilinmeyen baş komut" (Etki 2'nin varsayılan-şüphe eşiği) DEĞİLDİR;
// bunlar ya kendi ÖZEL desenleriyle (git/gitForce, writeVerb ailesi, inlineEval, release/pushCmd,
// alt-kabuk çağırıcıları) YÖNETİLİYOR ya da başlı başına zararsız/çok yaygın (npm) ve BAŞKA bir
// sinyal (release deseni, writeVerb) olmadan salt varlıklarıyla hiçbir şeyi tetiklemiyor. Bu
// kümedeki bir baş komut Etki 2'yi (varsayılan şüphe) TETİKLEMEZ — yalnızca YUKARIDAKİ mevcut
// mekanizmalarla değerlendirilir (v3'ten değişmeden). Alt-kabuk ailesi (sh/bash/eval/powershell/
// cmd) BİLEREK burada: OKUYUCU değiller (Etki 1 muafiyeti yok, tırnak içi fiil hâlâ sayılır — NEST
// ailesi bu sayede kapalı kalır) AMA Etki 2'nin "bilinmeyen komut" şüphesine de girmiyorlar (aksi
// halde `sh -c 'ls docs/approvals'` gibi salt-okunur alt-kabuk çağrıları YENİ yanlış pozitif
// olurdu — ölçüldü, bkz docs/qa/hook-allowlist-contract.md).
const KNOWN_NONREADER_HEADS = new Set([
  'git', 'cp', 'copy', 'mv', 'move', 'ren', 'rename', 'sed', 'tee',
  'set-content', 'out-file', 'add-content', 'new-item', 'remove-item',
  'del', 'erase', 'rm', 'unlink', 'rd', 'rmdir', 'ri', 'mklink',
  'node', 'python', 'py', 'ruby', 'perl', 'npx', 'npm',
  'vercel', 'fly', 'railway', 'gh', 'eas',
  'sh', 'bash', 'zsh', 'cmd', 'powershell', 'pwsh', 'eval', 'source',
  // find/xargs KASITLI OLARAK burada DEĞİL — kendi özel dar mekanizmalarına sahipler
  // (findDestructive/xargsDestructive + checkXargsPipeLeak), ne OKUYUCU ne "zaten yönetiliyor"
  // kovasına konmadılar; ayrı işlenmeleri bilinçli (yukarıdaki büyük M2 v4 yorumuna bkz).
]);

function isReaderHead(head, seg) {
  const h = head.toLowerCase();
  if (!h) return false;
  if (h === 'sed') return !SED_INPLACE_RE.test(seg);
  if (h === 'git') return isGitReader(seg);
  return READER_HEADS.has(h);
}

// maskQuoted(seg) -> string: tek/çift TIRNAK İÇİNDEKİ karakterleri boşlukla değiştirir (tırnak
// karakterlerinin kendisi ve tırnak DIŞINDAKİ her şey OLDUĞU GİBİ kalır). Yalnızca OKUYUCU baş
// komutlu segmentlerde, YALNIZCA fiil/satır-içi-betik eşleşmesi için kullanılır — YÖNLENDİRME
// (`>`/`>>`) kontrolleri HER ZAMAN ham (maskesiz) metin üzerinde çalışır (bkz Etki 1 yorumu).
function maskQuoted(seg) {
  let out = '';
  let inSingle = false;
  let inDouble = false;
  const n = seg.length;
  let i = 0;
  while (i < n) {
    const c = seg[i];
    if (inSingle) {
      out += c === "'" ? (inSingle = false, c) : ' ';
      i++;
      continue;
    }
    if (inDouble) {
      if (c === '\\' && i + 1 < n) { out += '  '; i += 2; continue; }
      if (c === '"') { inDouble = false; out += c; i++; continue; }
      out += ' ';
      i++;
      continue;
    }
    if (c === '\\' && i + 1 < n) { out += c + seg[i + 1]; i += 2; continue; }
    if (c === "'") { inSingle = true; out += c; i++; continue; }
    if (c === '"') { inDouble = true; out += c; i++; continue; }
    out += c;
    i++;
  }
  return out;
}

readInput((j) => {
  const cmd = (j.tool_input && j.tool_input.command) || '';
  if (!cmd) process.exit(0);

  const segmented = splitCommandSegments(cmd);
  // Belirsizlik DAİMA bugünkü (kısıtlayıcı) davranışa çözülür: ayrıştırılamıyorsa TEK segment
  // (tüm metin) — yani segmentasyon-öncesi blob taraması, hiçbir güvenlik kaybı yok.
  const segments = segmented || [cmd];

  // Yayın: kod kullanıcıdan başkasına ulaşır veya para/servis tetiklenir.
  const release = /\b(vercel(\s+--prod)?\b|fly\s+deploy|railway\s+up|gh\s+release|npm\s+publish|eas\s+submit|eas\s+build\b.*--auto-submit)/i;
  // Push: uzak depoya yazar ama yayın değil (private depo + CI için gerekli).
  const pushCmd = /\bgit\s+push\b/i;
  // Genel yıkıcı komutlar — büyük/küçük harf duyarsız.
  // NOT (docs/qa/G5-guvenlik-denetimi-2026-09-10.md K2): bu bir KARA LİSTEdir — derinlik
  // katmanıdır, MUTLAK engel değildir. Bu depoda kara listeler dört kez yenildi
  // (docs/wiki/pages/desen/cit-tasarimi.md §1); kabuk komutları için beyaz liste pratik değil.
  // Asıl koruma kullanıcının gördüğü izin kartıdır (`canUseTool`, ADR-014) — bu hook yalnızca
  // erken/okunaklı bir uyarı ve tek-kullanımlık DANGER.ok ritüelini tetikler. `rd`/`rmdir`/`del`
  // bayrak sırasından bağımsız (lookahead) eşleşir; ADR-009 bu proje yalnızca Windows olduğu
  // için Windows'un kendi silme komutları da kapsanır.
  // GG2 (docs/qa/g5-guvenlik-duzeltme-tur3-contract.md madde 2): `ri -r...` PowerShell
  // kısaltma zinciri — -r, -re, -rec, -recu, -recur, -recurs, -recurse hepsi kapsanır
  // (iç içe opsiyonel gruplar, harf sırasını bozmadan kısmi yazımları yakalar). Zararsız
  // `ri` kullanımı (bayraksız veya farklı bir bayrakla, ör. `ri -Force`/`ri -Recreate`)
  // etkilenmez çünkü grup yalnızca tam "recurse" harf dizisini adım adım takip eder.
  // docs/qa/g5-tur4-yol-kanoniklestirme-contract.md §4 (kabul edilmiş sınır) — asıl düzeltme
  // gate-check.cjs'in kanonikleştirmesidir (junction'ın ARKASINA bakar); bu satır yalnızca
  // derinlik katmanını tutarlı hale getirir. `New-Item -ItemType Junction/SymbolicLink` zaten
  // yakalanıyordu (`New-Item` genel deseni), ama AYNI sonucu üreten `mklink` (bayraksız veya
  // `/J`/`/D`/`/H` ile) yakalanmıyordu — iki eşdeğer komuttan biri korumalı, diğeri değildi
  // (docs/qa/G5-guvenlik-denetimi-2026-09-10-tur4.md 4-Ek2).
  // NOT (B-6 segmentasyonu, docs/qa/hook-borclari-contract.md): `[^\n]*` bu desenin İÇİNDE hâlâ
  // kullanılıyor ama artık zararsız — her `danger.test(...)` çağrısı TEK BİR segmente uygulanıyor,
  // ve segment tanımı gereği kendi içinde `&&`/`;`/`|` İÇERMEZ (bunlar segment sınırlarıdır).
  // Yani `[^\n]*` artık yalnızca AYNI segment içindeki bayrak/argüman mesafesini kapsar, BAŞKA bir
  // zincirlenmiş komuta asla sızmaz (eskiden `git log && npm run build --force` gibi bir zincirde
  // `gitForce` yanlışlıkla "git ... --force" eşleşmesi üretiyordu — artık segmentler ayrı).
  const danger = /(\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bdrop\s+(table|database)\b|Remove-Item[^\n]*-Recurse|\btruncate\s+table\b|\b(rd|rmdir)\b[^\n]*\/s\b|\b(del|erase)\b(?=[^\n]*\/[sq]\b)|\bri\b[^\n]*-r(e(c(u(r(s(e)?)?)?)?)?)?\b|\bmklink\b)/i;
  // git force — harf duyarlı OLMALI: "-f" force'tur ama "-F" commit mesajını dosyadan okur (zararsız).
  // Duyarsız eşleşme "git commit -F" gibi normal komutları yanlışlıkla engelliyordu.
  const gitForce = /\bgit\b[^\n]*\s(--force\b|--force-with-lease\b|-f\b)/;

  // docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman B (bypass envanteri madde 2/3) — kabuktan
  // korunan yollara yazma/silme. Bu da bir KARA LİSTEdir (aynı NOT geçerli — derinlik katmanı,
  // mutlak değil). İki alt-sınıf:
  //  b1) klasik yazma/silme fiili (yönlendirme, cp/mv/tee/sed -i, Windows/PowerShell eşdeğerleri,
  //      POSIX rm/unlink — bkz "RM KAPANIŞI" notu aşağıda)
  //      + komut metninde korunan yol geçmesi (AYNI SEGMENTTE — aşağıya bkz).
  //  b2) satır içi betik (node -e/--eval, npx tsx -e, python -c) + AYNI SEGMENTTE korunan yol
  //      geçmesi — betiğin GERÇEKTEN yazıp yazmadığı metinden güvenilir anlaşılamaz (obfuscation,
  //      ör. fs['writeFileSync']), bu yüzden KASITLI OLARAK geniş: içerik yazma fiili taşımasa
  //      bile engellenir. QA'nın §0.2/§0.3 birebir istismarı (`node -e "require('fs').
  //      writeFileSync('docs/approvals/GUARD.ok', ...)"`) bu sınıfa girer.
  //
  // Y4 KAPANIŞI (docs/blockers.md): eskiden bu katman YALNIZCA docs/approvals'ı koruyordu;
  // .claude/hooks/** ve .claude/settings.json'ın kabuktan (Edit|Write araçları DIŞINDA) yazılmasını
  // hiçbir şey engellemiyordu — gate-check.cjs (Katman A, GUARD.ok) yalnızca Edit|Write araçlarına
  // bağlı olduğu için bir `cp`/`mv` kabuk komutu o kapıyı hiç görmüyordu. Artık AYNI b1/b2
  // mekanizması iki AYRI hedef ailesi için ayrı ayrı çalıştırılıyor: docs/approvals/** VE
  // .claude/hooks/**+.claude/settings.json. Okuma (cat/ls/git add/git commit/git diff) hiçbir
  // zaman engellenmez — yalnızca (mention + yazma fiili) AYNI SEGMENTTE ya da doğrudan yönlendirme
  // hedefi eşleşirse engellenir.
  //
  // RM KAPANIŞI (docs/qa/hook-borclari-contract.md §8-ek, CEO'nun probe-segment.mjs E1/E2
  // sondası): `writeVerb` bayraksız `del`/`erase`/`rd`/`rmdir`/`ri` (Windows/PowerShell silme
  // fiilleri) içeriyordu ama bu ortamın VARSAYILAN kabuğunun (Git Bash, POSIX) birincil silme
  // fiili olan bayraksız `rm`'i HİÇ içermiyordu — tutarsız bir boşluk, atlatma değil eksiklikti.
  // Eklenen: `rm` ve `unlink` (ikisi de tek adımda, bayraksız TEK dosya siler; `rm -rf` zaten
  // `danger` deseninde ayrı ve bağımsız olarak yakalanıyor, bu ikisi ONU BOZMAZ, yalnızca
  // bayraksız tekil silmeyi de aynı muameleye sokar). `\brm\b` kelime-sınırlı olduğu için `git rm`
  // de OTOMATİK kapsanır (ekstra desen gerekmedi — `\brm\b` "git" ön ekinden bağımsız eşleşir).
  //
  // M2 KAPANIŞI v4 EKLERİ (docs/qa/hook-allowlist-contract.md — Etki 2, yukarıdaki büyük yorum):
  // `install`/`ln`/`chmod`/`chown` İSTİSNASIZ mutasyon fiilleridir (find'ın aksine salt-okunur
  // kullanım biçimleri yoktur) — doğrudan `writeVerb`'e eklendi. `truncate` (SQL `truncate table`
  // HARİÇ, o zaten `danger`'da ayrı) dosya sıfırlama — İSTİSNASIZ mutasyon, eklendi. `dd`
  // yalnızca `of=` (çıktı dosyası) varsa mutasyon sayılır (`of=` yoksa yalnızca okur/kopyalar
  // stdout'a) — ayrı `ddWrite` deseni.
  const ddWrite = /\bdd\b[^\n]*\bof=/i;
  const writeVerb = /(\btee\b|\bcp\b|\bcopy\b|\bmv\b|\bmove\b|\bren(?:ame)?\b|\bsed\b[^\n]*-i\b|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b|\bNew-Item\b|\bRemove-Item\b|\b(del|erase|rm|unlink)\b|\brd\b|\brmdir\b|\bri\b|\binstall\b|\bln\b|\bchmod\b|\bchown\b|\btruncate\b(?!\s+table\b))/i;
  const inlineEval = /(\bnode\b[^\n]*(-e\b|--eval\b)|\bnpx\s+tsx\b[^\n]*-e\b|\bpython\b[^\n]*-c\b)/i;
  // find — SALT-OKUNUR kullanım (listeleme/arama) YAYGIN (`find docs/approvals -name "*.ok"`,
  // ceo-fresh.mjs U2/U3) — bu yüzden `writeVerb`'e KATILMADI (bilerek, bkz kod içi eski not
  // "BİLEREK EKLENMEYENLER" aşağıda kaldırılmadı, hâlâ geçerli). Yalnızca AÇIKÇA yıkıcı biçimi
  // (`-delete` ya da `-exec ... <yazma/silme fiili>`) bir sinyal sayılır.
  const findDestructive = /\bfind\b[^\n]*(-delete\b|-exec\b[^\n]*\b(rm|mv|cp|tee|unlink|del|erase|chmod|dd|truncate|ln)\b)/i;
  // xargs — stdin'den GELEN veriyi bir komuta ARGÜMAN olarak enjekte eder; `xargs rm` gibi bir
  // kullanımda hedef genellikle BAŞKA (piped) bir segmentte yazılıdır, bu segmentin kendisinde
  // DEĞİL. Bu yüzden normal same-segment mention kontrolüne ek olarak checkXargsPipeLeak (aşağıda)
  // ayrı bir kontrol yapar. `xargsDestructive` burada yalnızca "bu segment TEHLİKELİ bir xargs
  // kullanımı mı" sorusuna cevap verir (writeVerb'in xargs gövdesinde de eşleştiğini teyit eder).
  const xargsDestructive = /\bxargs\b[^\n]*\b(rm|mv|cp|tee|unlink|del|erase|chmod|chown|dd|truncate|ln|sed)\b/i;

  const approvalsRef = /docs[\\/]approvals\b/i;
  const hooksRef = /\.claude[\\/](hooks\b|settings\.json\b)/i;
  // Yönlendirme (`>`/`>>`) AYRI ve DAR bir desendir — hedefin GERÇEKTEN korunan yola baktığını
  // ister, aksi hâlde `cat docs/approvals/G5.ok 2>/dev/null` gibi tamamen zararsız, hedefi başka
  // yere (stderr'e) yönlendiren okuma komutları yanlış pozitif alırdı (ilk sürümde tam bu oldu,
  // elle bulundu ve düzeltildi). BU KONTROLLER HER ZAMAN HAM METİN ÜZERİNDE ÇALIŞIR — OKUYUCU
  // muafiyeti (Etki 1) bunlara UYGULANMAZ (bkz yukarıdaki M2 v4 yorumu).
  const approvalsRedirect = /(>>|>(?!=))\s*['"]?docs[\\/]approvals\b/i;
  const hooksRedirect = /(>>|>(?!=))\s*['"]?\.claude[\\/](hooks\b|settings\.json\b)/i;
  const genericRedirect = /(>>|>(?!=))/;

  // A5 KAPANIŞI (docs/qa/hook-borclari-contract.md — CEO'nun diferansiyel sondası, probe-extra.mjs
  // A5: `X=docs/approvals; rm $X/G5.ok`). KÖK SORUN: yukarıdaki "önünde `/` varsa açık yol, belirsiz
  // DEĞİL, atla" kuralı yalnızca hedefin BİR DİZİN ADIYLA açıkça nitelendiğini varsayıyordu — ama bir
  // kabuk DEĞİŞKENİ (`$X/G5.ok`) ya da göreli-dizin kısayolu (`./G5.ok`) de aynı şekilde `/` ile biter
  // ve GERÇEKTE hangi dizine baktığı segment METNİNDEN BAĞIMSIZ olarak BELİRSİZDİR (`X` başka bir
  // segmentte -- ya da hiç -- atanmış olabilir; tam bir kabuk yorumlayıcısı gerektirir). Blob taraması
  // (segmentasyon-öncesi davranış) bu vektörü YAKALIYORDU (tüm metin tek parça tarandığı için "rm" ve
  // "docs/approvals" aynı blobdaydı); segmentasyon bunu KAÇIRIYORDU (A5 = REGRESYON, blob ENGELLİYOR,
  // aday GEÇİRİYORDU) — bu turun merkezi şartını ("aday, blob'un engellediği hiçbir şeyi geçirmemeli")
  // ihlal ediyordu.
  // ÇÖZÜM: `/` ya da `\` öncesindeki hemen önceki TOKEN'a bak — eğer bu token bir kabuk DEĞİŞKENİ
  // (`$X`, `${X}`, tırnaklı `"$X"`/`'$X'`) ya da göreli-dizin kısayolu (`.`/`..`) İSE, önündeki `/`
  // bir "açık yol" SAYILMAZ (çünkü gerçek hedef hâlâ çözülmemiştir) — bu durumda BARE kabul edilip
  // normal bare-artifact akışına (cross-segment mention + write-action şartı DEĞİŞMEDİ) girer.
  // Literal bir dizin adı (`/tmp/`, `build/`, `docs/approvals/` bizzat) ÖNCEKİ gibi açık yol sayılır
  // ve atlanır — BARE-NEG-1 (`cp /tmp/backup.ok /tmp/restore.ok`) bu yüzden hâlâ GEÇER, çünkü "tmp"
  // ne bir değişken ne bir nokta-kısayolu.
  // KABUL EDİLEN SINIR (dürüstçe): bu, "değişken/nokta öneki = belirsiz" diyen dar bir sözdizimsel
  // kural — `X=/tmp; rm $X/G5.ok` gibi GERÇEKTEN docs/approvals DIŞINA yazan bir değişken de (docs/
  // approvals başka bir segmentte anıldığı için) yanlışlıkla engellenebilir. Bu AŞIRI ENGELLEME
  // yönündedir (güvenlik kaybı değil) ve dosya başındaki "bare-artifact" mekanizmasının zaten kabul
  // ettiği sınırın (argüman-yapısını ayırt etmeme) doğal bir uzantısıdır.
  const HOOK_FILENAME_RE = /^(gate-check\.cjs|block-dangerous\.cjs|_selftest\.cjs|_common\.cjs|settings\.json)$/i;
  const BARE_ARTIFACT_SCAN_RE = /([\w.-]+\.ok|gate-check\.cjs|block-dangerous\.cjs|_selftest\.cjs|_common\.cjs|settings\.json)/gi;
  const AMBIGUOUS_PREFIX_RE = /(?:^|[\s;&|(])["']?(?:\.{1,2}|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)["']?[\\/]$/;
  function findBareProtectedArtifacts(segment) {
    const found = { ok: false, hook: false };
    BARE_ARTIFACT_SCAN_RE.lastIndex = 0;
    let m;
    while ((m = BARE_ARTIFACT_SCAN_RE.exec(segment))) {
      const before = m.index > 0 ? segment[m.index - 1] : '';
      if (before === '/' || before === '\\') {
        // Görünüşte açık bir yol ("<seyler>/ARTEFAKT") -- ama önek bir DEĞİŞKEN ya da göreli-dizin
        // kısayoluysa (A5 KAPANIŞI, yukarıdaki yorum) hedef GERÇEKTE belirsizdir, atlanmaz.
        const prefix = segment.slice(0, m.index);
        if (!AMBIGUOUS_PREFIX_RE.test(prefix)) continue; // gercekten literal dizin -> acik yol, atla
      }
      if (HOOK_FILENAME_RE.test(m[0])) found.hook = true;
      else found.ok = true; // geriye kalan tek desen ailesi *.ok
    }
    return found;
  }

  // effectiveVerbText(seg, reader) -> writeVerb/inlineEval eşleşmesi için kullanılacak metin.
  // OKUYUCU segmentlerde tırnaklı argümanlar maskelenir (Etki 1); OKUYUCU DEĞİLSE ham metin
  // (v3/v0 davranışı — fiil her yerde, tırnak içinde de sayılır).
  function effectiveVerbText(seg, reader) {
    return reader ? maskQuoted(seg) : seg;
  }
  function segmentHasWriteAction(seg, effText) {
    return writeVerb.test(effText) || inlineEval.test(effText) || genericRedirect.test(seg) || ddWrite.test(effText) || findDestructive.test(effText) || xargsDestructive.test(effText);
  }

  // checkXargsPipeLeak(segments, idx) -> 'approvals' | 'hooks' | null
  // xargs'ın kendi ARGÜMANI olarak KORUNAN bir yol GEÇMEZ (stdin'den gelir) — bu yüzden normal
  // same-segment mention kontrolü bu vektörü KAÇIRIR (`echo docs/approvals/G5.ok | xargs rm`).
  // Bu, DAR ve İZOLE bir düzeltmedir: yalnızca baş komutu `xargs` OLAN ve xargsDestructive'e uyan
  // bir segment için, dizide HEMEN ÖNCESİNDEKİ segmentin (hangi ayraçla ayrıldığından bağımsız —
  // segments dizisi zaten sırayı korur) approvals/hooks anıp anmadığına bakar. Bu, B-6/Y2'nin
  // yeniden-açtığı "İKİ AYRI segmentteki sinyalin GENEL OLARAK birleşmesi" hatasını TEKRARLAMAZ:
  // yalnızca `xargs` baş komutuna (nadir, kendine özgü stdin-argüman-enjeksiyon semantiği olan TEK
  // bir komut) ve yalnızca dizideki HEMEN ÖNCEKİ komşuya (herhangi bir uzak segmente değil)
  // bakıyor — bare-artifact korelasyonunun "herhangi bir segment" genişliğinden daha dar.
  function checkXargsPipeLeak(segs, idx) {
    if (idx === 0) return null;
    const prev = segs[idx - 1];
    if (approvalsRef.test(prev)) return 'approvals';
    if (hooksRef.test(prev)) return 'hooks';
    return null;
  }

  let isRelease = false;
  let isPush = false;
  let isDestructive = false;
  let isApprovalsWrite = false;
  let isHooksWrite = false;
  let guardedSegment = null; // teşhis için: hangi segment tetikledi (ilk bulunan)

  // Cross-segment mention taraması (bare-artifact korelasyonu İÇİN — yukarıdaki yorum). Aynı-
  // segment mekanizması BUNU KULLANMAZ (o kendi approvalsRef.test(seg) çağrısını yapıyor).
  const anyMentionsApprovals = segments.some((s) => approvalsRef.test(s));
  const anyMentionsHooks = segments.some((s) => hooksRef.test(s));

  // KÖK MEKANİZMA: her segment AYNI kurallarla, TEK BAŞINA değerlendirilir. touchesApprovals/
  // touchesHooks VE writeVerb/inlineEval AYNI segmentten gelmek ZORUNDA — bu, B-6/Y2'nin kökü
  // olan çapraz-segment birleşmesini yapısal olarak imkânsız kılar (bkz dosya başı yorumu).
  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx];
    const head = getHeadCommand(seg);
    const reader = isReaderHead(head, seg);
    const effText = effectiveVerbText(seg, reader);

    if (release.test(seg)) isRelease = true;
    if (pushCmd.test(seg)) isPush = true;
    if (danger.test(seg) || gitForce.test(seg)) isDestructive = true;

    const hasWrite = writeVerb.test(effText) || inlineEval.test(effText) || ddWrite.test(effText) || findDestructive.test(effText) || xargsDestructive.test(effText);
    if (approvalsRedirect.test(seg) || (approvalsRef.test(seg) && hasWrite)) {
      isApprovalsWrite = true;
      if (!guardedSegment) guardedSegment = seg;
    }
    if (hooksRedirect.test(seg) || (hooksRef.test(seg) && hasWrite)) {
      isHooksWrite = true;
      if (!guardedSegment) guardedSegment = seg;
    }

    // BARE-ARTIFACT KORELASYONU: yalnızca bu segment GERÇEK bir yazma eylemi taşıyorsa taranır.
    if (segmentHasWriteAction(seg, effText)) {
      const artifacts = findBareProtectedArtifacts(seg);
      if (artifacts.ok && anyMentionsApprovals && !isApprovalsWrite) {
        isApprovalsWrite = true;
        if (!guardedSegment) guardedSegment = seg;
      }
      if (artifacts.hook && anyMentionsHooks && !isHooksWrite) {
        isHooksWrite = true;
        if (!guardedSegment) guardedSegment = seg;
      }
      // find'ın YIKICI biçimi (findDestructive) bare bir korunan-eser adı taşıyorsa, cross-segment
      // mention ŞARTI ARANMAZ (bkz M2 v4 yorumu: find'ın kendi flag-şartı zaten yeterince dar bir
      // sinyal — `find . -name G5.ok -exec rm {} ;` gibi, komutun HİÇBİR YERİNDE "docs/approvals"
      // dizin adı geçmeyen ama bare "G5.ok" taşıyan vektörleri de kapatır).
      if (findDestructive.test(effText)) {
        if (artifacts.ok && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
        if (artifacts.hook && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
      }
    }

    // XARGS PIPE SIZINTISI (yukarıdaki checkXargsPipeLeak yorumu).
    if (head.toLowerCase() === 'xargs' && xargsDestructive.test(seg)) {
      const leak = checkXargsPipeLeak(segments, idx);
      if (leak === 'approvals' && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (leak === 'hooks' && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
    }
  }

  if (isApprovalsWrite) {
    block(`Engellendi: docs/approvals/ altına kabuktan yazma/silme girişimi (segment: "${guardedSegment}"). Onay dosyaları yalnızca Write aracıyla oluşturulmalı (o da kullanıcı izin kartına düşer, docs/qa/g5-onay-dosyasi-korumasi-contract.md Katman A).`);
  }
  if (isHooksWrite) {
    block(`Engellendi: .claude/hooks/** veya .claude/settings.json içine kabuktan yazma/silme girişimi (segment: "${guardedSegment}", Y4 kapanışı). Bu dosyalar yalnızca Write/Edit aracıyla değiştirilmeli (GUARD.ok kapısına düşer, gate-check.cjs).`);
  }

  if (isRelease && !exists('docs/approvals/G6.ok')) {
    block('Engellendi: yayın için G6 onayı (docs/approvals/G6.ok) gerekli. Kullanıcıya AskUserQuestion ile sor.');
  }

  // Yıkıcı kontrolü push'tan ÖNCE değerlendirilir ki zorlamalı bir push
  // tek kullanımlık PUSH.ok'u boşuna harcamasın.
  if (isDestructive && !exists('docs/approvals/DANGER.ok')) {
    block('Engellendi: yıkıcı komut. Kullanıcıya sor; onaylarsa docs/approvals/DANGER.ok yaz (tek kullanımlık) ve komutu tekrar dene.');
  }

  if (isPush && !exists('docs/approvals/G6.ok')) {
    if (!exists('docs/approvals/PUSH.ok')) {
      block('Engellendi: push için tek kullanımlık onay (docs/approvals/PUSH.ok) gerekli. Kullanıcıya AskUserQuestion ile sor; onaylarsa PUSH.ok yaz ve komutu tekrar dene.');
    }
    consume('docs/approvals/PUSH.ok');
  }

  if (isDestructive) consume('docs/approvals/DANGER.ok');

  process.exit(0);
});
