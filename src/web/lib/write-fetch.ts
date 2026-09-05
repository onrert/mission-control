import { WRITE_HEADER_NAME, WRITE_HEADER_VALUE } from '../../shared/types'

/**
 * ADR-013 (F-006 sözleşmesi §7) — istemci tarafındaki TEK sarmalayıcı. `fetch`'i sarar,
 * `init.headers`'a zorunlu yazma başlığını ekler. Yalnızca non-GET yazma çağrıları için
 * kullanılır; `GET` (`load()`) bunu kullanmaz. `/api/events` için de kullanılmaz — o uç
 * `x-mc-write`'tan muaf, yerine içerik-tipi allowlist'ine tabidir (CEO Karar 1).
 */
export function writeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: { ...init.headers, [WRITE_HEADER_NAME]: WRITE_HEADER_VALUE },
  })
}
