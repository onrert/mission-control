import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncer } from '../../../src/server/watch/debounce'

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('art arda 5 trigger() çağrısı -> yalnızca 1 callback, 150 ms sonra', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(150, callback)

    debouncer.trigger()
    vi.advanceTimersByTime(50)
    debouncer.trigger()
    vi.advanceTimersByTime(50)
    debouncer.trigger()
    vi.advanceTimersByTime(50)
    debouncer.trigger()
    vi.advanceTimersByTime(50)
    debouncer.trigger()

    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(150)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('cancel() sonrası zamanlayıcı ateşlemez', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(150, callback)
    debouncer.trigger()
    debouncer.cancel()
    vi.advanceTimersByTime(500)
    expect(callback).not.toHaveBeenCalled()
  })

  it('trigger sonrası tam delayMs geçince callback bir kez çağrılır', () => {
    const callback = vi.fn()
    const debouncer = createDebouncer(150, callback)
    debouncer.trigger()
    vi.advanceTimersByTime(150)
    expect(callback).toHaveBeenCalledTimes(1)
    debouncer.trigger()
    vi.advanceTimersByTime(150)
    expect(callback).toHaveBeenCalledTimes(2)
  })
})
