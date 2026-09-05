import { describe, expect, it } from 'vitest'
import {
  indexOfColumn,
  nextColumnCoordinates,
  type ColumnRect,
} from '../../../../src/features/kanban/web/keyboardCoordinates'

const columns: ColumnRect[] = [
  { key: 'todo', left: 0, top: 0, width: 200, height: 400 },
  { key: 'contract', left: 210, top: 0, width: 200, height: 400 },
  { key: 'dev', left: 420, top: 0, width: 200, height: 400 },
]

describe('nextColumnCoordinates — saf index kaydırma (mutasyon 10)', () => {
  it('sağa → bir sonraki sütunun merkezi', () => {
    const result = nextColumnCoordinates(columns, 0, 'right')
    expect(result).toEqual({ index: 1, key: 'contract', x: 310, y: 200 })
  })

  it('sola → bir önceki sütunun merkezi', () => {
    const result = nextColumnCoordinates(columns, 1, 'left')
    expect(result).toEqual({ index: 0, key: 'todo', x: 100, y: 200 })
  })

  it('ilk sütunda sola → null (sınırda kalır)', () => {
    expect(nextColumnCoordinates(columns, 0, 'left')).toBeNull()
  })

  it('son sütunda sağa → null (sınırda kalır)', () => {
    expect(nextColumnCoordinates(columns, columns.length - 1, 'right')).toBeNull()
  })

  it('boş sütun listesi → null', () => {
    expect(nextColumnCoordinates([], 0, 'right')).toBeNull()
  })

  it('piksel artışı DEĞİL, sütun indeksi kaydırma: farklı genişlikli sütunlarda da doğru merkez döner', () => {
    const uneven: ColumnRect[] = [
      { key: 'a', left: 0, top: 10, width: 100, height: 300 },
      { key: 'b', left: 100, top: 10, width: 500, height: 300 },
    ]
    const result = nextColumnCoordinates(uneven, 0, 'right')
    expect(result).toEqual({ index: 1, key: 'b', x: 350, y: 160 })
  })
})

describe('indexOfColumn', () => {
  it('bulunan anahtarın indeksini döner', () => {
    expect(indexOfColumn(columns, 'dev')).toBe(2)
  })

  it('bulunamayan anahtar için -1 döner', () => {
    expect(indexOfColumn(columns, 'unknown')).toBe(-1)
  })
})
