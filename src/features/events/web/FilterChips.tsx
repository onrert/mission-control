interface FilterChipsProps {
  label: string
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
}

/**
 * Jenerik çoklu seçim çip grubu (sözleşme §2.1) — Proje/Agent/Tip için üç kez kullanılır.
 * Varsayılan "hepsi açık" çağıranın sorumluluğu (`selected` başlangıç değeri) — bu bileşen
 * yalnızca render + toggle'dır (Karpathy §2, gereksiz soyutlama yok).
 */
export function FilterChips({ label, options, selected, onToggle }: FilterChipsProps) {
  if (options.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={`filter-group-${label}`}>
      <span className="text-xs text-zinc-500">{label}:</span>
      {options.map((option) => {
        const isSelected = selected.has(option)
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(option)}
            className={
              isSelected
                ? 'min-h-8 rounded-full border border-amber-500 bg-amber-950 px-2.5 py-1 text-xs text-amber-300'
                : 'min-h-8 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300'
            }
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

interface ClearFiltersLinkProps {
  onClear: () => void
}

export function ClearFiltersLink({ onClear }: ClearFiltersLinkProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="min-h-8 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
    >
      Filtreleri temizle
    </button>
  )
}
