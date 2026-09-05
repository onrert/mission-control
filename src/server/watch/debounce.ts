/**
 * Trailing debounce (sözleşme §3 madde 2, mimari §6.1'in kendi 150 ms sayısı). Saf, gerçek
 * `setTimeout` kullanır (zamanlayıcı enjekte edilebilir değil — testler `vi.useFakeTimers()`
 * kullanır). Her `trigger()` bekleyen zamanlayıcıyı sıfırlar.
 */
export interface Debouncer {
  trigger(): void
  cancel(): void
}

export function createDebouncer(delayMs: number, callback: () => void): Debouncer {
  let timer: ReturnType<typeof setTimeout> | undefined

  function trigger(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      callback()
    }, delayMs)
  }

  function cancel(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  return { trigger, cancel }
}
