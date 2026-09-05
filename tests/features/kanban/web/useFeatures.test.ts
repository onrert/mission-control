// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useFeatures } from '../../../../src/features/kanban/web/useFeatures'
import type { FeatureCard } from '../../../../src/shared/types'

afterEach(() => {
  cleanup()
})

function card(overrides: Partial<FeatureCard> = {}): FeatureCard {
  return {
    project_id: 'p1',
    file: 'F-001.md',
    id: 'F-001',
    title: 'Başlık',
    status: 'todo',
    column: 'todo',
    owner: 'developer',
    deps: [],
    sprint: '1',
    content_hash: 'hash-1',
    mtime_ms: 1000,
    ...overrides,
  }
}

// Mutasyon kanıtı (F-007 kod turu, D42): önceki hâl `data: cards` aynı dizi/nesne referansını
// her çağrıda döndürüyordu — bu, `mergeCards`'ın hash-bazlı birleştirmesi TAMAMEN kaldırılsa
// bile "aynı REFERANSI korur" testinin sahte biçimde YEŞİL kalmasına yol açıyordu (mock zaten
// aynı referansı veriyordu, üretim kodu hiç çalışmasa da assert geçerdi). Her çağrıda kartların
// SIĞ KOPYASI üretilerek (`{...c}`) gerçek bir referans farkı yaratılıyor — artık yalnızca
// `mergeCards` gerçekten önceki referansı koruyorsa test YEŞİL kalır.
function fetchReturning(cards: FeatureCard[]): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: cards.map((c) => ({ ...c })) }),
  })) as unknown as typeof fetch
}

describe('useFeatures — yükleme', () => {
  it('mount olunca GET /api/features çağrılır, kartlar yüklenir', async () => {
    const fetchImpl = fetchReturning([card()])
    const { result } = renderHook(() => useFeatures({ fetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(result.current.cards).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fetch reddi → loadState error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network')
    }) as unknown as typeof fetch
    const { result } = renderHook(() => useFeatures({ fetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('error'))
  })
})

describe('useFeatures — echo no-op (§4.4 madde 3, hash-bazlı birleştirme)', () => {
  it('aynı content_hash ile gelen refetch aynı kart REFERANSINI korur', async () => {
    const c = card()
    const fetchImpl = fetchReturning([c])
    const { result, rerender } = renderHook(
      ({ signal }: { signal: { project_id: string } | null }) =>
        useFeatures({ fetchImpl, featuresSignal: signal }),
      { initialProps: { signal: null as { project_id: string } | null } }
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    const firstRef = result.current.cards[0]
    const firstSyncedAt = result.current.lastSyncedAt

    rerender({ signal: { project_id: 'p1' } })
    // QA düzeltme turu 1 (D49/Ö4) — `waitFor(fetch çağrı SAYISI === 2)` YANLIŞ bir senkronizasyon
    // sinyaliydi: `vi.fn()` çağrı SAYISI, `fetchImpl` senkron olarak invoke edildiği anda artar —
    // `await`'ler henüz çözülmeden, yani React'in ikinci `setCards` commit'inden ÖNCE zaten 2'ye
    // ulaşabilir. Bu, assert'i `waitFor` içine almakla bile DÜZELMEZ (ölçüldü, bu turda): `waitFor`
    // callback'i İLK kez SENKRON çalıştığı için, tam o anda "çağrı sayısı=2 AMA state HÂLÂ eski
    // (`cards[0] === firstRef` triviyal doğru çünkü hiç değişmedi)" anını yakalayıp YANLIŞ-YEŞİL
    // verebiliyordu. Doğru senkronizasyon sinyali: `lastSyncedAt` — yalnızca `setCards` ile AYNI
    // senkron blokta, fetch+json ÇÖZÜLDÜKTEN SONRA güncellenir; değiştiğini görmek, `cards`
    // state'inin de AYNI COMMIT'te güncellendiğini garanti eder (React state batching).
    await waitFor(() => expect(result.current.lastSyncedAt).not.toBe(firstSyncedAt))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.current.cards[0]).toBe(firstRef)
  })

  it('farklı content_hash ile gelen refetch YENİ referans üretir (mutasyon 5 emsali — beklenen davranış)', async () => {
    const c = card()
    let currentCards = [c]
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: currentCards }),
    })) as unknown as typeof fetch
    const { result, rerender } = renderHook(
      ({ signal }: { signal: { project_id: string } | null }) =>
        useFeatures({ fetchImpl, featuresSignal: signal }),
      { initialProps: { signal: null as { project_id: string } | null } }
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    const firstRef = result.current.cards[0]

    currentCards = [card({ status: 'qa', column: 'qa', content_hash: 'hash-2' })]
    rerender({ signal: { project_id: 'p1' } })
    await waitFor(() => expect(result.current.cards[0]).not.toBe(firstRef))
    expect(result.current.cards[0]?.status).toBe('qa')
  })

  it('sonsuz döngü imkansızlığı: N sinyal → N ek fetch, doğrusal (katlanarak artmaz)', async () => {
    const fetchImpl = fetchReturning([card()])
    const { result, rerender } = renderHook(
      ({ signal }: { signal: { project_id: string } | null }) =>
        useFeatures({ fetchImpl, featuresSignal: signal }),
      { initialProps: { signal: null as { project_id: string } | null } }
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 5; i++) {
      rerender({ signal: { project_id: `p${i}` } })
      await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2 + i))
    }
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })
})

