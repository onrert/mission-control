// Stop: QA KALDI iken oturum "bitti" diyemez; ESKALE: true ile kullanıcıya soru sorulabilir.
const fs = require('fs');
const { readInput, block } = require('./_common');
readInput((j) => {
  if (j.stop_hook_active) process.exit(0);
  let t = '';
  try { t = fs.readFileSync('docs/qa/latest.md', 'utf8'); } catch (_) { process.exit(0); }
  if (/KARAR:\s*KALDI/i.test(t) && !/ESKALE:\s*(true|evet)/i.test(t)) {
    block("QA raporu KALDI (docs/qa/latest.md). Bulguları developer'a ver, düzelt ve qa-evaluator ile yeniden test et. 3 turdan sonra kullanıcıya eskale et ve latest.md'ye 'ESKALE: true' yaz.");
  }
  process.exit(0);
});
