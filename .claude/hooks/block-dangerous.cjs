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
// (tüm metin) olarak değerlendirilir, yani AYNEN bugünkü (segmentasyon-öncesi) davranış.
//
// =================================================================================================
// V5 — POLARİTE TERSİNE ÇEVİRME + YOL NORMALİZASYONU (2026-09-15, docs/qa/hook-polarite-contract.md)
// =================================================================================================
// Kullanıcı kararı: v4'ün "writeVerb kara listesi + korunan yol aynı segmentte mi" mekanizması
// GÖZENEKLİYDİ (QA'nın hook-borclari-karari-v3 raporu: v4'e karşı 11 CANLI sızıntı — `node -p`,
// `sed --in-place`, `python3 -c`, `>|` clobber, `patch`, `gzip`, `perl -pi`, `sort -o`,
// `openssl -out`, çıplak `node <betik>`, `rm "docs"/approvals/...` gibi tırnak/nokta/çift-eğik ile
// bölünmüş yollar). İkisi (`>|` ve `openssl -out`) doğrudan `.claude/hooks/gate-check.cjs`'i
// (kapının kendisini) hedefliyordu — o dosya bozulursa `settings.json` onu çağırmaya devam eder,
// `node` çıkış kodu 1 döner, Claude Code yalnızca çıkış kodu 2'yi engelleme sayar -> kapı SESSİZCE
// ÖLÜR (bu deponun kayıtlı en pahalı hata sınıfı).
//
// KARAR: kara-liste-genişletme YASAK (writeVerb/ddWrite/findDestructive/xargsDestructive'e yeni
// fiil EKLENMEDİ — hepsi v4'teki BİREBİR halleriyle, "MEKANİZMA 1" olarak, DEĞİŞTİRİLMEDEN
// aşağıda duruyor). Bunun YERİNE tamamen AYRI, İKİNCİ bir mekanizma ("MEKANİZMA 2", aşağıda
// "===== V5 MEKANİZMA 2" başlığından itibaren) EKLENDİ. Mekanizma 2'nin kararı bir fiil listesinden
// DEĞİL, "bu segmentin çalıştırdığı komut BİLİNEN BİR OKUYUCU MU?" sorusundan gelir: bir segment
// korunan bir yola (docs/approvals/**, .claude/hooks/**, .claude/settings.json) DOĞRUDAN
// referans veriyorsa (ya da "çıplak" bir korunan-eser adı taşıyıp BAŞKA bir segment korunan dizini
// anıyorsa) VE o segmentin baş komutu bilinen bir OKUYUCU DEĞİLSE -> yazma/silme GİRİŞİMİ sayılır.
//
// NEDEN "EKLEME", "DEĞİŞTİRME" DEĞİL: tasarımın ilk taslağı Mekanizma 1'i TAMAMEN Mekanizma 2 ile
// DEĞİŞTİRMeyi öneriyordu ("okuyucu değilse hasWrite/writeVerb'e hiç bakma"). Bu, iki MEVCUT
// self-test vakasıyla DOĞRUDAN ÇELİŞTİ: F-BOUNDARY (`grep rm docs/approvals/README.md`, v0/v1/v3/
// v4'ün HEPSİNDE hâlâ engelli) ve RETREAT-HEREDOC-M2v2 (`cat >> ... <<'EOF' ... cp ... docs/
// approvals ... EOF`, aynı şekilde hepsinde engelli) — ikisinde de segmentin BAŞ KOMUTU bir
// OKUYUCU (`grep`, `cat`), ama METNİN GERİ KALANI (argüman ya da heredoc gövdesi) bir yazma
// fiili + korunan yol anıyor. "Okuyucuysa asla engelleme" kuralı bu iki vakayı da AÇARDI — yani
// "v0/v1/v3/v4'ün engellediği hiçbir şeyi geçirmemeli" (bu turun MUTLAK şartı) İHLAL EDİLİRDİ.
// ÇÖZÜM: Mekanizma 1'i (ve onun okuyucu-ise-tırnak-içi-maskeleme davranışını, F2-F5/F9'un GEÇMESİNİ
// sağlayan) OLDUĞU GİBİ BIRAK; Mekanizma 2'yi SADECE EK bir OR-koşulu olarak ekle. Sonuç: nihai
// karar = Mekanizma1(engelle) OR Mekanizma2(engelle). Bu, YAPISAL OLARAK regresyona kapalıdır
// (Mekanizma 1 hiç dokunulmadığı için onun engellediği HİÇBİR ŞEY asla geçemez) ve P0-P3 sızıntı
// ailesini Mekanizma 2 üzerinden kapatır. "writeVerb kara listesi karar mercii olmaktan çıkar"
// sözü, ARTIK YENİ segmentlerin YALNIZCA Mekanizma 2 tarafından (fiil aranmadan, salt "okuyucu mu"
// sorusuyla) kapatılabilmesi anlamında tutuluyor — Mekanizma 1'in KENDİSİ karar mercii olmaktan
// çıkmadı (regresyon riski yüzünden ONA dokunulmadı), ama artık TEK mercii de değil.
//
// P4 (YOL PARÇALAMA): `approvalsRef`/`hooksRef`/çıplak-eser taraması ham metinle literal
// karşılaştırma yapıyordu; `rm "docs"/approvals/G5.ok` (tırnak arada), `rm docs/./approvals/G5.ok`
// (nokta-kısayolu arada), `rm docs//approvals/G5.ok` (çift eğik) bunu BOZUYORDU (fiil sorunu değil,
// HEDEF TANIMA sorunu). Çözüm: yalnızca TESPİT için (mesajlarda/segment gösteriminde DEĞİL) bir
// `normalizePathText` ön geçişi — tırnak karakterlerini SİL, ters bölüyü ileri bölüye çevir, tekrarlı
// `/`leri teke indir, `/./ ` bileşenlerini kaldır. Bu normalizasyon yalnızca YENİ eşleşme
// AÇABİLİR, var olan hiçbir eşleşmeyi KAPATAMAZ (fail-closed yönünde tek yönlü). `..` (üst dizin)
// bileşenlerini ÇÖZMEYE çalışmaz — `..` bir yol bağlamında görülüp segment ayrıca "docs"/
// "approvals"/".claude"/"hooks"/"settings.json" kelimelerinden birini ANIYORSA, segment fail-closed
// olarak EŞLEŞMİŞ sayılır (bkz `PARENT_TRAVERSAL_RE`).
//
// ÜÇ BEDEL KARARI (kullanıcı kararı, ölçülüp doğrulandı — docs/qa/hook-polarite-contract.md):
//  (i)   `find` KOŞULLU okuyucu: yıkıcı bayrak (-delete/-exec/-execdir/-ok/-okdir/-fprint*/-fls)
//        YOKSA okuyucu, VARSA değil (`sed -i` ile aynı desen).
//  (ii)  `git` okuyucu alt-komut kümesine `add`, `commit`, `stash list` EKLENDİ (keyfi yola
//        YAZAMAZLAR — add indekse alır, commit nesne oluşturur, stash list yalnızca listeler).
//  (iii) `sh -c`/`bash -c`/`eval`/`powershell -Command`/`pwsh -c`/`cmd /c` gibi bir alt kabuğa
//        GERÇEKTEN yorumlanmak üzere geçirilen bir dize KOD'dur, VERİ değildir — bu aile ASLA
//        okuyucu sayılmaz. Sonuç: `sh -c 'ls docs/approvals'` gibi salt-okunur bir alt-kabuk
//        çağrısı bile ARTIK ENGELLENİR (bilinçli, istenen aşırı engelleme — NEST-NEG-1/WL-SH-KNOWN
//        beklentisi 0'dan 2'ye çevrildi). Bu, iç içe-kabuk ailesini FİİL ARANMADAN, YAPISAL olarak
//        kapatır: alt kabuğun içinde ne olduğu önemsiz, tek soru "korunan bir yol anılıyor mu".
//
// KABUL EDİLEN YENİ AŞIRI ENGELLEME (fail-closed varsayılan şüphe, bilinçli): `node`/`python`/
// `python3`/`perl`/`ruby`/`npm`/`npx` gibi genel amaçlı yorumlayıcılar/çalıştırıcılar ASLA okuyucu
// sayılmaz (keyfi kod çalıştırabilirler, "yalnızca okur" garantisi verilemez) — bu, `node
// scripts/report.mjs docs/approvals/G5.ok` gibi GERÇEKTEN salt-okunur bir kullanımı da artık
// engeller. Kabul edilen, ölçülen bir taviz (docs/qa/hook-polarite-contract.md §FP).
const fs = require('fs');
const { readInput, exists, block } = require('./_common.cjs');

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

