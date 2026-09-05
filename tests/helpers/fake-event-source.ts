/**
 * `EventSource`'un test edilebilir sahte implementasyonu (sözleşme §2.1/§6 "Enjekte
 * edilebilirlik notu"). jsdom `EventSource`'u hiç uygulamadığı için (✓ VERIFIED, sözleşme §6)
 * `useEventStream` bunu enjekte edilebilir bir parametre olarak alır.
 */
export const FAKE_CONNECTING = 0
export const FAKE_OPEN = 1
export const FAKE_CLOSED = 2

type Listener = (event: unknown) => void

export class FakeEventSource {
  static readonly CONNECTING = FAKE_CONNECTING
  static readonly OPEN = FAKE_OPEN
  static readonly CLOSED = FAKE_CLOSED

  url: string
  readyState: number = FAKE_CONNECTING
  private listeners = new Map<string, Set<Listener>>()
  closeCalls = 0

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  static instances: FakeEventSource[] = []
  static reset(): void {
    FakeEventSource.instances = []
  }

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  close(): void {
    this.closeCalls += 1
    this.readyState = FAKE_CLOSED
  }

  /** Test yardımcı metodu: belirli bir isimde olay dispatch eder. */
  dispatch(name: string, data?: unknown, options: { lastEventId?: string } = {}): void {
    if (name === 'open') this.readyState = FAKE_OPEN
    const event = {
      type: name,
      data: data !== undefined ? JSON.stringify(data) : undefined,
      lastEventId: options.lastEventId,
    }
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event)
    }
  }
}
