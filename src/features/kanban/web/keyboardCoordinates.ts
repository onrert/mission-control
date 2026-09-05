// F-007 sözleşme §2.1 — `@dnd-kit/core`'un `KeyboardSensor`'üne verilen `coordinateGetter`in
// SAF çekirdeği. `←`/`→` piksel artışı DEĞİL, sütun LİSTESİ üzerinde index kaydırmasıdır — bu
// yüzden gerçek dnd-kit `Coordinates`/`ClientRect` tiplerinden bağımsız, düz bir dizi + index
// alıp yeni index + merkez koordinat döner. Kolayca birim testlenir (jsdom layout gerektirmez).

export interface ColumnRect {
  key: string
  left: number
  top: number
  width: number
  height: number
}

export interface ColumnCoordinates {
  index: number
  key: string
  x: number
  y: number
}

function centerOf(rect: ColumnRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * `currentIndex`'ten `direction`'a göre bir sonraki/önceki sütunun merkez koordinatını döner.
 * Sınırda (ilk sütunda sola, son sütunda sağa) `null` döner — dnd-kit bu durumda mevcut
 * konumda kalır (sözleşmenin kapsamı: döngüsel gezinme İSTENMİYOR, yalnızca tablist ok tuşu
 * gezinmesi döngüseldir, kart taşıma değil).
 */
export function nextColumnCoordinates(
  columns: ColumnRect[],
  currentIndex: number,
  direction: 'left' | 'right'
): ColumnCoordinates | null {
  if (columns.length === 0) return null
  const delta = direction === 'left' ? -1 : 1
  const nextIndex = currentIndex + delta
  if (nextIndex < 0 || nextIndex >= columns.length) return null
  const rect = columns[nextIndex]
  if (!rect) return null
  const center = centerOf(rect)
  return { index: nextIndex, key: rect.key, ...center }
}

/** `columns` içinde `key`'in indeksini bulur; yoksa `-1`. */
export function indexOfColumn(columns: ColumnRect[], key: string): number {
  return columns.findIndex((c) => c.key === key)
}
