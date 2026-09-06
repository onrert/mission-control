// @vitest-environment jsdom
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatScreen } from '../../../../src/features/chat/web/ChatScreen'
import {
  useChatSession,
  type UseChatSessionResult,
} from '../../../../src/features/chat/web/useChatSession'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** `GET /api/chat/status`/`history` boş/etkisiz yanıt verir; `POST` çağrıları `fetchMock`
 *  üzerinden gözlemlenir (`writeFetch` da global `fetch`'i kullandığı için tek stub yeterli —
 *  `tests/features/kanban/web/KanbanScreen.test.tsx`'in kurduğu desenin BİREBİR tekrarı). */
function stubFetch() {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.includes('/api/chat/history')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { entries: [], has_more: false } }),
      } as Response
    }
    if (url.includes('/api/chat/status')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            session_active: true,
            session_id: 's1',
            busy: false,
            api_key_barrier_tripped: false,
            stripped_env_vars: [],
            chat_enabled: true,
            api_key_helper_configured: false,
          },
        }),
      } as Response
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {} }),
    } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

/** `useChatSession` doğrudan bir `ref`e yayınlanır ki testler `handlers.onChatXxx`'i (SSE
 *  olayı gelmiş gibi) doğrudan çağırabilsin — gerçek bir `EventSource` açılmaz. */
function Harness({ chatRef }: { chatRef: React.MutableRefObject<UseChatSessionResult | null> }) {
  const chat = useChatSession()
  useEffect(() => {
    chatRef.current = chat
  })
  return <ChatScreen chat={chat} />
}

async function renderHarness() {
  const chatRef = { current: null as UseChatSessionResult | null }
  render(<Harness chatRef={chatRef} />)
  await act(async () => {
    await Promise.resolve()
  })
  return chatRef
}

describe('ChatScreen — boş durum ve mesaj gönderme (AC1)', () => {
  it('geçmiş boşken metin sözlüğündeki boş durum metni görünür', async () => {
    stubFetch()
    await renderHarness()
    expect(screen.getByText(/Henüz konuşma yok\. CEO'ya ilk mesajını yaz/)).toBeTruthy()
  })

  it('Enter mesajı gönderir (x-mc-write başlığıyla), Shift+Enter yeni satır ekler ve GÖNDERMEZ', async () => {
    const { fetchMock, calls } = stubFetch()
    await renderHarness()
    const textarea = screen.getByPlaceholderText('CEO’ya yaz…') as HTMLTextAreaElement

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'ilk satır' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    })
    // Shift+Enter submit ETMEDİ — /api/chat/message'a hiç POST gitmedi.
    expect(calls.some((c) => c.url.includes('/api/chat/message'))).toBe(false)

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'merhaba CEO' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })
    })

    const messageCall = calls.find((c) => c.url.includes('/api/chat/message'))
    expect(messageCall).toBeTruthy()
    const headers = messageCall!.init!.headers as Record<string, string>
    expect(headers['x-mc-write']).toBe('1')
    expect(JSON.parse(messageCall!.init!.body as string)).toEqual({ text: 'merhaba CEO' })
    expect(fetchMock).toHaveBeenCalled()
  })
})

describe('ChatScreen — akış hâlinde cevap (AC1 streaming)', () => {
  it('delta olayları balonu büyütür, done:true imleci kaldırır', async () => {
    stubFetch()
    const chatRef = await renderHarness()

    await act(async () => {
      chatRef.current!.handlers.onChatMessage({
        turn_id: 't1',
        chat_seq: 1,
        delta: 'Mer',
        done: false,
      })
    })
    expect(screen.getByText(/Mer▍|Mer/)).toBeTruthy()

    await act(async () => {
      chatRef.current!.handlers.onChatMessage({
        turn_id: 't1',
        chat_seq: 2,
        delta: 'haba',
        done: false,
      })
    })
    expect(screen.getByText('Merhaba')).toBeTruthy()

    await act(async () => {
      chatRef.current!.handlers.onChatMessage({ turn_id: 't1', chat_seq: 3, delta: '', done: true })
    })
    expect(screen.getByText('Merhaba')).toBeTruthy()
    expect(screen.queryByText('▍')).toBeNull()
  })
})

