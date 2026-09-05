import type http from 'node:http'

/**
 * SSE tel-formatının tek kaynağı (sözleşme §2.1). `id` verilmezse `id:` satırı hiç yazılmaz —
 * bu, `hello` çerçevesinin (F-003 Bulgu 2) `id:` TAŞIMAMASI gerektiği kuralı için kritiktir:
 * WHATWG `EventSource` spec'i her `id:` taşıyan çerçevede istemcinin "son olay kimliği"
 * tamponunu günceller; `hello`'ya sahte bir `id` koymak istemcinin `Last-Event-ID`'sini
 * gerçek olaylar hiç gelmeden ileri sıçratırdı (kalıcı veri kaybı riski).
 */
export function formatSseFrame(name: string, data: unknown, id?: number): string {
  const lines: string[] = [`event: ${name}`]
  if (id !== undefined) {
    lines.push(`id: ${id}`)
  }
  lines.push(`data: ${JSON.stringify(data)}`)
  return `${lines.join('\n')}\n\n`
}

export interface SseHub {
  /** Yeni bir SSE bağlantısını abone listesine ekler; çağrıldığında aboneliği kaldırır. */
  subscribe(res: http.ServerResponse): () => void
  /** Tüm abonelere fan-out. `name`/`data`/`id` `formatSseFrame`'e olduğu gibi geçer. */
  broadcast(name: string, data: unknown, id?: number): void
  /**
   * Tüm açık abonelere `res.end()` çağırır ve abone listesini boşaltır. Sözleşme §3 madde 2:
   * bu, `server.on('close', ...)`'a BAĞLANMAZ (o olay açık bir SSE soketi varken hiç
   * ateşlenmez) — üretimde yalnızca `shutdown()` (SIGINT/SIGTERM, `src/server/index.ts`)
   * tarafından çağrılır; test teardown'ı ayrı olarak `server.closeAllConnections()` kullanır.
   */
  closeAll(): void
  /** Test/gözlem amaçlı: şu an kaç açık abone var. */
  subscriberCount(): number
}

/** Bellek içi, dosya I/O'suz SSE kayıt defteri (sözleşme §2.1, §3 madde 1). */
export function createSseHub(): SseHub {
  const subscribers = new Set<http.ServerResponse>()

  function subscribe(res: http.ServerResponse): () => void {
    subscribers.add(res)
    return () => {
      subscribers.delete(res)
    }
  }

  function broadcast(name: string, data: unknown, id?: number): void {
    const frame = formatSseFrame(name, data, id)
    for (const res of subscribers) {
      res.write(frame)
    }
  }

  function closeAll(): void {
    for (const res of subscribers) {
      res.end()
    }
    subscribers.clear()
  }

  return {
    subscribe,
    broadcast,
    closeAll,
    subscriberCount: () => subscribers.size,
  }
}