describe('useFeatures — ADR-004 y4 (sürüklerken gelen sinyal kuyruklanır, §4.4 madde 6, mutasyon 6)', () => {
  it('sürükleme sırasında 3 sinyal → hiç fetch yok; bitince proje başına TEK refetch', async () => {
    const fetchImpl = fetchReturning([card()])
    const { result, rerender } = renderHook(
      ({ signal }: { signal: { project_id: string } | null }) =>
        useFeatures({ fetchImpl, featuresSignal: signal }),
      { initialProps: { signal: null as { project_id: string } | null } }
    )
    await waitFor(() => expect(result.current.loadState).toBe('ready'))
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    act(() => result.current.notifyDragStart())

    rerender({ signal: { project_id: 'p1' } })
    rerender({ signal: { project_id: 'p1' } })
    rerender({ signal: { project_id: 'p2' } })
    // Kuyruklandı, sürükleme sürerken hiç ek fetch olmamalı.
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    act(() => result.current.notifyDragEnd())
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    // Kuyruk boşaltıldıktan sonra yeni bir sinyal tekrar normal (kuyruksuz) işlenir.
    rerender({ signal: { project_id: 'p3' } })
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3))
  })
})

describe('useFeatures — patchStatus (§3 madde 8, AC4/AC5)', () => {
  it('200 → optimistik durum sunucunun döndürdüğü GERÇEK karta göre düzeltilir', async () => {
    const c = card()
    const fetchImpl = fetchReturning([c])
    const serverCard = card({ status: 'qa', column: 'qa', content_hash: 'hash-2' })
    const writeFetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: serverCard }),
    })) as unknown as typeof fetch

    const { result } = renderHook(() => useFeatures({ fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    let outcome: Awaited<ReturnType<typeof result.current.patchStatus>> | undefined
    await act(async () => {
      outcome = await result.current.patchStatus(c, 'qa')
    })
    expect(outcome?.kind).toBe('success')
    expect(result.current.cards[0]).toEqual(serverCard)
    expect(result.current.isPending(c)).toBe(false)
  })

  it('409 conflict (AC4) → kart sunucunun disk-güncel verisine göre yeniden çizilir, sessizce üzerine yazılmaz', async () => {
    const c = card()
    const fetchImpl = fetchReturning([c])
    const diskCard = card({ status: 'fix', column: 'fix', content_hash: 'hash-3' })
    const writeFetchImpl = vi.fn(async () => ({
      ok: true,
      status: 409,
      json: async () => ({
        success: false,
        error: { code: 'conflict', message: 'Dosya değişti, güncel hali yüklendi.' },
        data: diskCard,
      }),
    })) as unknown as typeof fetch

    const { result } = renderHook(() => useFeatures({ fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    let outcome: Awaited<ReturnType<typeof result.current.patchStatus>> | undefined
    await act(async () => {
      outcome = await result.current.patchStatus(c, 'qa')
    })
    expect(outcome?.kind).toBe('conflict')
    expect(result.current.cards[0]).toEqual(diskCard)
    expect(result.current.cards[0]?.column).toBe('fix')
  })

  it('500/403/400 (AC5) → kart eski sütununa GERİ DÖNER (rollback), hata mesajı döner', async () => {
    const c = card()
    const fetchImpl = fetchReturning([c])
    const writeFetchImpl = vi.fn(async () => ({
      ok: true,
      status: 500,
      json: async () => ({
        success: false,
        error: { code: 'write_failed', message: 'Dosyaya yazma izni reddedildi.' },
      }),
    })) as unknown as typeof fetch

    const { result } = renderHook(() => useFeatures({ fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    let outcome: Awaited<ReturnType<typeof result.current.patchStatus>> | undefined
    await act(async () => {
      outcome = await result.current.patchStatus(c, 'qa')
    })
    expect(outcome?.kind).toBe('error')
    expect(result.current.cards[0]).toEqual(c)
    expect(result.current.cards[0]?.status).toBe('todo')
    expect(result.current.isPending(c)).toBe(false)
  })

  it('200 success ama data YOK (yarı-başarı, D46) → rollback YAPILMAZ, iyimser durum korunur', async () => {
    // QA düzeltme turu 1 (BLOKLAYICI B1, CEO kararı D46 madde 2): sunucu yazmayı diske
    // uyguladı ama `rereadCard` başarısız olduğu için `data` göndermedi. İyimser görünüm
    // (zaten `nextStatus`'a ayarlanmış) rollback edilmemeli — disk zaten o durumda.
    const c = card()
    const fetchImpl = fetchReturning([c])
    const writeFetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch

    const { result } = renderHook(() => useFeatures({ fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    let outcome: Awaited<ReturnType<typeof result.current.patchStatus>> | undefined
    await act(async () => {
      outcome = await result.current.patchStatus(c, 'qa')
    })
    expect(outcome?.kind).toBe('success')
    expect(result.current.cards[0]?.status).toBe('qa')
    expect(result.current.isPending(c)).toBe(false)
  })

  it('ağ hatası (fetch reddi) → rollback + jenerik mesaj', async () => {
    const c = card()
    const fetchImpl = fetchReturning([c])
    const writeFetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useFeatures({ fetchImpl, writeFetchImpl }))
    await waitFor(() => expect(result.current.loadState).toBe('ready'))

    let outcome: Awaited<ReturnType<typeof result.current.patchStatus>> | undefined
    await act(async () => {
      outcome = await result.current.patchStatus(c, 'qa')
    })
    expect(outcome?.kind).toBe('error')
    expect(result.current.cards[0]).toEqual(c)
  })
})