describe('ChatScreen — izin isteği: otomatik onay YOK (K3)', () => {
  it('kart göründüğünde HİÇBİR /api/chat/permission çağrısı atılmaz; yalnızca Onayla tıklanınca gider', async () => {
    const { calls } = stubFetch()
    const chatRef = await renderHarness()

    await act(async () => {
      chatRef.current!.handlers.onChatPermissionRequest({
        request_id: 'r1',
        turn_id: 't1',
        tool_name: 'Bash',
        input_preview: 'npm test',
        ts: new Date().toISOString(),
      })
    })

    expect(screen.getByText('İzin isteği')).toBeTruthy()
    expect(screen.getByText(/CEO şu aracı çalıştırmak istiyor: Bash/)).toBeTruthy()
    // Kart göründükten hemen sonra — otomatik onay YOK (K3 çiti).
    expect(calls.some((c) => c.url.includes('/api/chat/permission'))).toBe(false)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Onayla' }))

    const permCall = calls.find((c) => c.url.includes('/api/chat/permission'))
    expect(permCall).toBeTruthy()
    expect(JSON.parse(permCall!.init!.body as string)).toEqual({
      request_id: 'r1',
      result: { behavior: 'allow' },
    })
    // Karar sonrası kart kapanır.
    expect(screen.queryByText('İzin isteği')).toBeNull()
  })

  it('Reddet — deny + zorunlu message alanı ile gönderir', async () => {
    const { calls } = stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      chatRef.current!.handlers.onChatPermissionRequest({
        request_id: 'r2',
        turn_id: 't1',
        tool_name: 'Bash',
        input_preview: 'rm -rf /',
        ts: new Date().toISOString(),
      })
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reddet' }))
    const permCall = calls.find((c) => c.url.includes('/api/chat/permission'))
    expect(JSON.parse(permCall!.init!.body as string)).toEqual({
      request_id: 'r2',
      result: { behavior: 'deny', message: 'Kullanıcı reddetti.' },
    })
  })
})

describe('ChatScreen — AskUserQuestion (madde 4)', () => {
  const questionPreview = JSON.stringify({
    questions: [
      {
        question: 'Hangi test çerçevesini kullanalım?',
        header: 'Test',
        options: [
          { label: 'Vitest', description: 'Hızlı, mevcut projede zaten var' },
          { label: 'Playwright', description: 'E2E senaryolar için daha uygun' },
        ],
        multiSelect: false,
      },
    ],
  })

  it('radyo grubu render eder, seçim yapılınca answers alanıyla allow gönderir', async () => {
    const { calls } = stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      chatRef.current!.handlers.onChatPermissionRequest({
        request_id: 'q1',
        turn_id: 't1',
        tool_name: 'AskUserQuestion',
        input_preview: questionPreview,
        ts: new Date().toISOString(),
      })
    })

    expect(screen.getByText('CEO bir soru soruyor:')).toBeTruthy()
    expect(screen.getByText('Vitest')).toBeTruthy()
    expect(screen.getByText('Playwright')).toBeTruthy()
    // Onayla/Reddet YOK bu kartta (izin kartından farklı).
    expect(screen.queryByRole('button', { name: 'Onayla' })).toBeNull()

    const user = userEvent.setup()
    await user.click(screen.getByText('Vitest'))

    const permCall = calls.find((c) => c.url.includes('/api/chat/permission'))
    expect(permCall).toBeTruthy()
    const body = JSON.parse(permCall!.init!.body as string) as {
      request_id: string
      result: { behavior: string; updatedInput: { answers: Record<string, string> } }
    }
    expect(body.request_id).toBe('q1')
    expect(body.result.behavior).toBe('allow')
    expect(body.result.updatedInput.answers['Hangi test çerçevesini kullanalım?']).toBe('Vitest')
  })

  it('input_preview kırpılmış/bozuk JSON ise genel İzin Kartı’na (Onayla/Reddet) düşer', async () => {
    stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      chatRef.current!.handlers.onChatPermissionRequest({
        request_id: 'q2',
        turn_id: 't1',
        tool_name: 'AskUserQuestion',
        input_preview: '{"questions":[{"question":"kırpıldı', // kasıtlı bozuk/kırpılmış
        ts: new Date().toISOString(),
      })
    })
    expect(screen.getByText('İzin isteği')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Onayla' })).toBeTruthy()
  })
})