// splitCommandSegments(cmd) -> string[] | null  (DEĞİŞMEDİ, v4 ile birebir)
const WD_CHANGE = /\b(cd|pushd|popd|chdir|Set-Location|Push-Location|Pop-Location)\b/i;

function splitCommandSegments(cmd) {
  if (cmd.indexOf('<<') !== -1) return null;
  if (cmd.indexOf('$(') !== -1 || cmd.indexOf('`') !== -1) return null;
  if (/\\\r?\n/.test(cmd)) return null;
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
    if (c === '\\' && i + 1 < n) { cur += c + cmd[i + 1]; i += 2; continue; }
    if (c === "'") { inSingle = true; cur += c; i++; continue; }
    if (c === '"') { inDouble = true; cur += c; i++; continue; }
    if (c === '&' && cmd[i + 1] === '&') { segments.push(cur); cur = ''; i += 2; continue; }
    if (c === '&' && cmd[i - 1] !== '>' && cmd[i + 1] !== '>') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === '|' && cmd[i + 1] === '|') { segments.push(cur); cur = ''; i += 2; continue; }
    // V5 EKLEME (doğrulama sırasında bulundu — bkz block() öncesi ana yorum "Yeni yönlendirme
    // deseni (>|)"): `>|` (bash'in "noclobber'ı zorla aş" clobber operatörü) TEK bir yönlendirme
    // token'ıdır, ">" (redirect) + "|" (pipe) DEĞİLDİR. Bu satır OLMADAN `echo x >| .claude/hooks/
    // gate-check.cjs` "|" karakterinde İKİ segmente bölünüyordu (["echo x >", ".claude/hooks/
    // gate-check.cjs"]) — approvalsRedirectV5/hooksRedirectV5'in ">... hedef" bitişikliğini
    // KIRIYOR, ve komut TAMAMEN FARKLI (kazara) bir yoldan engelleniyordu (ikinci segment BAŞLI
    // BAŞINA bir yol olduğu için "non-reader head + mention" kuralına takılıyordu) — yani asıl
    // düzeltme (hooksRedirectV5) hiç ÇALIŞMIYORDU, yalnızca ŞANSLA aynı sonuca ulaşılıyordu
    // (mutasyon testi MUT-REDIRECT-V5-OFF bunu 0 FAIL vererek ifşa etti). "&"nin "&>" için zaten
    // yaptığı ayrımın (cmd[i-1] !== '>') "|" karşılığı: önceki karakter ">" ise "|" bir AYIRAÇ
    // DEĞİLDİR, ">|" token'ının parçasıdır.
    if (c === '|' && cmd[i - 1] === '>') { cur += c; i += 1; continue; }
    if (c === '|') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === ';') { segments.push(cur); cur = ''; i += 1; continue; }
    if (c === '\n') { segments.push(cur); cur = ''; i += 1; continue; }
    cur += c;
    i++;
  }
  segments.push(cur);
  if (inSingle || inDouble) return null;
  const trimmed = segments.map((s) => s.trim()).filter((s) => s.length > 0);
  return trimmed.length ? trimmed : [cmd];
}

