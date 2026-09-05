import http from 'node:http'

export interface SseFrame {
  event: string
  id?: string
  data: string
}

export interface SseClient {
  frames: SseFrame[]
  waitForFrame(predicate: (frame: SseFrame) => boolean, timeoutMs?: number): Promise<SseFrame>
  close(): void
  /** Yanıt akışının `'end'`/`'close'` olayında çözülür — istemci tarafında akışın gerçekten sonlandığını gözlemlemek için. */
  closed: Promise<void>
}

/**
 * `node:http` ile `/api/stream`'e bağlanır, ham `text/event-stream` gövdesini `\n\n` sınırına
 * göre çerçevelere ayırır (sözleşme §2.1). Gerçek soket kullanır — mock yok.
 */
export function connectSse(port: number, headers: Record<string, string> = {}): Promise<SseClient> {
  return new Promise((resolve, reject) => {
    const frames: SseFrame[] = []
    const waiters: Array<{
      predicate: (frame: SseFrame) => boolean
      resolve: (frame: SseFrame) => void
    }> = []
    let closedResolve: () => void
    const closed = new Promise<void>((r) => {
      closedResolve = r
    })

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/stream',
        method: 'GET',
        headers: { accept: 'text/event-stream', ...headers },
      },
      (res) => {
        let buffer = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          buffer += chunk
          let boundary = buffer.indexOf('\n\n')
          while (boundary !== -1) {
            const rawFrame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            if (rawFrame.trim().length > 0 && !rawFrame.startsWith(':')) {
              const frame: SseFrame = { event: 'message', data: '' }
              for (const line of rawFrame.split('\n')) {
                if (line.startsWith('event: ')) frame.event = line.slice('event: '.length)
                else if (line.startsWith('id: ')) frame.id = line.slice('id: '.length)
                else if (line.startsWith('data: ')) frame.data = line.slice('data: '.length)
              }
              frames.push(frame)
              for (let i = waiters.length - 1; i >= 0; i--) {
                const waiter = waiters[i]!
                if (waiter.predicate(frame)) {
                  waiters.splice(i, 1)
                  waiter.resolve(frame)
                }
              }
            }
            boundary = buffer.indexOf('\n\n')
          }
        })
        res.on('end', () => closedResolve())
        res.on('close', () => closedResolve())
        resolve({
          frames,
          waitForFrame(predicate, timeoutMs = 2000) {
            const existing = frames.find(predicate)
            if (existing) return Promise.resolve(existing)
            return new Promise((res2, rej2) => {
              const timer = setTimeout(() => {
                const idx = waiters.findIndex((w) => w.predicate === predicate)
                if (idx !== -1) waiters.splice(idx, 1)
                rej2(new Error(`waitForFrame: ${timeoutMs}ms içinde eşleşen çerçeve gelmedi`))
              }, timeoutMs)
              waiters.push({
                predicate,
                resolve: (frame) => {
                  clearTimeout(timer)
                  res2(frame)
                },
              })
            })
          },
          close() {
            req.destroy()
          },
          closed,
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}