describe('ChatScreen — kalıcı uyarı şeridi (madde 6) ve hata/yeniden bağlan (madde 5)', () => {
  it('api_key_barrier_tripped true olunca şerit görünür, kapatınca kaybolur', async () => {
    stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      chatRef.current!.handlers.onChatStatus({
        session_active: true,
        session_id: 's1',
        busy: false,
        api_key_barrier_tripped: true,
        stripped_env_vars: ['ANTHROPIC_API_KEY'],
        chat_enabled: true,
        api_key_helper_configured: false,
      })
    })
    expect(screen.getByText(/Ortamda ANTHROPIC_API_KEY bulundu/)).toBeTruthy()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Uyarıyı kapat' }))
    expect(screen.queryByText(/Ortamda ANTHROPIC_API_KEY bulundu/)).toBeNull()
  })

  it('session_active false olunca hata satırı + Yeniden bağlan görünür, tıklanınca /api/chat/restart çağrılır, kompozer devre dışı kalır', async () => {
    const { calls } = stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      chatRef.current!.handlers.onChatStatus({
        session_active: false,
        session_id: undefined,
        busy: false,
        api_key_barrier_tripped: false,
        stripped_env_vars: [],
        chat_enabled: true,
        last_error: 'crashed',
        api_key_helper_configured: false,
      })
    })
    expect(screen.getByText(/Oturum bağlantısı koptu\. Geçmiş mesajlarınız kayıtlı/)).toBeTruthy()
    const textarea = screen.getByPlaceholderText(
      'Oturum yeniden bağlanıyor…'
    ) as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Yeniden bağlan' }))
    expect(calls.some((c) => c.url.includes('/api/chat/restart'))).toBe(true)
  })

  it('budget_exceeded özel metnini gösterir (D11)', async () => {
    stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      chatRef.current!.handlers.onChatStatus({
        session_active: false,
        session_id: undefined,
        busy: false,
        api_key_barrier_tripped: false,
        stripped_env_vars: [],
        chat_enabled: true,
        last_error: 'budget_exceeded',
        api_key_helper_configured: false,
      })
    })
    expect(screen.getByText(/Oturum bu oturum için ayrılan bütçe tavanına ulaştı\./)).toBeTruthy()
  })
})

describe('ChatScreen — alt agent durum satırı (madde 2, S1 sabit şablon)', () => {
  it('started -> finished geçişinde satır güncellenir, kalıcı kalır (silinmez)', async () => {
    stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      chatRef.current!.handlers.onChatToolEvent({
        tool_use_id: 'tu1',
        tool_name: 'Agent',
        description: 'F-012 sözleşmesi',
        status: 'started',
        parent_tool_use_id: null,
      })
    })
    expect(screen.getByText(/Agent çalışıyor — F-012 sözleşmesi/)).toBeTruthy()

    await act(async () => {
      chatRef.current!.handlers.onChatToolEvent({
        tool_use_id: 'tu1',
        tool_name: 'Agent',
        status: 'finished',
        elapsed_ms: 134000,
        parent_tool_use_id: null,
      })
    })
    expect(screen.getByText(/Agent tamamlandı \(2 dk 14 sn\) — F-012 sözleşmesi/)).toBeTruthy()
  })
})

describe('ChatScreen — S2 çiti: ham araç çıktısı akışa BASILMAZ (docs/03-ux.md CEO notu S2)', () => {
  it('chat_tool yükünde ekstra ham alan gelse bile ekranda görünmez', async () => {
    stubFetch()
    const chatRef = await renderHarness()
    await act(async () => {
      // Gerçek sunucu bu alanları asla göndermez (B7 kapalı allowlist, chat-api.test.ts'in
      // ilgili senaryosu); burada istemcinin KENDİSİNİN de böyle bir alanı render ETMEDİĞİNİ
      // kanıtlamak için şemanın dışında, keyfi bir yük enjekte ediyoruz.
      chatRef.current!.handlers.onChatToolEvent({
        tool_use_id: 'tu2',
        tool_name: 'Bash',
        description: 'gizli komut',
        status: 'finished',
        elapsed_ms: 1000,
        parent_tool_use_id: null,
        // @ts-expect-error — kasıtlı olarak şemanın dışında bir alan
        tool_result: { secret_output: 'CIZLI-VERI-SIZMAMALI' },
      })
    })
    expect(screen.queryByText(/CIZLI-VERI-SIZMAMALI/)).toBeNull()
  })
})

describe('ChatScreen — geçmiş sayfalama (madde 7)', () => {
  it('has_more true iken "Daha eski mesajları yükle" görünür ve tıklanınca before_seq ile GET atar', async () => {
    const calls: Array<{ url: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push({ url })
        if (url.includes('before_seq')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { entries: [], has_more: false } }),
          } as Response
        }
        if (url.includes('/api/chat/history')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                entries: [
                  {
                    seq: 5,
                    turn_id: 't1',
                    role: 'user',
                    kind: 'text',
                    text: 'merhaba',
                    status: 'done',
                    ts: new Date().toISOString(),
                  },
                ],
                has_more: true,
              },
            }),
          } as Response
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: {} }),
        } as Response
      })
    )
    await renderHarness()
    const link = screen.getByText('▲ Daha eski mesajları yükle')
    const user = userEvent.setup()
    await user.click(link)
    expect(calls.some((c) => c.url.includes('before_seq=5'))).toBe(true)
  })
})
