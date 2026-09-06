import type { Options, Query, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatQueryFn } from '../../src/features/chat/server/session'

/**
 * Sohbet SDK oturumunu (`session.ts`) enjekte edilmiş sahte bir `query()` ile test etmek için
 * ortak yardımcı. Her çağrı (`bootstrap`/`restart` başına bir tane) kendi `FakeQueryHandle`'ını
 * üretir; testler bunları `getHandles()` ile sırayla alır.
 */
export interface FakeQueryHandle {
  /** SDK'nın gerçek mesaj akışını taklit eder: bir mesaj "gelmiş" gibi davranır. */
  emit(message: Record<string, unknown>): void
  /** Generator'ı normal şekilde bitirir (gerçek `close()`/doğal bitiş). */
  finish(): void
  /** Generator'ı bir hatayla bitirir (§9 hata sınırı testleri için). */
  throwError(err: unknown): void
  readonly options: Options
  readonly prompt: AsyncIterable<SDKUserMessage>
  interruptCalls: number
  closeCalls: number
}

export function createFakeQueryFactory(): {
  queryFn: ChatQueryFn
  getHandles: () => FakeQueryHandle[]
} {
  const handles: FakeQueryHandle[] = []

  const queryFn: ChatQueryFn = (params) => {
    const outQueue: Array<
      { kind: 'message'; value: Record<string, unknown> } | { kind: 'error'; value: unknown }
    > = []
    let notify: (() => void) | null = null
    let finished = false

    function wake(): void {
      if (notify) {
        const n = notify
        notify = null
        n()
      }
    }

    const handle: FakeQueryHandle = {
      emit(message) {
        outQueue.push({ kind: 'message', value: message })
        wake()
      },
      finish() {
        finished = true
        wake()
      },
      throwError(err) {
        outQueue.push({ kind: 'error', value: err })
        wake()
      },
      options: params.options,
      prompt: params.prompt,
      interruptCalls: 0,
      closeCalls: 0,
    }
    handles.push(handle)

    const gen = (async function* (): AsyncGenerator<Record<string, unknown>, void> {
      while (true) {
        if (outQueue.length > 0) {
          const next = outQueue.shift()!
          if (next.kind === 'error') throw next.value
          yield next.value
        } else if (finished) {
          return
        } else {
          await new Promise<void>((resolve) => {
            notify = resolve
          })
        }
      }
    })()

    const fakeQuery = Object.assign(gen, {
      interrupt: async () => {
        handle.interruptCalls++
        return undefined
      },
      close: () => {
        handle.closeCalls++
        handle.finish()
      },
    })
    return fakeQuery as unknown as Query
  }

  return { queryFn, getHandles: () => handles }
}
