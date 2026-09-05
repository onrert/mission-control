import type { EventRecord } from '../../../shared/types'

export interface SingleItem {
  type: 'single'
  event: EventRecord
}

export interface GroupItem {
  type: 'group'
  key: string
  sessionId: string
  agentType: string
  events: EventRecord[]
}

export type TimelineItem = SingleItem | GroupItem

const GROUPABLE_TYPES = new Set(['PreToolUse', 'PostToolUse'])
const MIN_GROUP_SIZE = 3

/**
 * Saf fonksiyon (sözleşme §2.1): aynı `session_id`+agent'ın ardışık ≥3 tool_call/tool_result
 * (`PreToolUse`/`PostToolUse`) olayını `GroupItem`'a katlar. Girdi dizisi zaten görüntü
 * sırasındadır (çağıran sıralamayı belirler) — bu fonksiyon sırayı değiştirmez, yalnızca
 * ardışık uygun bloğu tek öğeye indirger.
 */
export function groupEvents(events: EventRecord[]): TimelineItem[] {
  const result: TimelineItem[] = []
  let i = 0
  while (i < events.length) {
    const current = events[i]!
    const sessionId = current.session_id
    const agentType = current.agent_type ?? ''
    if (sessionId && GROUPABLE_TYPES.has(current.hook_event_name)) {
      let j = i
      while (
        j < events.length &&
        events[j]!.session_id === sessionId &&
        (events[j]!.agent_type ?? '') === agentType &&
        GROUPABLE_TYPES.has(events[j]!.hook_event_name)
      ) {
        j += 1
      }
      const run = events.slice(i, j)
      if (run.length >= MIN_GROUP_SIZE) {
        result.push({
          type: 'group',
          key: `${sessionId}:${agentType}:${current.seq}`,
          sessionId,
          agentType,
          events: run,
        })
        i = j
        continue
      }
    }
    result.push({ type: 'single', event: current })
    i += 1
  }
  return result
}
