import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { hasHookInfrastructure, resolveProjectDir } from '../../electron/main.cjs'

// QA F-014 (2026-09-06, KALDI) H1 düzeltmesi — B2: barındırılan CEO oturumu paketlenmiş
// kopyada (`resources/app`) DEĞİL, gerçek proje dizininde çalışmalı; güvenlik kancaları
// (`.claude/settings.json` + `.claude/hooks/*.cjs`) yoksa oturum hiç açılmamalı.
//
// Bu dosya iki SAF fonksiyonu doğrudan test eder (runApp'a hiç ihtiyaç yok):
// `resolveProjectDir` (hangi dizin "gerçek proje dizini" sayılır) ve `hasHookInfrastructure`
// (o dizinde güvenlik kancaları var mı).

describe('resolveProjectDir — paketlenmiş kopya ASLA çalışma dizini olmaz', () => {
  it('MC_PROJECT_DIR verilmişse (yapılandırılabilir) her zaman onu kullanır, isPackaged farketmez', () => {
    const override = 'D:\\ozel\\proje\\yolu'
    expect(resolveProjectDir({ isPackaged: true }, { MC_PROJECT_DIR: override })).toBe(
      path.resolve(override)
    )
    expect(resolveProjectDir({ isPackaged: false }, { MC_PROJECT_DIR: override })).toBe(
      path.resolve(override)
    )
  })

  it('paketlenmemiş modda (isPackaged:false, override yok) main.cjs kendi __dirname’inden gerçek depo kökünü türetir', () => {
    const dir = resolveProjectDir({ isPackaged: false }, {})
    // main.cjs `electron/` klasöründedir; bir üstü depo köküdür.
    expect(path.basename(dir)).toBe('mission-control')
  })

  it('paketlenmiş modda (isPackaged:true, override yok) __dirname türetimine ASLA dönmez — ayrı, enjekte edilebilir bir kaynaktan okur', () => {
    const fakePackagedDefault = 'Z:\\bu-hicbir-zaman-__dirname-turevi-degil'
    const readPackagedDefaultFn = vi.fn(() => fakePackagedDefault)
    const dir = resolveProjectDir({ isPackaged: true }, {}, readPackagedDefaultFn)
    expect(dir).toBe(fakePackagedDefault)
    expect(readPackagedDefaultFn).toHaveBeenCalledTimes(1)
  })
})

describe('hasHookInfrastructure — hook koruması olmadan sohbet oturumu asla açılmaz', () => {
  function fakeFs(existing: Record<string, boolean>, hookFiles: string[] = []) {
    return {
      existsSync: (p: string) => existing[p] ?? false,
      readdirSync: () => hookFiles,
    }
  }

  it('.claude/settings.json yoksa false döner', () => {
    const fsImpl = fakeFs({})
    expect(hasHookInfrastructure('/fake/proje', fsImpl)).toBe(false)
  })

  it('.claude/settings.json var ama .claude/hooks yoksa false döner', () => {
    const fsImpl = fakeFs({ [path.join('/fake/proje', '.claude', 'settings.json')]: true })
    expect(hasHookInfrastructure('/fake/proje', fsImpl)).toBe(false)
  })

  it('.claude/hooks var ama içinde .cjs dosyası yoksa false döner (boş klasör korumasızdır)', () => {
    const fsImpl = fakeFs(
      {
        [path.join('/fake/proje', '.claude', 'settings.json')]: true,
        [path.join('/fake/proje', '.claude', 'hooks')]: true,
      },
      ['README.md']
    )
    expect(hasHookInfrastructure('/fake/proje', fsImpl)).toBe(false)
  })

  it('settings.json VE en az bir .cjs hook dosyası varsa true döner', () => {
    const fsImpl = fakeFs(
      {
        [path.join('/fake/proje', '.claude', 'settings.json')]: true,
        [path.join('/fake/proje', '.claude', 'hooks')]: true,
      },
      ['block-dangerous.cjs']
    )
    expect(hasHookInfrastructure('/fake/proje', fsImpl)).toBe(true)
  })

  it('gerçek depo kökünde (mevcut hook altyapısıyla) true döner', () => {
    const realRepoRoot = path.join(__dirname, '..', '..')
    expect(hasHookInfrastructure(realRepoRoot)).toBe(true)
  })
})
