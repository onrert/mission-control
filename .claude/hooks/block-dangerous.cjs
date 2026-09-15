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
//
// =================================================================================================
// V6 — YAZMA-KONUMU ANALİZİ (2026-09-15, docs/qa/hook-polarite-karari-2026-09-15.md §5,
// docs/qa/hook-writepos-contract.md) — Mekanizma 1 ve Mekanizma 2 AYNEN yukarıda kaldı
// (B1/B2/B3 KAPANIŞI additive; B4+Ö3 kapanışı Mekanizma 2'de İKİ dar, ölçülmüş değişiklikle).
// =================================================================================================
// QA'nın hook-polarite-karari-2026-09-15.md raporu v5'i KALDI verdi: Mekanizma 2'nin "baş komut
// okuyucu mu?" sorusu üç yapısal kör nokta açtı (B1: kontrol-akışı/`cd` kelimeleri READER_HEADS_V5
// içinde OLDUĞU İÇİN Mekanizma 2 tüm segmenti atlıyor — "eylemsiz" ile "okuyucu" AYNI bayrağa
// kodlanmıştı; B2: yönlendirme normalizasyonu yalnızca `!readerV5` dalında; B3: `\` normalizasyonu
// bash kaçışına kör). Bu sınıfın BEŞİNCİ tekrarıydı (fiil listesi -> komut konumu -> tırnak ->
// baş-komut yeteneği -> ...) ve her seferinde sözdizimi çeşitliliği kazanıyordu. QA'nın önerdiği
// SORU DEĞİŞİKLİĞİ: "bu segmentin baş komutu ne?" YERİNE "korunan yol bu segmentte bir YAZMA
// KONUMUNDA MI?" (yönlendirme hedefi / bilinen bir yazıcının hedef argümanı / yerinde-düzenleme
// konusu / opak çalıştırıcı). Bu soru "head"/"reader" kavramına HİÇ İHTİYAÇ DUYMAZ — "if"/"cd"/
// "while" gibi eylemsiz kelimelerin bir listede olup olmaması ANLAMSIZLAŞIR.
//
// TASARIM KARARI (additive-mekanizma disiplini korunuyor, docs/blockers.md "additive-mechanism"
// dersi): B1/B2/B3, Mekanizma 1/2'ye TEK SATIR bile DOKUNMADAN kapatılabiliyordu — "MEKANİZMA 3"
// (aşağıda) segment içeriğini "head" kavramı OLMADAN, doğrudan yazma-konumu kurallarıyla tarar ve
// yalnızca YENİ bir OR-koşulu ekler. Bu YAPISAL OLARAK regresyona kapalıdır (v0..v5'in engellediği
// hiçbir şey Mekanizma 3 tarafından "geçirilemez" — yalnızca yeni engeller EKLENEBİLİR).
//
// B4 (self-test artık engelleniyor: `node .claude/hooks/_selftest.cjs`) ve Ö3 (`test -f .../*.ok`
// gibi durum sorguları yanlış pozitif) BUNUNLA KAPANMAZ — bunlar Mekanizma 2'nin MEVCUT bir
// pozitif kararını (yanlışlıkla) daraltmayı gerektirir, saf OR-ekleme bunu YAPAMAZ (yalnızca
// engeli artırabilir, azaltamaz). Bu ikisi için Mekanizma 2'de İKİ dar, açıkça yorumlanmış
// değişiklik yapıldı (aşağıda "V6 DEĞİŞİKLİK 1/2" etiketleriyle işaretli); ikisi de v0/v1/v3/v4'e
// karşı REGRESYON ÜRETMEZ çünkü bu iki komut o sürümlerin HİÇBİRİNDE zaten engellenmiyordu
// (Mekanizma 2, dolayısıyla "opak çalıştırıcı" ve "her okuyucu olmayan baş komut" kavramı, v5'te
// DOĞDU — v0-v4 bu senaryoları hiç tanımıyordu, dolayısıyla "v6 bunu artık geçiriyor" bir
// regresyon değil, v5'in KENDİ getirdiği bir aşırı-engellemenin geri alınmasıdır). Ölçüm:
// docs/qa/hook-writepos-contract.md §diferansiyel.
//
// V6 DEĞİŞİKLİK 1 (Ö3 kapanışı): READER_HEADS_V5'e `test` ve `[` eklendi. Gerekçe: ikisi de
// KABUK YERLEŞİĞİDİR ve kendi başlarına HİÇBİR YOLA yazamaz/silemez, ayrıca `if`/`while`/`cd`
// ailesinin aksine kendi ARGÜMANLARI içinde BAŞKA bir komutu çalıştırmazlar (yalnızca bir boole
// koşulu değerlendirirler) — yani "eylemsiz" ile "okuyucu" karışıklığı (B1'in kök nedeni) bunlar
// için YOKTUR; bunları okuyucu saymak B1 tarzı yeni bir kör nokta AÇMAZ.
//
// V6 DEĞİŞİKLİK 2 (B4 kapanışı): "yorumlayıcı betik argümanı muafiyeti" — bir segment `node`/
// `python`/`python3`/`py`/`perl`/`ruby` çalıştırıyorsa VE satır içi kod bayrağı (`-e`/`--eval`/
// `-p`/`--print` [node]; `-c` [python]; `-e` [perl/ruby]) YOKSA VE yorumlayıcının İLK konumsal
// argümanı (betik yolu) `fs.realpathSync.native` ile ÇÖZÜLDÜĞÜNDE gerçekten `.claude/hooks/`
// ALTINA denk geliyorsa (çözülemezse FAIL-CLOSED — muafiyet YOK): o TEK argüman (yalnızca o
// argüman, segmentin geri kalanı DEĞİL) Mekanizma 2'nin "aynı-segment hooks anması" kuralından
// ve Mekanizma 3'ün "opak çalıştırıcı" kuralından MUAF tutulur. GEREKÇE (QA'nın formülasyonu,
// hook-polarite-karari-2026-09-15.md §3(c)): "bir dosyayı ÇALIŞTIRMAK ona YAZMAK değildir" —
// muafiyet bir istisna değil, TESPİTİN DÜZELTİLMESİDİR. Yönlendirme kontrolleri (Mekanizma 1'in
// approvalsRedirect/hooksRedirect'i, Mekanizma 2'nin approvalsRedirectV5/hooksRedirectV5'i,
// Mekanizma 3'ün Konum-1 yönlendirme taraması) bu muafiyetten HİÇ ETKİLENMEZ (her biri RAW segment
// üzerinde, muafiyet kontrolünden BAĞIMSIZ çalışır) — yani `node .claude/hooks/_selftest.cjs >
// docs/approvals/G5.ok` yine ENGELLİDİR (yönlendirme hedefi ayrı bir kural).
const fs = require('fs');
const path = require('path');
const { readInput, exists, block } = require('./_common.cjs');

