// UX doc "Bilgi yoğunluğu" madde 5: her izlenen projeye 6 tonluk sabit bir palet
// döngüsünden bir renk atanır (semantik değil, yalnızca ayırt edicilik içindir).
const PALETTE: Array<{ text: string; border: string }> = [
  { text: 'text-sky-300', border: 'border-sky-800' },
  { text: 'text-emerald-300', border: 'border-emerald-700' },
  { text: 'text-amber-300', border: 'border-amber-700' },
  { text: 'text-fuchsia-300', border: 'border-fuchsia-700' },
  { text: 'text-cyan-300', border: 'border-cyan-800' },
  { text: 'text-orange-300', border: 'border-orange-700' },
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Saf fonksiyon: proje adından sabit bir Tailwind sınıf çifti döner (aynı ad = aynı renk). */
export function projectColor(projectName: string): { text: string; border: string } {
  if (projectName.length === 0) return PALETTE[0]!
  const index = hashString(projectName) % PALETTE.length
  return PALETTE[index]!
}
