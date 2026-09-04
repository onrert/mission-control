import { describe, expect, it } from 'vitest'
import { parseLimit, parseSinceSeq } from '../../../../src/features/events/server/query'

describe('parseSinceSeq', () => {
  it('parametre yoksa -1 döner (tüm ring)', () => {
    expect(parseSinceSeq(null)).toBe(-1)
  })
  it('geçerli tamsayıyı döner', () => {
    expect(parseSinceSeq('40')).toBe(40)
  })
  it('0 geçerlidir', () => {
    expect(parseSinceSeq('0')).toBe(0)
  })
  it('sayı değilse invalid döner', () => {
    expect(parseSinceSeq('abc')).toBe('invalid')
  })
  it('negatifse invalid döner', () => {
    expect(parseSinceSeq('-1')).toBe('invalid')
  })
  it('ondalıklıysa invalid döner', () => {
    expect(parseSinceSeq('1.5')).toBe('invalid')
  })
})

describe('parseLimit', () => {
  it('parametre yoksa varsayılan 200 döner', () => {
    expect(parseLimit(null)).toBe(200)
  })
  it('geçerli değeri döner', () => {
    expect(parseLimit('50')).toBe(50)
  })
  it('sayı değilse varsayılana kırpılır (400 değil)', () => {
    expect(parseLimit('abc')).toBe(200)
  })
  it('0 veya negatifse varsayılana kırpılır', () => {
    expect(parseLimit('0')).toBe(200)
    expect(parseLimit('-5')).toBe(200)
  })
  it('1000den büyükse 1000e kırpılır', () => {
    expect(parseLimit('5000')).toBe(1000)
  })
  it('tam 1000 kabul edilir', () => {
    expect(parseLimit('1000')).toBe(1000)
  })
})
