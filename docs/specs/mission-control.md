# Spec: Mission Control (izleme paneli) — ileride /new-app ile üretilecek

## Amaç
Multica benzeri yerel pano: hangi agent ne yaptı, hangi feature nerede, agent'lar birbirine ne söyledi, kapılar, kullanım. Dış servis yok.

## Veri kaynakları (hepsi yerel)
1. Hook olayları: `.claude/hooks/send-event.js` (eklenecek) her olayı `http://localhost:4000/events`'e POST eder (session_id, agent_type/agent_id, tool_name, özet, zaman).
2. Artefaktlar: docs/features/*.md (frontmatter), docs/progress.md, docs/qa/*.md, docs/qa/*-contract.md, docs/approvals/, docs/blockers.md.
3. Transkriptler: `~/.claude/projects/<proje>/<session>/subagents/agent-*.jsonl`.
4. (Agent teams açıksa) `~/.claude/tasks/<team>/`, `~/.claude/teams/<team>/inboxes/*.json`.

## Ekranlar
- Pano: feature'lar status sütunlarında (todo/contract/dev/qa/fix/done/blocked); sürükleme frontmatter'ı günceller.
- Thread: feature başına CEO brief → developer raporu → QA kararı → düzeltme turları (sözleşme dosyaları + transkriptler).
- Zaman çizelgesi: agent aktiviteleri ve araç çağrıları (hook akışı).
- Kapılar: G0–G6 + ASSETS durumu; Onayla butonu `docs/approvals/<G>.ok` yazar; Reddet `docs/approvals/<G>.deny.md` yazar (CEO okur).
- Kullanım: transkriptlerdeki usage alanlarından agent/oturum başına token.

## Stack
Vite + React + TypeScript + Tailwind; Node (chokidar dosya izleme, better-sqlite3, SSE); `localhost:4000`; VS Code Simple Browser veya tarayıcı sekmesi; Tailscale ile telefondan.

## v2
~~Panodan CEO'ya mesaj: Claude Code Channels protokolüyle özel kanal (MCP sunucusu).~~

**2026-09-06'da değişti (kullanıcı kararı, `ADR-014`).** Channels yaklaşımı **reddedildi**:
panele *dışarıdaki* bir oturuma mesaj yollatmak yerine, panel CEO oturumunu
`@anthropic-ai/claude-agent-sdk` ile **kendi içinde barındırır** ve sohbet arayüzü olur.

Channels neden reddedildi (`docs/spikes/SPIKE-001-panelden-ceoya-mesaj.md`):
oturum `--channels` bayrağıyla **başlatılmak** zorunda (ayar dosyasından açılamıyor, sonradan
takılamıyor) · araştırma önizlemesi · kanal yüklenmemişse mesaj **hatasız, sessizce kayboluyor** ·
ve kullanıcının istediği şey mesaj enjeksiyonu değil, sohbetin panelde geçmesiydi.
