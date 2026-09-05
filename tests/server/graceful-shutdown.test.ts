import { describe, expect, it, vi } from 'vitest'
import { shutdown } from '../../src/server/index'

describe('shutdown (NOT-3 düzeltmesi)', () => {
  it('hub.closeAll() server.close()dan ÖNCE çağrılır, exit close callbackinden SONRA çağrılır', async () => {
    const callOrder: string[] = []
    const server = {
      close: (cb?: () => void) => {
        callOrder.push('server.close')
        cb?.()
      },
    }
    const hub = {
      closeAll: () => {
        callOrder.push('hub.closeAll')
      },
    }
    const exit = vi.fn((code: number) => {
      callOrder.push(`exit:${code}`)
    })

    shutdown(server, hub, exit)

    expect(callOrder).toEqual(['hub.closeAll', 'server.close', 'exit:0'])
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('server.close callbacki geç çalışırsa exit hâlâ callbackten sonra çağrılır', async () => {
    const callOrder: string[] = []
    let resolveClose: () => void = () => {}
    const closeSignal = new Promise<void>((resolve) => {
      resolveClose = resolve
    })
    const server = {
      close: (cb?: () => void) => {
        callOrder.push('server.close-called')
        void closeSignal.then(() => {
          callOrder.push('server.close-callback')
          cb?.()
        })
      },
    }
    const hub = {
      closeAll: () => {
        callOrder.push('hub.closeAll')
      },
    }
    const exit = vi.fn((code: number) => {
      callOrder.push(`exit:${code}`)
    })

    shutdown(server, hub, exit)
    expect(exit).not.toHaveBeenCalled()
    resolveClose()
    await closeSignal
    await new Promise((r) => setTimeout(r, 0))

    expect(callOrder).toEqual([
      'hub.closeAll',
      'server.close-called',
      'server.close-callback',
      'exit:0',
    ])
  })
})
