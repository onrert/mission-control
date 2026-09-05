import { describe, expect, it } from 'vitest'
import { computeResyncDecision, parseLastEventId } from '../../../src/server/sse/stream'

describe('computeResyncDecision', () => {
  const bounds = { from: 100, to: 139 }

  it('header yok (ilk bağlanma) -> none', () => {
    expect(computeResyncDecision(undefined, bounds)).toEqual({ type: 'none' })
  })

  it('ringBounds null (ring hiç dolmamış) -> resync', () => {
    expect(computeResyncDecision(100, null)).toEqual({ type: 'resync' })
  })

  it('lastEventId < from -> resync', () => {
    expect(computeResyncDecision(99, bounds)).toEqual({ type: 'resync' })
  })

  it('lastEventId === from -> replay', () => {
    expect(computeResyncDecision(100, bounds)).toEqual({ type: 'replay' })
  })

  it('lastEventId === to -> replay (boş replay + canlı akışa geç)', () => {
    expect(computeResyncDecision(139, bounds)).toEqual({ type: 'replay' })
  })

  it('lastEventId aralıkta -> replay', () => {
    expect(computeResyncDecision(120, bounds)).toEqual({ type: 'replay' })
  })

  it('lastEventId > to (istemci ileride) -> resync (Bulgu 3)', () => {
    expect(computeResyncDecision(140, bounds)).toEqual({ type: 'resync' })
  })

  it('lastEventId === from - 1 -> resync (bilinçli off-by-one, gereksiz ama kayıpsız)', () => {
    expect(computeResyncDecision(99, bounds)).toEqual({ type: 'resync' })
  })

  it.each(['', '1e3', ' 12 ', 'abc', '-1', '99999999999999999999999999'])(
    'bozuk Last-Event-ID (%s) -> ayrıştırma NaN, karar resync (Bulgu 7, kayıpsız taraf)',
    (raw) => {
      const parsed = parseLastEventId(raw)
      expect(Number.isNaN(parsed)).toBe(true)
      expect(computeResyncDecision(parsed, bounds)).toEqual({ type: 'resync' })
    }
  )
})

describe('parseLastEventId', () => {
  it('header yoksa undefined döner', () => {
    expect(parseLastEventId(undefined)).toBeUndefined()
  })

  it('geçerli tam sayı dizgesini ayrıştırır', () => {
    expect(parseLastEventId('140')).toBe(140)
    expect(parseLastEventId('0')).toBe(0)
  })

  it.each(['', '1e3', ' 12 ', 'abc', '-1', '99999999999999999999999999'])(
    '%s geçersiz -> NaN',
    (raw) => {
      expect(Number.isNaN(parseLastEventId(raw))).toBe(true)
    }
  )
})
