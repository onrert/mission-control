import { describe, expect, it } from 'vitest'
import { projectColor } from '../../../../src/features/events/web/projectColor'

describe('projectColor', () => {
  it('aynı proje adı her zaman aynı rengi döner', () => {
    expect(projectColor('mission-control')).toEqual(projectColor('mission-control'))
  })

  it('farklı adlar (genellikle) farklı renk döner', () => {
    expect(projectColor('mission-control')).not.toEqual(projectColor('app-factory'))
  })

  it('boş dizge güvenli bir varsayılan döner', () => {
    const c = projectColor('')
    expect(c.text).toMatch(/^text-/)
    expect(c.border).toMatch(/^border-/)
  })
})