// =============================================================================================
// MEKANİZMA 1 (v4'ten BİREBİR, DEĞİŞTİRİLMEDİ — bkz dosya başı "NEDEN EKLEME" notu). Bu bölümdeki
// HİÇBİR sabit/fonksiyon/regex bu turda değiştirilmedi; yalnızca isimleri "v4" ekiyle DEĞİL, orijinal
// isimleriyle bırakıldı ki aşağıdaki karar mantığı v4 ile birebir aynı çalışsın.
// =============================================================================================
const READER_HEADS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'findstr',
  'awk', 'nl', 'od', 'xxd', 'strings', 'stat', 'file', 'cmp', 'diff', 'ls', 'dir', 'tree',
  'basename', 'dirname', 'realpath', 'readlink', 'echo', 'printf', 'type', 'which', 'where',
  'get-content', 'select-string', 'get-childitem', 'get-item',
]);
const HEAD_SKIP_PREFIX = new Set(['sudo', 'env', 'time', 'exec', 'command', 'nice', 'nohup', 'builtin']);

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

const GIT_READ_SUBCOMMANDS = new Set(['log', 'diff', 'show', 'status', 'blame', 'grep', 'cat-file', 'ls-files', 'rev-parse']);
function isGitReader(seg) {
  const m = /\bgit\b\s+(?:--[\w-]+(?:=\S+)?\s+)*([A-Za-z-]+)/i.exec(seg);
  if (!m) return false;
  return GIT_READ_SUBCOMMANDS.has(m[1].toLowerCase());
}
const SED_INPLACE_RE = /\bsed\b[^\n]*-i\b/i;

const KNOWN_NONREADER_HEADS = new Set([
  'git', 'cp', 'copy', 'mv', 'move', 'ren', 'rename', 'sed', 'tee',
  'set-content', 'out-file', 'add-content', 'new-item', 'remove-item',
  'del', 'erase', 'rm', 'unlink', 'rd', 'rmdir', 'ri', 'mklink',
  'node', 'python', 'py', 'ruby', 'perl', 'npx', 'npm',
  'vercel', 'fly', 'railway', 'gh', 'eas',
  'sh', 'bash', 'zsh', 'cmd', 'powershell', 'pwsh', 'eval', 'source',
]);

