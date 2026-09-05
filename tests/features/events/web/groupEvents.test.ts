import { describe, expect, it } from 'vitest'
import { groupEvents } from '../../../../src/features/events/web/groupEvents'
import type { EventRecord } from '../../../../src/shared/types'

function makeEvent(overrides: Partial<EventRecord>): EventRecord {
  return {
    seq: 0,
    id: '0-a',
    ts: new Date().toISOString(),
    received_ms: Date.now(),
    project_path: 'p',
    project_name: 'demo',
    hook_event_name: 'PreToolUse',
    summary: 's',
    flags: [],
    raw: {},
    ...overrides,
  }
}

describe('groupEvents', () => {
  it('3+ ardışık tool_call/tool_result aynı session+agent -> tek GroupItem', () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      makeEvent({
        seq: i,
        session_id: 's1',
        agent_type: 'developer',
        hook_event_name: 'PreToolUse',
      })
    )
    const items = groupEvents(events)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ type: 'group', events: expect.arrayContaining([]) })
    if (items[0]!.type === 'group') {
      expect(items[0]!.events).toHaveLength(4)
    }
  })

  it('2 ardışık olay (< 3 eşiği) gruplanmaz, tekil kalır', () => {
    const events = [
      makeEvent({ seq: 0, session_id: 's1', agent_type: 'developer' }),
      makeEvent({ seq: 1, session_id: 's1', agent_type: 'developer' }),
    ]
    const items = groupEvents(events)
    expect(items).toHaveLength(2)
    expect(items.every((i) => i.type === 'single')).toBe(true)
  })

  it('farklı session_id ardışık grubu böler', () => {
    const events = [
      makeEvent({ seq: 0, session_id: 's1', agent_type: 'developer' }),
      makeEvent({ seq: 1, session_id: 's1', agent_type: 'developer' }),
      makeEvent({ seq: 2, session_id: 's1', agent_type: 'developer' }),
      makeEvent({ seq: 3, session_id: 's2', agent_type: 'developer' }),
    ]
    const items = groupEvents(events)
    expect(items).toHaveLength(2)
    expect(items[0]!.type).toBe('group')
    expect(items[1]!.type).toBe('single')
  })

  it('hook_event_name gruplanabilir tipte değilse (ör. UserPromptSubmit) gruplanmaz', () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      makeEvent({
        seq: i,
        session_id: 's1',
        agent_type: 'developer',
        hook_event_name: 'UserPromptSubmit',
      })
    )
    const items = groupEvents(events)
    expect(items).toHaveLength(4)
    expect(items.every((i) => i.type === 'single')).toBe(true)
  })

  it('boş dizi -> boş sonuç', () => {
    expect(groupEvents([])).toEqual([])
  })
})
