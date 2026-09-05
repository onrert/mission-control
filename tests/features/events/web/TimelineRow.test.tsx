// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TimelineRow } from '../../../../src/features/events/web/TimelineRow'
import type { EventRecord } from '../../../../src/shared/types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function makeEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    seq: 0,
    id: '0-a',
    ts: '2026-09-05T14:32:07.000Z',
    received_ms: Date.now(),
    project_path: 'C:\\dev\\apps\\mission-control',
    project_name: 'mission-control',
    hook_event_name: 'PreToolUse',
    agent_type: 'developer',
    tool_name: 'Edit',
    summary: 'kanban.tsx güncellendi',
    flags: [],
    raw: {},
    ...overrides,
  }
}

describe('TimelineRow (AC2 — alan eşlemesi)', () => {
  it('zaman, proje, agent, araç, özet gösterir', () => {
    render(<TimelineRow event={makeEvent()} isRecent={false} onSelect={() => {}} />)
    expect(screen.getByTestId('row-project').textContent).toBe('mission-control')
    expect(screen.getByTestId('row-agent').textContent).toBe('developer')
    expect(screen.getByTestId('row-tool').textContent).toBe('Edit')
    expect(screen.getByTestId('row-summary').textContent).toBe('kanban.tsx güncellendi')
    expect(screen.getByTestId('row-time').textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('missing_fields bayrağı varsa eksik-alan rozeti gösterir', () => {
    render(
      <TimelineRow
        event={makeEvent({ flags: ['missing_fields'] })}
        isRecent={false}
        onSelect={() => {}}
      />
    )
    expect(screen.getByTestId('row-missing-fields')).toBeTruthy()
  })

  it('missing_fields yoksa rozet render edilmez', () => {
    render(<TimelineRow event={makeEvent()} isRecent={false} onSelect={() => {}} />)
    expect(screen.queryByTestId('row-missing-fields')).toBeNull()
  })

  it('tıklanınca onSelect olayla çağrılır', () => {
    const onSelect = vi.fn()
    const event = makeEvent()
    render(<TimelineRow event={event} isRecent={false} onSelect={onSelect} />)
    screen.getByTestId('timeline-row').click()
    expect(onSelect).toHaveBeenCalledWith(event)
  })

  it('isRecent true iken "şimdi" vurgusu (amber kenarlık) uygulanır', () => {
    render(<TimelineRow event={makeEvent()} isRecent onSelect={() => {}} />)
    expect(screen.getByTestId('timeline-row').className).toContain('border-amber-500')
  })

  it('isRecent false iken vurgu yok', () => {
    render(<TimelineRow event={makeEvent()} isRecent={false} onSelect={() => {}} />)
    expect(screen.getByTestId('timeline-row').className).not.toContain('border-amber-500')
  })
})
