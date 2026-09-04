---
name: sprint
description: Sıradaki feature'ları üretir — sözleşme, uygulama, QA, düzeltme döngüsü; kilometre taşında G4 raporu.
argument-hint: [feature id'leri veya boş = sıradaki 1-3 feature] [--parallel]
---
Hedef: $ARGUMENTS

1. G2.ok yoksa dur ve kullanıcıya söyle. docs/features/ altında `status: todo` ve bağımlılıkları (`deps`) `done` olan feature'ları sırala; belirtilmediyse ilk 1–3'ünü seç (ilk sprint her zaman iskelet).
2. Her feature için: notu `status: contract` yap → developer'a brief ver (sözleşmeyi docs/qa/<feature>-contract.md'ye yazsın) → qa-evaluator sözleşmeyi incelesin → anlaşınca developer uygular (`status: dev`) → qa-evaluator test eder (`status: qa`) → KALDI ise `status: fix` ve düzeltme; 3 turdan sonra kullanıcıya eskale et (docs/qa/latest.md'ye `ESKALE: true`).
3. `--parallel` ve 3+ bağımsız feature varsa: her developer'ı `isolation: worktree` ile ayrı başlat; dosya sahipliği çakışmasın. Agent teams yalnızca kullanıcı isterse.
4. Sprint sonu: progress.md güncel, commit'ler atılmış, feature notları güncel. Kilometre taşıysa kullanıcıya G4 paketi ver: QA raporu özeti, çalıştırma komutu, ekran görüntüsü yolları, açık riskler, tüketim. G4 onayı gelince docs/approvals/G4-<n>.ok yaz ve /retro öner.