function isReaderHead(head, seg) {
  const h = head.toLowerCase();
  if (!h) return false;
  if (h === 'sed') return !SED_INPLACE_RE.test(seg);
  if (h === 'git') return isGitReader(seg);
  return READER_HEADS.has(h);
}

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
  const segments = segmented || [cmd];

  const release = /\b(vercel(\s+--prod)?\b|fly\s+deploy|railway\s+up|gh\s+release|npm\s+publish|eas\s+submit|eas\s+build\b.*--auto-submit)/i;
  const pushCmd = /\bgit\s+push\b/i;
  const danger = /(\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bdrop\s+(table|database)\b|Remove-Item[^\n]*-Recurse|\btruncate\s+table\b|\b(rd|rmdir)\b[^\n]*\/s\b|\b(del|erase)\b(?=[^\n]*\/[sq]\b)|\bri\b[^\n]*-r(e(c(u(r(s(e)?)?)?)?)?)?\b|\bmklink\b)/i;
  const gitForce = /\bgit\b[^\n]*\s(--force\b|--force-with-lease\b|-f\b)/;

  const ddWrite = /\bdd\b[^\n]*\bof=/i;
  const writeVerb = /(\btee\b|\bcp\b|\bcopy\b|\bmv\b|\bmove\b|\bren(?:ame)?\b|\bsed\b[^\n]*-i\b|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b|\bNew-Item\b|\bRemove-Item\b|\b(del|erase|rm|unlink)\b|\brd\b|\brmdir\b|\bri\b|\binstall\b|\bln\b|\bchmod\b|\bchown\b|\btruncate\b(?!\s+table\b))/i;
  const inlineEval = /(\bnode\b[^\n]*(-e\b|--eval\b)|\bnpx\s+tsx\b[^\n]*-e\b|\bpython\b[^\n]*-c\b)/i;
  const findDestructive = /\bfind\b[^\n]*(-delete\b|-exec\b[^\n]*\b(rm|mv|cp|tee|unlink|del|erase|chmod|dd|truncate|ln)\b)/i;
  const xargsDestructive = /\bxargs\b[^\n]*\b(rm|mv|cp|tee|unlink|del|erase|chmod|chown|dd|truncate|ln|sed)\b/i;

  const approvalsRef = /docs[\\/]approvals\b/i;
  const hooksRef = /\.claude[\\/](hooks\b|settings\.json\b)/i;
  const approvalsRedirect = /(>>|>(?!=))\s*['"]?docs[\\/]approvals\b/i;
  const hooksRedirect = /(>>|>(?!=))\s*['"]?\.claude[\\/](hooks\b|settings\.json\b)/i;
  const genericRedirect = /(>>|>(?!=))/;

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
        const prefix = segment.slice(0, m.index);
        if (!AMBIGUOUS_PREFIX_RE.test(prefix)) continue;
      }
      if (HOOK_FILENAME_RE.test(m[0])) found.hook = true;
      else found.ok = true;
    }
    return found;
  }

  function effectiveVerbText(seg, reader) {
    return reader ? maskQuoted(seg) : seg;
  }
  function segmentHasWriteAction(seg, effText) {
    return writeVerb.test(effText) || inlineEval.test(effText) || genericRedirect.test(seg) || ddWrite.test(effText) || findDestructive.test(effText) || xargsDestructive.test(effText);
  }

  function checkXargsPipeLeak(segs, idx) {
    if (idx === 0) return null;
    const prev = segs[idx - 1];
    if (approvalsRef.test(prev)) return 'approvals';
    if (hooksRef.test(prev)) return 'hooks';
    return null;
  }

  // =============================================================================================
  // ===== V5 MEKANİZMA 2 (YENİ, EKLENDİ — yukarıdaki hiçbir şeye dokunmadan) ====================
  // Karar mercii: "bu segmentin çalıştırdığı komut bilinen bir OKUYUCU MU?" OKUYUCU TANIMI (v4'ten
  // devralındı): "KEYFİ argümanla KEYFİ yola YAZAMAYAN/SİLEMEYEN" komut. Şüphede DEĞİL (fail-closed).
  // =============================================================================================

  // READER_HEADS_V5: Mekanizma 1'in READER_HEADS'i + (a) sağlama/özet araçları (SEG-2 self-test
  // vakasını BOZMAMAK için: sha256sum zaten "salt-okunur" kabul ediliyordu, Mekanizma 2'nin bunu
  // yanlışlıkla engellememesi için AYNI aileden hepsi eklendi) + (b) çalışma-dizini-değiştirme
  // ailesi (cd/pushd/.../Set-Location) — BUNLAR KENDİ BAŞLARINA HİÇBİR ŞEYE YAZAMAZ; retreat
  // (WD_CHANGE) tetiklendiğinde tüm komut TEK segment olur ve getHeadCommand bu segmentin baş
  // komutu olarak "cd"yi döner — "cd" okuyucu sayılmazsa `cd docs/approvals && ls` gibi ZARARSIZ
  // (M1-NEG-1) bir komut Mekanizma 2 tarafından YANLIŞLIKLA engellenir (gerçek yazma sinyali hiç
  // yokken). Bu aileyi Mekanizma 1'in davranışını (bare-artifact + blob mention+writeVerb, HİÇ
  // DEĞİŞMEDİ) devralması İÇİN Mekanizma 2'de nötürledik — R1-R12/M1-POS-*/M1-UNIQUE gibi GERÇEK
  // saldırılar zaten Mekanizma 1 tarafından (değişmeden) yakalanıyor, bu yüzden nötrleme YENİ bir
  // boşluk AÇMAZ.
  // getHeadCommandV5: Mekanizma 1'in getHeadCommand'ının BİREBİR kopyası + kabuk YERLEŞİK
  // sözcüklerini (then/do/else/elif/until/in) de atlayan bir HEAD_SKIP_PREFIX_V5. GEREKÇE (kod
  // incelemesiyle bulundu, smoke-test regresyonu): `if true; then cat docs/approvals/G5.ok; fi`
  // gibi bir zincir `;` üzerinden ["if true", "then cat docs/approvals/G5.ok", "fi"] segmentlerine
  // bölünür — "then"/"do" birer KABUK YERLEŞİĞİDİR, gerçek komut değildir; asıl komut ("cat") bir
  // sonraki token. Mekanizma 1 buna DUYARSIZ (head'i değil, ham/maskeli METNİ writeVerb ile
  // tarıyor), ama Mekanizma 2 head-dispatch'li olduğu için "then"i (okuyucu olmayan bir kelime)
  // yanlışlıkla "baş komut" sanıp N3-TWIN/N7-TWIN/S11-TWIN gibi ZARARSIZ (cat/okuma) komutları
  // engelliyordu. Mekanizma 1'in KENDİ getHeadCommand/HEAD_SKIP_PREFIX'ine DOKUNULMADI (ayrı bir
  // kopya) — bu, Mekanizma 1'in davranışını sıfır risk ile korur.
  const HEAD_SKIP_PREFIX_V5 = new Set(['sudo', 'env', 'time', 'exec', 'command', 'nice', 'nohup', 'builtin', 'then', 'do', 'else', 'elif', 'until', 'in']);
  function getHeadCommandV5(seg) {
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
      if (HEAD_SKIP_PREFIX_V5.has(tok.toLowerCase())) { s = s.slice(tok.length); continue; }
      return tok.replace(/^\\/, '').replace(/^["']+|["']+$/g, '');
    }
  }

  const READER_HEADS_V5 = new Set([
    ...READER_HEADS,
    'sha256sum', 'sha1sum', 'sha512sum', 'md5sum', 'shasum', 'cksum', 'b2sum',
    'cd', 'pushd', 'popd', 'chdir', 'set-location', 'push-location', 'pop-location',
    // Kabuk KONTROL-AKIŞI başlıkları (cd-family ile AYNI gerekçe: kendi başlarına hiçbir yola
    // yazmazlar/silmezler — sadece bir döngü/koşul HEADER'ıdırlar). Regresyon bulgusu (N7-TWIN):
    // `for f in G5.ok; do cat docs/approvals/$f; done` -> `;` segmentasyonu "for f in G5.ok"
    // segmentini "do cat ..."dan AYIRIR; bu segment "G5.ok" (dongu listesi, cıplak eser DEĞİL,
    // sadece veri) taşıdığı için "for" okuyucu sayılmazsa çapraz-segment çıplak-eser korelasyonu
    // YANLIŞLIKLA tetikleniyordu (bu segment hiçbir EYLEM yapmıyor). "for"/"while"/"until"/"if"/
    // "case" header'ları buraya, "then"/"do"/"else"/"elif" ise HEAD_SKIP_PREFIX_V5'e eklendi
    // (onlardan SONRA gelen asıl komut değerlendirilsin diye) — ikisi de aynı kök nedeni kapatır.
    'for', 'while', 'until', 'if', 'case',
  ]);

  // Koşullu üyeler — konuma DEĞİL, komutun YETENEĞİNE bakar (brief şartı #1, v1'in "komut konumu"
  // hatasını TEKRARLAMAMAK için): her biri "bu bayrak/alt-komut olmadan bu araç keyfi yola
  // yazabilir mi?" sorusuna DAR ve gerekçeli bir cevap verir.
  const FIND_DESTRUCTIVE_FLAG_RE = /(-delete\b|-execdir\b|-okdir\b|-ok\b|-exec\b|-fprint0\b|-fprintf\b|-fprint\b|-fls\b)/i;
  function isFindReaderV5(seg) { return !FIND_DESTRUCTIVE_FLAG_RE.test(seg); }

  const DD_OF_RE_V5 = /\bdd\b[^\n]*\bof=/i;
  function isDdReaderV5(seg) { return !DD_OF_RE_V5.test(seg); }

  const SORT_OUTPUT_RE_V5 = /\bsort\b[^\n]*(-o\b|--output\b)/i;
  function isSortReaderV5(seg) { return !SORT_OUTPUT_RE_V5.test(seg); }

  const OPENSSL_OUT_RE_V5 = /\bopenssl\b[^\n]*-out\b/i;
  function isOpensslReaderV5(seg) { return !OPENSSL_OUT_RE_V5.test(seg); }

  // sed: -i VE --in-place ikisi de yerinde-düzenleme sayılır (ÖNEMLİ-1 bulgusu: v4'ün writeVerb
  // deseni yalnızca "-i\b" arıyordu, "--in-place" bunu ATLIYORDU — Mekanizma 1'e DOKUNMADIK, bu
  // yalnızca Mekanizma 2'nin KENDİ okuyucu testi, daha geniş).
  const SED_INPLACE_RE_V5 = /\bsed\b[^\n]*(-i\b|--in-place\b)/i;
  function isSedReaderV5(seg) { return !SED_INPLACE_RE_V5.test(seg); }

  // git: brief şartı #2 — add/commit/"stash list" keyfi yola YAZAMAZ (add indekse alır, commit
  // nesne oluşturur, stash list yalnızca listeler) -> okuyucu. Diğer her şey (rm/checkout/reset/
  // push/mv/apply/clean/worktree/stash push|pop|drop) okuyucu DEĞİL.
  const GIT_READ_SUBCOMMANDS_V5 = new Set(['log', 'diff', 'show', 'status', 'blame', 'grep', 'cat-file', 'ls-files', 'rev-parse', 'add', 'commit']);
  function isGitReaderV5(seg) {
    const m = /\bgit\b\s+(?:--[\w-]+(?:=\S+)?\s+)*([A-Za-z-]+)(?:\s+([A-Za-z-]+))?/i.exec(seg);
    if (!m) return false;
    const sub = m[1].toLowerCase();
    if (sub === 'stash') return (m[2] || '').toLowerCase() === 'list';
    return GIT_READ_SUBCOMMANDS_V5.has(sub);
  }

  // xargs: hedef komut STDIN'den gelir, xargs'ın kendi segmentinde YAZILI DEĞİLDİR — "xargs
  // <cmd>"deki <cmd> bilinen bir okuyucuysa xargs okuyucu sayılır (ör. "xargs cat"/"xargs grep"),
  // değilse (ör. "xargs rm") okuyucu değildir. Hedef çözülemezse fail-closed (okuyucu DEĞİL).
  const XARGS_FLAG_WITH_VALUE = new Set(['-i', '-I', '-n', '-p', '-P', '-d', '-s', '-a', '-E', '-e', '--delimiter', '--max-args', '--max-procs', '--arg-file', '--eof']);
  function xargsTargetCommand(seg) {
    const m = /^\s*xargs\b(.*)$/i.exec(seg);
    if (!m) return '';
    const rest = m[1].trim();
    if (!rest) return '';
    const tokens = rest.split(/\s+/);
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (/^-/.test(t)) {
        if (XARGS_FLAG_WITH_VALUE.has(t)) { i += 2; continue; }
        i += 1;
        continue;
      }
      return t.replace(/^["']+|["']+$/g, '').toLowerCase();
    }
    return '';
  }
  function isXargsReaderV5(seg) {
    const target = xargsTargetCommand(seg);
    if (!target) return false;
    return READER_HEADS_V5.has(target);
  }

  // Brief şartı #3: sh/bash/zsh/cmd/powershell/pwsh/eval/source, xargs/find/command/env/sudo/
  // nice/time/nohup gibi "keyfi komut çamaşırı" olan aileler ASLA okuyucu değildir (hiçbir koşullu
  // fonksiyon tanımlanmadı) — READER_HEADS_V5'te de yoklar, bu yüzden varsayılan (aşağıda
  // isReaderHeadV5'in son satırı) zaten "false" döner. Aynı şekilde node/python/python3/perl/ruby/
  // npm/npx/npx — genel amaçlı yorumlayıcı/çalıştırıcılar — de KASITLI OLARAK YOK (kabul edilen
  // yeni aşırı engelleme, dosya başı yorumu).
  function isReaderHeadV5(head, seg) {
    const h = head.toLowerCase();
    if (!h) return false;
    if (h === 'sed') return isSedReaderV5(seg);
    if (h === 'git') return isGitReaderV5(seg);
    if (h === 'find') return isFindReaderV5(seg);
    if (h === 'dd') return isDdReaderV5(seg);
    if (h === 'sort') return isSortReaderV5(seg);
    if (h === 'openssl') return isOpensslReaderV5(seg);
    if (h === 'xargs') return isXargsReaderV5(seg);
    return READER_HEADS_V5.has(h);
  }

  // P4 YOL NORMALİZASYONU — yalnızca TESPİT için (mesajlarda/guardedSegment'te asla kullanılmaz).
  // Tek yönlü: yeni eşleşme AÇABİLİR, var olan bir eşleşmeyi asla KAPATAMAZ (bkz dosya başı yorumu).
  function normalizePathText(seg) {
    let s = seg.split('\\').join('/'); // ters bolu -> ileri bolu (P4: docs\approvals varyanti da ayni yoldan gecsin)
    s = s.split('"').join('').split("'").join(''); // yol bileseni icine sikismis tirnaklari SIL (P4: "docs"/approvals)
    s = s.replace(/\/{2,}/g, '/'); // P4: docs//approvals -> docs/approvals
    s = s.replace(/\/\.\//g, '/').replace(/^\.\//, ''); // P4: docs/./approvals -> docs/approvals
    return s;
  }
  // ".." fail-closed kuralı: bir yol bileseni olarak ".." goruluyorsa COZMEYE calismayiz (tam bir
  // dosya sistemi cozumleyicisi gerektirir) -- bunun yerine segment ayrica korunan dizinin kendi
  // bilesen kelimelerinden (docs/approvals veya .claude/hooks/settings.json) birini ANIYORSA,
  // segmenti EASLESMIS (korunan yola referans var) SAYARIZ. Bu, "..") iceren HER segmenti degil,
  // yalnizca zaten supheli olan (korunan kelimeyi de tasiyan) segmentleri etkiler.
  const PARENT_TRAVERSAL_RE = /(^|[\\/])\.\.([\\/]|$)/;
  function mentionsApprovalsNormalized(seg) {
    if (approvalsRef.test(normalizePathText(seg))) return true;
    if (PARENT_TRAVERSAL_RE.test(seg) && /\b(docs|approvals)\b/i.test(seg)) return true;
    return false;
  }
  function mentionsHooksNormalized(seg) {
    if (hooksRef.test(normalizePathText(seg))) return true;
    if (PARENT_TRAVERSAL_RE.test(seg) && /\b(\.claude|hooks|settings\.json)\b/i.test(seg)) return true;
    return false;
  }
  function findBareProtectedArtifactsV5(seg) {
    return findBareProtectedArtifacts(normalizePathText(seg));
  }

  // =============================================================================================

  let isRelease = false;
  let isPush = false;
  let isDestructive = false;
  let isApprovalsWrite = false;
  let isHooksWrite = false;
  let guardedSegment = null;

  const anyMentionsApprovals = segments.some((s) => approvalsRef.test(s));
  const anyMentionsHooks = segments.some((s) => hooksRef.test(s));
  // V5: aynı tarama, normalize edilmiş metin üzerinde (P4 kapsamı) — Mekanizma 2'nin KENDİ
  // cross-segment korelasyonu için, Mekanizma 1'in anyMentionsApprovals/anyMentionsHooks'una
  // dokunmadan.
  const anyMentionsApprovalsV5 = segments.some((s) => mentionsApprovalsNormalized(s));
  const anyMentionsHooksV5 = segments.some((s) => mentionsHooksNormalized(s));

  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx];
    const head = getHeadCommand(seg);
    const reader = isReaderHead(head, seg);
    const effText = effectiveVerbText(seg, reader);

    if (release.test(seg)) isRelease = true;
    if (pushCmd.test(seg)) isPush = true;
    if (danger.test(seg) || gitForce.test(seg)) isDestructive = true;

    // ----- MEKANİZMA 1 (v4 ile birebir, değişmedi) -----
    const hasWrite = writeVerb.test(effText) || inlineEval.test(effText) || ddWrite.test(effText) || findDestructive.test(effText) || xargsDestructive.test(effText);
    if (approvalsRedirect.test(seg) || (approvalsRef.test(seg) && hasWrite)) {
      isApprovalsWrite = true;
      if (!guardedSegment) guardedSegment = seg;
    }
    if (hooksRedirect.test(seg) || (hooksRef.test(seg) && hasWrite)) {
      isHooksWrite = true;
      if (!guardedSegment) guardedSegment = seg;
    }
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
      if (findDestructive.test(effText)) {
        if (artifacts.ok && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
        if (artifacts.hook && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
      }
    }
    if (head.toLowerCase() === 'xargs' && xargsDestructive.test(seg)) {
      const leak = checkXargsPipeLeak(segments, idx);
      if (leak === 'approvals' && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (leak === 'hooks' && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
    }

    // ----- MEKANİZMA 2 (v5, YENİ, ek OR-koşulu) -----
    // NOT: kendi baş-komut çözümleyicisini kullanır (getHeadCommandV5, kabuk yerleşiklerini de
    // atlar) — Mekanizma 1'in `head` değişkenini DEĞİL (yukarıdaki büyük yorum).
    const headV5Resolved = getHeadCommandV5(seg);
    const hasCommandV5 = headV5Resolved !== '';
    const readerV5 = hasCommandV5 && isReaderHeadV5(headV5Resolved, seg);

    // Yeni yönlendirme deseni (>|) — brief P0: `echo x >| .claude/hooks/gate-check.cjs` Mekanizma
    // 1'in approvalsRedirect/hooksRedirect'i tarafından YAKALANMIYORDU (">" ile ">|" arasındaki
    // "|" karakteri regex'i kırıyordu). Okuyucu olsun olmasın HER ZAMAN kontrol edilir (bir
    // okuyucu bile ">|" ile hedefe yazabilir — kabuğun kendi yönlendirme sözdizimi, komutun
    // yeteneği değil).
    const approvalsRedirectV5 = /(?:>>|>\|?)(?!=)\s*['"]?docs[\\/]approvals\b/i;
    const hooksRedirectV5 = /(?:>>|>\|?)(?!=)\s*['"]?\.claude[\\/](hooks\b|settings\.json\b)/i;
    if (approvalsRedirectV5.test(seg) && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
    if (hooksRedirectV5.test(seg) && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }

    if (hasCommandV5 && !readerV5) {
      // Aynı-segment doğrudan anma: segment korunan yolu KENDİSİ anıyor VE baş komut okuyucu
      // DEĞİLSE -> yazma girişimi (P0/P1/P2 sızıntılarının çoğu burada kapanıyor: node -p, sed
      // --in-place, python3 -c, patch, gzip, perl -pi, sort -o, openssl -out, çıplak `node
      // <betik>`, tüm sh/bash/eval/powershell/cmd aile üyeleri).
      if (mentionsApprovalsNormalized(seg) && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (mentionsHooksNormalized(seg) && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }

      // Çapraz-segment çıplak-eser korelasyonu (P4 normalize edilmiş, Mekanizma 1'in
      // findBareProtectedArtifacts'ının normalize edilmiş metin üzerindeki hali): bu segment
      // okuyucu DEĞİL VE çıplak bir korunan-eser adı taşıyor VE BAŞKA bir segment korunan dizini
      // anıyorsa -> yazma girişimi (R9/R11/R12/A5 ailesinin v5'teki karşılığı, fiil listesi
      // ARANMADAN).
      const artifactsV5 = findBareProtectedArtifactsV5(seg);
      if (artifactsV5.ok && anyMentionsApprovalsV5 && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (artifactsV5.hook && anyMentionsHooksV5 && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }

      // find'ın özel istisnası (Mekanizma 1'deki "find + -exec/-delete + çıplak eser -> çapraz
      // segment mention şartı ARANMADAN engelle" istisnasının v5 karşılığı): find zaten burada
      // (!readerV5) yalnızca yıkıcı bayrakla non-reader olduğu için, kendi flag-şartı zaten
      // yeterince dar bir sinyal.
      if (headV5Resolved.toLowerCase() === 'find') {
        if (artifactsV5.ok && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
        if (artifactsV5.hook && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
      }
    }

    // xargs boru sızıntısı (v5): Mekanizma 1'in checkXargsPipeLeak'i aynen kullanılıyor (ham metin
    // üzerinde), ama tetikleyici artık xargsDestructive fiil-listesi DEĞİL, "xargs hedefi okuyucu
    // mu" sorusu (isXargsReaderV5) — ör. "echo docs/approvals/G5.ok | xargs cp" gibi
    // xargsDestructive'te OLMAYAN bir hedef fiil de artık yakalanır.
    if (headV5Resolved.toLowerCase() === 'xargs' && hasCommandV5 && !readerV5) {
      const leakV5 = checkXargsPipeLeak(segments, idx);
      if (leakV5 === 'approvals' && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (leakV5 === 'hooks' && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
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
