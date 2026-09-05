import { describe, expect, it } from 'vitest'
import { createSseHub, formatSseFrame } from '../../../src/server/sse/hub'

function fakeRes() {
  const written: string[] = []
  let ended = false
  return {
    written,
    get ended() {
      return ended
    },
    write(chunk: string) {
      written.push(chunk)
      return true
    },
    end() {
      ended = true
    },
  }
}

describe('formatSseFrame', () => {
  it('id verilmezse id: satırı yazmaz', () => {
    const frame = formatSseFrame('hello', { seq: 1 })
    expect(frame).not.toContain('id:')
    expect(frame).toBe('event: hello\ndata: {"seq":1}\n\n')
  })

  it('id verilirse id: satırı yazar', () => {
    const frame = formatSseFrame('event', { seq: 5 }, 5)
    expect(frame).toBe('event: event\nid: 5\ndata: {"seq":5}\n\n')
  })
})

describe('createSseHub', () => {
  it('subscribe sonrası broadcast tüm abonelere yazılır', () => {
    const hub = createSseHub()
    const resA = fakeRes()
    const resB = fakeRes()
    hub.subscribe(resA as never)
    hub.subscribe(resB as never)

    hub.broadcast('event', { seq: 1 }, 1)

    expect(resA.written).toEqual(['event: event\nid: 1\ndata: {"seq":1}\n\n'])
    expect(resB.written).toEqual(['event: event\nid: 1\ndata: {"seq":1}\n\n'])
  })

  it('unsubscribe sonrası o aboneye veri gitmez', () => {
    const hub = createSseHub()
    const res = fakeRes()
    const unsubscribe = hub.subscribe(res as never)
    unsubscribe()

    hub.broadcast('event', { seq: 1 }, 1)

    expect(res.written).toEqual([])
    expect(hub.subscriberCount()).toBe(0)
  })

  it('closeAll her abone res.end() çağırır ve listeyi boşaltır', () => {
    const hub = createSseHub()
    const resA = fakeRes()
    const resB = fakeRes()
    hub.subscribe(resA as never)
    hub.subscribe(resB as never)

    hub.closeAll()

    expect(resA.ended).toBe(true)
    expect(resB.ended).toBe(true)
    expect(hub.subscriberCount()).toBe(0)
  })
})