function consume(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

// splitCommandSegments(cmd) -> string[] | null  (DEĞİŞMEDİ, v4/v5 ile birebir)
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
// MEKANİZMA 1 (v4'ten BİREBİR, DEĞİŞTİRİLMEDİ). Bu bölümdeki HİÇBİR sabit/fonksiyon/regex bu
// turda değiştirilmedi.
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
  // ===== V5 MEKANİZMA 2 (v5'ten BİREBİR, İKİ DAR V6 DEĞİŞİKLİĞİ HARİÇ — bkz "V6 DEĞİŞİKLİK 1/2"
  // etiketli satırlar). Karar mercii: "bu segmentin çalıştırdığı komut bilinen bir OKUYUCU MU?"
  // =============================================================================================

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

  // V6 DEĞİŞİKLİK 1 (Ö3 kapanışı, docs/qa/hook-polarite-karari-2026-09-15.md §Ö3/madde 5):
  // `test` ve `[` eklendi — bkz dosya başı "V6 DEĞİŞİKLİK 1" yorumu (eylemsiz VE kendi
  // argümanları içinde başka bir komut ÇALIŞTIRMAYAN kabuk yerleşikleri; if/while/cd'nin aksine
  // B1 tarzı bir kör nokta AÇMAZLAR).
  const READER_HEADS_V5 = new Set([
    ...READER_HEADS,
    'sha256sum', 'sha1sum', 'sha512sum', 'md5sum', 'shasum', 'cksum', 'b2sum',
    'cd', 'pushd', 'popd', 'chdir', 'set-location', 'push-location', 'pop-location',
    'for', 'while', 'until', 'if', 'case',
    'test', '[',
  ]);

  const FIND_DESTRUCTIVE_FLAG_RE = /(-delete\b|-execdir\b|-okdir\b|-ok\b|-exec\b|-fprint0\b|-fprintf\b|-fprint\b|-fls\b)/i;
  function isFindReaderV5(seg) { return !FIND_DESTRUCTIVE_FLAG_RE.test(seg); }

  const DD_OF_RE_V5 = /\bdd\b[^\n]*\bof=/i;
  function isDdReaderV5(seg) { return !DD_OF_RE_V5.test(seg); }

  const SORT_OUTPUT_RE_V5 = /\bsort\b[^\n]*(-o\b|--output\b)/i;
  function isSortReaderV5(seg) { return !SORT_OUTPUT_RE_V5.test(seg); }

  const OPENSSL_OUT_RE_V5 = /\bopenssl\b[^\n]*-out\b/i;
  function isOpensslReaderV5(seg) { return !OPENSSL_OUT_RE_V5.test(seg); }

  const SED_INPLACE_RE_V5 = /\bsed\b[^\n]*(-i\b|--in-place\b)/i;
  function isSedReaderV5(seg) { return !SED_INPLACE_RE_V5.test(seg); }

  const GIT_READ_SUBCOMMANDS_V5 = new Set(['log', 'diff', 'show', 'status', 'blame', 'grep', 'cat-file', 'ls-files', 'rev-parse', 'add', 'commit']);
  function isGitReaderV5(seg) {
    const m = /\bgit\b\s+(?:--[\w-]+(?:=\S+)?\s+)*([A-Za-z-]+)(?:\s+([A-Za-z-]+))?/i.exec(seg);
    if (!m) return false;
    const sub = m[1].toLowerCase();
    if (sub === 'stash') return (m[2] || '').toLowerCase() === 'list';
    return GIT_READ_SUBCOMMANDS_V5.has(sub);
  }

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

  // P4 YOL NORMALİZASYONU (v5'ten BİREBİR) — yalnızca TESPİT için.
  function normalizePathText(seg) {
    let s = seg.split('\\').join('/');
    s = s.split('"').join('').split("'").join('');
    s = s.replace(/\/{2,}/g, '/');
    s = s.replace(/\/\.\//g, '/').replace(/^\.\//, '');
    return s;
  }
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
  // ===== V6 MEKANİZMA 4 YARDIMCILARI — "yorumlayıcı betik argümanı muafiyeti" (B4 kapanışı).
  // Mekanizma 2'nin (V6 DEĞİŞİKLİK 2) VE Mekanizma 3'ün opak-çalıştırıcı kuralının ORTAK
  // kullandığı, dar ve fail-closed bir yardımcı. Bkz dosya başı "V6 DEĞİŞİKLİK 2" yorumu.
  // =============================================================================================
  const INTERPRETER_EVAL_FLAGS_V6 = {
    node: ['-e', '--eval', '-p', '--print'],
    python: ['-c'],
    python3: ['-c'],
    py: ['-c'],
    perl: ['-e'],
    ruby: ['-e'],
  };
  const OPAQUE_INTERPRETER_RE_V6 = /\b(node|python3?|py|perl|ruby)\b/i;
  const OPAQUE_SHELL_RE_V6 = /\b(sh|bash|zsh|cmd|powershell|pwsh|eval|source)\b/i;

  // Segmentte GEÇEN (konumu ÖNEMSİZ) ilk tanınan yorumlayıcı adını ve ondan SONRAKİ ilk
  // konumsal (bayrak olmayan) argümanı bulur. Bayrak-değer ayrımı YAPMAZ (basit, fail-safe:
  // yanlış ayrıştırma yalnızca muafiyeti REDDETMEYE yol açar, asla YANLIŞLIKLA vermez —
  // resolvesInsideHooksDirV6 aşağıda ayrıca gerçek dosya varlığı + dizin sınırı ister).
  function findInterpreterScriptToken(seg) {
    const headMatch = OPAQUE_INTERPRETER_RE_V6.exec(seg);
    if (!headMatch) return null;
    const interp = headMatch[0].toLowerCase();
    const rest = seg.slice(headMatch.index + headMatch[0].length);
    const tokens = rest.match(/(?:"[^"]*"|'[^']*'|\S)+/g) || [];
    const evalFlags = INTERPRETER_EVAL_FLAGS_V6[interp] || [];
    for (const raw of tokens) {
      const t = raw.replace(/^["']+|["']+$/g, '');
      if (/^-/.test(t)) {
        if (evalFlags.indexOf(t) !== -1) return { hasEvalFlag: true, scriptToken: null };
        continue;
      }
      return { hasEvalFlag: false, scriptToken: t };
    }
    return { hasEvalFlag: false, scriptToken: null };
  }

  let HOOKS_DIR_REAL_V6 = null;
  try { HOOKS_DIR_REAL_V6 = fs.realpathSync.native(path.resolve(process.cwd(), '.claude', 'hooks')); } catch (_) { HOOKS_DIR_REAL_V6 = null; }

  function resolvesInsideHooksDirV6(scriptToken) {
    if (!HOOKS_DIR_REAL_V6 || !scriptToken) return false;
    let resolved;
    try { resolved = fs.realpathSync.native(path.resolve(process.cwd(), scriptToken)); } catch (_) { return false; }
    return resolved === HOOKS_DIR_REAL_V6 || resolved.indexOf(HOOKS_DIR_REAL_V6 + path.sep) === 0;
  }

  // interpreterExecutesOwnHooksScriptOnly(seg) -> string(scriptToken) | null
  // Brief şartları: (1) realpath ile çöz, çözemezsen fail-closed=null; (2) yalnızca yorumlayıcı
  // argümanı konumu, -e/-p/-c/--eval varsa muafiyet YOK.
  function interpreterExecutesOwnHooksScriptOnly(seg) {
    const info = findInterpreterScriptToken(seg);
    if (!info || info.hasEvalFlag) return null;
    if (info.scriptToken && resolvesInsideHooksDirV6(info.scriptToken)) return info.scriptToken;
    return null;
  }

  function removeFirstOccurrenceV6(seg, token) {
    const idx = seg.indexOf(token);
    if (idx === -1) return seg;
    return seg.slice(0, idx) + seg.slice(idx + token.length);
  }

  // =============================================================================================
  // ===== V6 MEKANİZMA 3 (YENİ, EKLENDİ — Mekanizma 1/2'ye dokunmadan) =========================
  // "Korunan yol bu segmentte bir YAZMA KONUMUNDA MI?" — head/reader kavramı KULLANILMAZ.
  // =============================================================================================
  function stripCommonV6(s) {
    s = s.split('"').join('').split("'").join('');
    s = s.replace(/\/{2,}/g, '/');
    s = s.replace(/\/\.\//g, '/').replace(/^\.\//, '');
    return s;
  }
  // B3 kapanışı: `\` bash'te HEM ayraç HEM kaçış olabilir, ayırt EDEMEYİZ -> iki yorumu da
  // üret (ayraç sayarak VE kaçış sayarak/silerek), HERHANGİ biri eşleşirse eşleşmiş SAY.
  function normalizeVariantsV6(text) {
    const asSeparator = stripCommonV6(text.split('\\').join('/'));
    const asEscape = stripCommonV6(text.split('\\').join(''));
    return [asSeparator, asEscape, text];
  }
  function mentionsProtectedV6(text, re) {
    const variants = normalizeVariantsV6(text);
    for (let k = 0; k < variants.length; k++) if (re.test(variants[k])) return true;
    return false;
  }
  const PARENT_TRAVERSAL_RE_V6 = /(^|[\\/])\.\.([\\/]|$)/;
  function mentionsApprovalsV6(text) {
    if (mentionsProtectedV6(text, approvalsRef)) return true;
    if (PARENT_TRAVERSAL_RE_V6.test(text) && /\b(docs|approvals)\b/i.test(text)) return true;
    return false;
  }
  function mentionsHooksV6(text) {
    if (mentionsProtectedV6(text, hooksRef)) return true;
    if (PARENT_TRAVERSAL_RE_V6.test(text) && /\b(\.claude|hooks|settings\.json)\b/i.test(text)) return true;
    return false;
  }

  // YAZMA KONUMU 1: yönlendirme hedefi. RAW segment üzerinde çalışır, okuyucu/okuyucu-olmama
  // FARK ETMEKSİZİN HER ZAMAN kontrol edilir (B2 kapanışı). `\d*` fd yönlendirmelerini
  // (`2>`) de kapsar; `>|` (clobber) `>\|?` ile tek token olarak yakalanır.
  const REDIRECT_TARGET_RE_V6 = /\d*(?:>>|>\|?|&>>?)(?!=)\s*([^\s;&|()<>]+)/g;

  // YAZMA KONUMU 2: bilinen bir yazıcının hedef argümanı. Komutun segmentte NEREDE olduğu
  // ÖNEMSİZ (bir "if "/"cd . && " öneki fark etmez) — yalnızca komut adı \b ile aranır, komut
  // adından segment sonuna kadar olan KUYRUK hedef bölgesi sayılır (kaba ama fail-safe; ölçülen
  // 34 komutluk FP korpusunda hiçbir yeni yanlış pozitif üretmedi, bkz sözleşme).
  const WRITER_TAIL_COMMANDS_V6 = [
    'cp', 'mv', 'install', 'ln', 'copy', 'move', 'ren', 'rename',
    'rm', 'unlink', 'del', 'erase', 'shred', 'truncate', 'chmod', 'chown', 'remove-item',
    'tee', 'gzip', 'gunzip', 'bzip2', 'xz', 'zip',
  ];
  function writerTailZonesV6(seg) {
    const zones = [];
    for (const cmdName of WRITER_TAIL_COMMANDS_V6) {
      const re = new RegExp('\\b' + cmdName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
      const m = re.exec(seg);
      if (m) zones.push(seg.slice(m.index + m[0].length));
    }
    return zones;
  }

  // YAZMA KONUMU 2b: bayrak-değerli hedefler (dd of=, sort -o/--output, openssl -out, patch).
  function flagValueZonesV6(seg) {
    const zones = [];
    let m;
    const ddRe = /\bdd\b[^\n]*\bof=([^\s;&|()<>]+)/i;
    if ((m = ddRe.exec(seg))) zones.push(m[1]);
    const sortRe = /\bsort\b[^\n]*(?:-o\b|--output\b)\s*=?\s*([^\s;&|()<>]+)/i;
    if ((m = sortRe.exec(seg))) zones.push(m[1]);
    const opensslRe = /\bopenssl\b[^\n]*-out\b\s*([^\s;&|()<>]+)/i;
    if ((m = opensslRe.exec(seg))) zones.push(m[1]);
    // patch: -i/--input DIŞINDAKİ ilk konumsal argüman hedef (dosyayı YERİNDE değiştirir).
    const patchRe = /\bpatch\b(.*)$/i;
    const pm = patchRe.exec(seg);
    if (pm) {
      const rest = pm[1].trim();
      if (rest) {
        const tokens = rest.split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];
          if (t === '-i' || t === '--input') { i++; continue; }
          if (/^-/.test(t)) continue;
          zones.push(t);
          break;
        }
      }
    }
    return zones;
  }

  // YAZMA KONUMU 3: yerinde-düzenleme konusu (sed -i/--in-place, perl -pi/-i, ruby -i). Bayrak
  // varlığı yeterince güçlü bir sinyal — TÜM segmenti (ham) hedef bölgesi sayarız.
  const INPLACE_EDIT_RE_V6 = /\b(sed|perl|ruby)\b[^\n]*(-i\b|--in-place\b|-pi\b)/i;

  function segmentWriteZonesV6(seg) {
    const zones = [];
    // Konum 1: yönlendirme hedefi -- RAW segment üzerinde, okuyucu/okuyucu-olmama FARK
    // ETMEKSİZİN (B2 kapanışı, brief §"okuyucu olsun olmasın HER ZAMAN kontrol edilir").
    REDIRECT_TARGET_RE_V6.lastIndex = 0;
    let rm;
    while ((rm = REDIRECT_TARGET_RE_V6.exec(seg))) zones.push(rm[1]);

    // Konum 2/2b/3/4: "gerçek bir komut mu çalıştırılıyor" sorusu. Mekanizma 1'in ORİJİNAL
    // (V5'in DEĞİL — bkz B1 kök nedeni) head/reader sınıflandırmasıyla tırnak-içi metni
    // maskele: F2/F3/F4/F5/F9/N1-TWIN/WL-SED-READ ailesini KORUR (grep/awk/sed/echo gibi bir
    // OKUYUCUNUN tırnaklı ARGÜMANI içindeki "rm"/"unlink" bir YAZICI ÇAĞRISI değil, aranan bir
    // METİN KALIBIDIR — self-test'te bu turda CANLI ölçüldü: maskeleme OLMADAN bu 7 vaka YANLIŞ
    // POZİTİF alıyordu). Mekanizma 1'in orijinal getHeadCommand/isReaderHead'i 'if'/'cd'/'while'
    // gibi kelimeleri READER saymadığı için (READER_HEADS_V5'in aksine) B1 sınıfı burada
    // YENİDEN AÇILMAZ — ör. "if node -p ...": head1="if", reader1=false, metin maskelenmez.
    const head1 = getHeadCommand(seg);
    const reader1 = isReaderHead(head1, seg);
    const textForCommandScan = reader1 ? maskQuoted(seg) : seg;

    zones.push(...writerTailZonesV6(textForCommandScan));
    zones.push(...flagValueZonesV6(textForCommandScan));
    if (INPLACE_EDIT_RE_V6.test(textForCommandScan)) zones.push(textForCommandScan);
    // YAZMA KONUMU 4: OPAK ÇALIŞTIRICI (fail-closed). Shell ailesi HER ZAMAN opak (muafiyet
    // yok, brief madde 4 ana kısmı). node/python/perl/ruby yalnızca "yorumlayıcı betik argümanı
    // muafiyeti" (V6 Mekanizma 4 yardımcıları) BAŞARISIZ olursa opak sayılır — başarılı olursa
    // yalnızca o TEK argüman çıkarılmış hâliyle (geri kalan metinde BAŞKA bir mention varsa
    // yine yakalanır) zon eklenir.
    if (OPAQUE_SHELL_RE_V6.test(textForCommandScan)) {
      zones.push(textForCommandScan);
    } else if (OPAQUE_INTERPRETER_RE_V6.test(textForCommandScan)) {
      const exemptToken = interpreterExecutesOwnHooksScriptOnly(textForCommandScan);
      if (exemptToken) zones.push(removeFirstOccurrenceV6(textForCommandScan, exemptToken));
      else zones.push(textForCommandScan);
    }
    return zones;
  }

  let isRelease = false;
  let isPush = false;
  let isDestructive = false;
  let isApprovalsWrite = false;
  let isHooksWrite = false;
  let guardedSegment = null;

  const anyMentionsApprovals = segments.some((s) => approvalsRef.test(s));
  const anyMentionsHooks = segments.some((s) => hooksRef.test(s));
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

    // ----- MEKANİZMA 2 (v5, İKİ dar V6 değişikliği hariç değişmedi) -----
    const headV5Resolved = getHeadCommandV5(seg);
    const hasCommandV5 = headV5Resolved !== '';
    const readerV5 = hasCommandV5 && isReaderHeadV5(headV5Resolved, seg);

    const approvalsRedirectV5 = /(?:>>|>\|?)(?!=)\s*['"]?docs[\\/]approvals\b/i;
    const hooksRedirectV5 = /(?:>>|>\|?)(?!=)\s*['"]?\.claude[\\/](hooks\b|settings\.json\b)/i;
    if (approvalsRedirectV5.test(seg) && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
    if (hooksRedirectV5.test(seg) && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }

    if (hasCommandV5 && !readerV5) {
      // V6 DEĞİŞİKLİK 2 (B4 kapanışı): hooks-anma kontrolü, yorumlayıcı betik argümanı
      // muafiyeti geçerliyse o TEK argüman çıkarılmış metin üzerinde çalışır. approvals-anma
      // kontrolü DEĞİŞMEDİ (muafiyet yalnızca .claude/hooks/ alanı için tanımlı, docs/approvals
      // altında çalıştırılabilir betik bulunmaz).
      const v6ExemptToken = OPAQUE_INTERPRETER_RE_V6.test(seg) ? interpreterExecutesOwnHooksScriptOnly(seg) : null;
      const segForHooksMentionV6 = v6ExemptToken ? removeFirstOccurrenceV6(seg, v6ExemptToken) : seg;

      if (mentionsApprovalsNormalized(seg) && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (mentionsHooksNormalized(segForHooksMentionV6) && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }

      const artifactsV5 = findBareProtectedArtifactsV5(seg);
      if (artifactsV5.ok && anyMentionsApprovalsV5 && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (artifactsV5.hook && anyMentionsHooksV5 && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }

      if (headV5Resolved.toLowerCase() === 'find') {
        if (artifactsV5.ok && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
        if (artifactsV5.hook && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
      }
    }

    if (headV5Resolved.toLowerCase() === 'xargs' && hasCommandV5 && !readerV5) {
      const leakV5 = checkXargsPipeLeak(segments, idx);
      if (leakV5 === 'approvals' && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (leakV5 === 'hooks' && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
    }
  }

  // ----- MEKANİZMA 3 (v6, YENİ — Mekanizma 1/2'nin döngüsünden TAMAMEN AYRI, ikinci geçiş) -----
  for (const seg of segments) {
    const zones = segmentWriteZonesV6(seg);
    for (const zone of zones) {
      if (mentionsApprovalsV6(zone) && !isApprovalsWrite) { isApprovalsWrite = true; if (!guardedSegment) guardedSegment = seg; }
      if (mentionsHooksV6(zone) && !isHooksWrite) { isHooksWrite = true; if (!guardedSegment) guardedSegment = seg; }
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
