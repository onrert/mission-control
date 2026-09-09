// F-008 sözleşmesi §5 — saf içerik biçimlendiricileri. `fs` importu YOK: hem sunucu (gerçekten
// yazılan içerik) hem istemci (adım-1 modalının önizlemesi) import edebilir, böylece önizleme
// ile gerçekte yazılan içerik BAYT BAYT aynı olur (ayrı bir `POST …/preview` ucu gerekmiyor).

/** `docs/approvals/<gate>.ok` içeriği — `docs/PROCESS.md` §2 biçimiyle birebir (§5). */
export function buildApprovalBody(
  gateId: string,
  label: string,
  projectLabel: string,
  isoDate: string,
  decision: string
): string {
  return (
    `${gateId} — ${label} kapısı ONAYLANDI\n` +
    `Tarih: ${isoDate}\n` +
    `Onaylayan: Panel kullanıcısı (Kapılar ekranı, iki adımlı onay)\n\n` +
    `Onaylanan özet: Panel Kapılar ekranından "${gateId} — ${label}" kapısı onaylandı ` +
    `(proje: ${projectLabel}).\n\n` +
    `Kullanıcının kararı: ${decision}\n`
  )
}

/** `docs/approvals/<gate>.deny.md` içeriği — markdown üslubu (§5, önceden hiç örneği yoktu). */
export function buildDenialBody(
  gateId: string,
  label: string,
  projectLabel: string,
  isoDate: string,
  reason: string
): string {
  return (
    `# ${gateId} — ${label} kapısı REDDEDİLDİ\n\n` +
    `- **Tarih:** ${isoDate}\n` +
    `- **Reddeden:** Panel kullanıcısı (Kapılar ekranı)\n` +
    `- **Proje:** ${projectLabel}\n\n` +
    `## Red gerekçesi\n\n` +
    `${reason}\n`
  )
}
