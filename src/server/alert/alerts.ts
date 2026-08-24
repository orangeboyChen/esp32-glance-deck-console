import { and, eq } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { alertRules, deviceCommands } from '@/server/database/schema'

export type AlertValue = string | number | null
export type AlertOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains'

const numeric = (value: AlertValue) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const matchesAlert = (value: AlertValue, operator: AlertOperator, threshold: string) => {
  if (operator === 'contains') return typeof value === 'string' && value.toLowerCase().includes(threshold.toLowerCase())
  if (operator === 'eq' || operator === 'neq') {
    const leftNumber = numeric(value)
    const rightNumber = numeric(threshold)
    const equal = leftNumber !== null && rightNumber !== null ? leftNumber === rightNumber : String(value ?? '') === threshold
    return operator === 'eq' ? equal : !equal
  }
  const left = numeric(value)
  const right = numeric(threshold)
  if (left === null || right === null) return false
  if (operator === 'gt') return left > right
  if (operator === 'gte') return left >= right
  if (operator === 'lt') return left < right
  return left <= right
}

export const evaluateAlertRules = async (sourceId: string, values: Record<string, AlertValue>) => {
  if (!db) throw new Error('database_unavailable')
  const rules = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.source_id, sourceId), eq(alertRules.enabled, true)))
  const evaluatedAt = new Date()
  let triggered = 0
  for (const rule of rules) {
    const value = values[rule.field] ?? null
    const active = matchesAlert(value, rule.operator, rule.threshold)
    const becameActive = active && !rule.active
    const becameResolved = !active && rule.active
    await db
      .update(alertRules)
      .set({ active, last_value: value, last_evaluated_at: evaluatedAt, ...(becameActive ? { last_triggered_at: evaluatedAt } : {}) })
      .where(eq(alertRules.id, rule.id))
    if (becameActive) {
      triggered += 1
      if (!rule.test_only) {
        const pageId = rule.page_ids[0]
        if (pageId) {
          await db.insert(deviceCommands).values(
            rule.device_ids.map((deviceId: string) => ({
              device_id: deviceId,
              action: 'show_page',
              payload: { page_id: pageId, alert_rule_id: rule.id, message: rule.message, severity: rule.severity },
            })),
          )
        }
      }
    }
    if (becameResolved && !rule.test_only) {
      const pageId = rule.page_ids[0]
      if (pageId) {
        await db.insert(deviceCommands).values(
          rule.device_ids.map((deviceId: string) => ({
            device_id: deviceId,
            action: 'refresh_release',
            payload: { alert_rule_id: rule.id, reason: 'alert_resolved' },
          })),
        )
      }
    }
  }
  return { evaluated: rules.length, triggered }
}
