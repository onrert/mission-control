import { useCallback, useEffect, useState } from 'react'
import type { ApiResponse, GateStatusItem, GatesListResponse } from '../../../shared/types'
import { writeFetch } from '../../../web/lib/write-fetch'

export type GatesLoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface UseGatesOptions {
  /** `null` — "önce bir proje seçin" durumu (§3, boş durum tablosu). */
  projectId: string | null
  /** App.tsx'in `onGates` akışından gelen sinyal — `onFeatures` ile BİREBİR aynı desen (§7). */
  gatesSignal?: { project_id: string } | null
  fetchImpl?: typeof fetch
  writeFetchImpl?: typeof fetch
}

export type GateActionOutcome =
  | { kind: 'success'; item: GateStatusItem }
  | { kind: 'conflict'; item: GateStatusItem; message: string }
  | { kind: 'error'; message: string }

export interface UseGatesResult {
  gates: GateStatusItem[]
  unrecognized: string[]
  processDocReadable: boolean
  loadState: GatesLoadState
  retry: () => void
  approve: (gateId: string, decision: string) => Promise<GateActionOutcome>
  deny: (gateId: string, reason: string) => Promise<GateActionOutcome>
}

const GENERIC_NETWORK_ERROR_MESSAGE = 'Kaydedilemedi, tekrar deneyin.'

/**
 * F-008 sözleşmesi §10.1 — Kapılar ekranının veri katmanı. `useFeatures`'ın YÜKLEME/yeniden-
 * yükleme desenini (AYRI bir soyutlama İCAT ETMEDEN) tekrarlar: mount/`projectId` değişiminde
 * `GET /api/gates`, `gatesSignal` (SSE `gates` kanalı) geldiğinde yeniden yükleme. `approve`/
 * `deny` iyimser DEĞİL (kanban'ın `patchStatus`'unun aksine) — iki adımlı onay zaten kullanıcıyı
 * yavaşlattığı için (§4/AC7), sunucu yanıtını bekleyip state'i ona göre günceller; hata durumunda
 * (AC5) hiçbir yerel state DEĞİŞMEDİĞİ için "rollback" gerekmez — modal/form kendi `decision`/
 * `reason` metnini KORUR (bu, `ApproveModal`/`DenyInlineForm`'un kendi state'i, burada değil).
 */
export function useGates(options: UseGatesOptions): UseGatesResult {
  const { projectId } = options
  const fetchImpl = options.fetchImpl ?? fetch
  const writeFetchImpl = options.writeFetchImpl ?? writeFetch

  const [gates, setGates] = useState<GateStatusItem[]>([])
  const [unrecognized, setUnrecognized] = useState<string[]>([])
  const [processDocReadable, setProcessDocReadable] = useState(true)
  const [loadState, setLoadState] = useState<GatesLoadState>('idle')

  const refetch = useCallback(async () => {
    if (projectId === null) {
      setGates([])
      setUnrecognized([])
      setLoadState('idle')
      return
    }
    setLoadState((prev) => (prev === 'ready' ? prev : 'loading'))
    try {
      const res = await fetchImpl(`/api/gates?project_id=${encodeURIComponent(projectId)}`)
      if (!res.ok) throw new Error(`http_${res.status}`)
      const body = (await res.json()) as ApiResponse<GatesListResponse>
      if (!body.success || !body.data) throw new Error('invalid_response')
      setGates(body.data.gates)
      setUnrecognized(body.data.unrecognized)
      setProcessDocReadable(body.data.process_doc_readable)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [projectId, fetchImpl])

  useEffect(() => {
    void refetch()
    // `projectId` değiştiğinde yeniden yükle — bu proje `eslint-plugin-react-hooks` kullanmıyor
    // (`eslint.config.js`), `refetch`'i bağımlılığa eklemek gereksiz (yalnızca `projectId`/
    // `fetchImpl` değiştiğinde yeni bir referans alır, aynı davranış).
  }, [projectId])

  useEffect(() => {
    const signal = options.gatesSignal
    if (!signal || projectId === null) return
    if (signal.project_id !== projectId) return
    void refetch()
    // `options.gatesSignal` her `gates` yayınında YENİ bir nesne referansı (`onFeatures` deseni).
  }, [options.gatesSignal])

  const runAction = useCallback(
    async (
      gateId: string,
      action: 'approve' | 'deny',
      body: Record<string, unknown>
    ): Promise<GateActionOutcome> => {
      if (projectId === null) return { kind: 'error', message: GENERIC_NETWORK_ERROR_MESSAGE }
      try {
        const res = await writeFetchImpl(
          `/api/gates/${encodeURIComponent(projectId)}/${encodeURIComponent(gateId)}/${action}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }
        )
        const parsed = (await res.json()) as ApiResponse<GateStatusItem>

        if (res.status === 200 && parsed.success && parsed.data) {
          const fresh = parsed.data
          setGates((prev) => prev.map((g) => (g.id === fresh.id ? fresh : g)))
          return { kind: 'success', item: fresh }
        }

        if (res.status === 409 && parsed.data) {
          // §4 B6 — onaylı bir kapıda `deny` denemesi: dosya yazılmadı, taze durum döndü.
          const fresh = parsed.data
          setGates((prev) => prev.map((g) => (g.id === fresh.id ? fresh : g)))
          return {
            kind: 'conflict',
            item: fresh,
            message: parsed.error?.message ?? 'Bu kapı zaten onaylı, reddedilemez.',
          }
        }

        if (parsed.data) {
          // §6 yarı-başarı — 500 ama taze `data` var (arşivlendi, onay yazılamadı): kapı şu an
          // gerçekten `pending`, listeyi buna göre düzelt (rollback değil, dürüst güncelleme).
          const fresh = parsed.data
          setGates((prev) => prev.map((g) => (g.id === fresh.id ? fresh : g)))
        }
        return {
          kind: 'error',
          message: parsed.error?.message ?? GENERIC_NETWORK_ERROR_MESSAGE,
        }
      } catch {
        return { kind: 'error', message: GENERIC_NETWORK_ERROR_MESSAGE }
      }
    },
    [projectId, writeFetchImpl]
  )

  const approve = useCallback(
    (gateId: string, decision: string) =>
      runAction(gateId, 'approve', { confirmed: true, decision }),
    [runAction]
  )

  const deny = useCallback(
    (gateId: string, reason: string) => runAction(gateId, 'deny', { reason }),
    [runAction]
  )

  return {
    gates,
    unrecognized,
    processDocReadable,
    loadState,
    retry: () => void refetch(),
    approve,
    deny,
  }
}
