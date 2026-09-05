// F-007 sözleşme §3 madde 3 — 7 bilinen durum + sıra + Türkçe etiket (ADR-001 karar 8: sütun
// başlığı biçimi "Etiket (kod)", ör. "Geliştirme (dev)"). "Bilinmeyen durum" sütunu (ADR-001
// karar 5) burada KASITLI OLARAK yok — yalnızca en az bir eşleşmeyen kart varsa istemci
// tarafından koşullu render edilir (`KanbanScreen.tsx`).
export const STATUS_COLUMNS = [
  { key: 'todo', label: 'Yapılacak' },
  { key: 'contract', label: 'Sözleşme' },
  { key: 'dev', label: 'Geliştirme' },
  { key: 'qa', label: 'QA' },
  { key: 'fix', label: 'Düzeltme' },
  { key: 'done', label: 'Bitti' },
  { key: 'blocked', label: 'Engelli' },
] as const

export type StatusColumnKey = (typeof STATUS_COLUMNS)[number]['key']
