import { and, asc, eq, inArray } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { alertRules, deviceCommands, devices, displayReleasePages } from '@/server/database/schema'

export type AlertValue = string | number | null
export type AlertOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains'

type TargetDevice = {
  id: string
  active_page_id: string
  desired_page_id: string | null
  release_id: string | null
  enabled_page_ids: string[] | null
}

type PendingCommand = { device_id: string; action: string; payload: Record<string, unknown> }

const numeric = (value: AlertValue) => {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const matchesAlert = (value: AlertValue, operator: AlertOperator, threshold: string) => {
  if (operator === 'contains') {
    return typeof value === 'string' && value.toLowerCase().includes(threshold.toLowerCase())
  }
  if (operator === 'eq' || operator === 'neq') {
    const leftNumber = numeric(value)
    const rightNumber = numeric(threshold)
    const equal = leftNumber !== null && rightNumber !== null ? leftNumber === rightNumber : String(value ?? '') === threshold
    return operator === 'eq' ? equal : !equal
  }
  const left = numeric(value)
  const right = numeric(threshold)
  if (left === null || right === null) {
    return false
  }
  if (operator === 'gt') {
    return left > right
  }
  if (operator === 'gte') {
    return left >= right
  }
  if (operator === 'lt') {
    return left < right
  }
  return left <= right
}

const loadTargetDevices = async (deviceIds: string[]): Promise<TargetDevice[]> => {
  if (!db || deviceIds.length === 0) {
    return []
  }
  return db
    .select({
      id: devices.id,
      active_page_id: devices.active_page_id,
      desired_page_id: devices.desired_page_id,
      release_id: devices.release_id,
      enabled_page_ids: devices.enabled_page_ids,
    })
    .from(devices)
    .where(inArray(devices.id, deviceIds))
}

const loadReleasePages = async (releaseIds: string[]): Promise<Map<string, string[]>> => {
  const pagesByRelease = new Map<string, string[]>()
  if (!db || releaseIds.length === 0) {
    return pagesByRelease
  }
  const rows = await db
    .select({ release_id: displayReleasePages.release_id, page_id: displayReleasePages.page_id })
    .from(displayReleasePages)
    .where(inArray(displayReleasePages.release_id, releaseIds))
    .orderBy(asc(displayReleasePages.position))
  for (const row of rows) {
    pagesByRelease.set(row.release_id, [...(pagesByRelease.get(row.release_id) ?? []), row.page_id])
  }
  return pagesByRelease
}

/** Pages the device may render: its enabled subset, or every release page when unset. */
const renderablePages = (device: TargetDevice, releasePages: string[]) => {
  const enabled = device.enabled_page_ids
  if (!enabled || enabled.length === 0) {
    return releasePages
  }
  return releasePages.filter((pageId) => enabled.includes(pageId))
}

const mergeRestorePages = (device: TargetDevice, alertPageId: string, previous: Record<string, string>) => {
  const current = device.active_page_id || device.desired_page_id
  if (!current || current === alertPageId) {
    return previous
  }
  return { ...previous, [device.id]: current }
}

/**
 * Picks the page a device returns to once an alert clears. A page the device has moved to on its own
 * wins, so clearing an alert never yanks an administrator away from something they chose to look at;
 * otherwise fall back to the page recorded when the alert fired, then the console's desired page, and
 * finally any page other than the alert page so the device never stays stuck on it.
 */
const pickRestorePage = (device: TargetDevice, candidates: string[], alertPageId: string, recorded: string | undefined) => {
  for (const pageId of [device.active_page_id, recorded, device.desired_page_id]) {
    if (pageId && pageId !== alertPageId && candidates.includes(pageId)) {
      return pageId
    }
  }
  return candidates.find((pageId) => pageId !== alertPageId)
}

const dispatch = async (commands: PendingCommand[]) => {
  if (!db || commands.length === 0) {
    return 0
  }
  await db.insert(deviceCommands).values(commands)
  for (const command of commands) {
    await db
      .update(devices)
      .set({ desired_page_id: command.payload.page_id as string })
      .where(eq(devices.id, command.device_id))
  }
  return commands.length
}

/** Builds `show_page` commands returning each targeted device to the page it showed before the alert. */
export const resolveAlertPageCommands = async (
  ruleId: string,
  alertPageId: string,
  deviceIds: string[],
  previousPages: Record<string, string>,
) => {
  const targets = await loadTargetDevices(deviceIds)
  if (targets.length === 0) {
    return []
  }
  const releaseIds = [...new Set(targets.map((device) => device.release_id).filter((id): id is string => Boolean(id)))]
  const pagesByRelease = await loadReleasePages(releaseIds)
  const commands: PendingCommand[] = []
  for (const device of targets) {
    const releasePages = device.release_id ? (pagesByRelease.get(device.release_id) ?? []) : []
    const pageId = pickRestorePage(device, renderablePages(device, releasePages), alertPageId, previousPages[device.id])
    if (!pageId) {
      continue
    }
    commands.push({
      device_id: device.id,
      action: 'show_page',
      payload: { page_id: pageId, alert_rule_id: ruleId, reason: 'alert_resolved' },
    })
  }
  return commands
}

/**
 * Returns devices to their pre-alert page and clears the recorded restore map. Called when an alert
 * clears on its own and when a rule is disabled or deleted, so a device is never left rendering the
 * alert page.
 */
export const restoreAlertRulePages = async (rule: {
  id: string
  page_ids: string[]
  device_ids: string[]
  restore_page_ids?: Record<string, string> | null
}) => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const alertPageId = rule.page_ids[0]
  if (!alertPageId) {
    return 0
  }
  const previousPages = rule.restore_page_ids ?? {}
  const restored = await dispatch(await resolveAlertPageCommands(rule.id, alertPageId, rule.device_ids, previousPages))
  await db.update(alertRules).set({ restore_page_ids: {} }).where(eq(alertRules.id, rule.id))
  return restored
}

export const evaluateAlertRules = async (sourceId: string, values: Record<string, AlertValue>) => {
  if (!db) {
    throw new Error('database_unavailable')
  }
  const rules = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.source_id, sourceId), eq(alertRules.enabled, true)))
  const evaluatedAt = new Date()
  let triggered = 0
  let restored = 0
  for (const rule of rules) {
    const value = values[rule.field] ?? null
    const active = matchesAlert(value, rule.operator, rule.threshold)
    const becameActive = active && !rule.active
    const becameResolved = !active && rule.active
    const alertPageId = rule.page_ids[0]
    const mutating = !rule.test_only && Boolean(alertPageId) && (becameActive || becameResolved)
    const previousPages = rule.restore_page_ids ?? {}
    let restorePageIds = previousPages
    let commands: PendingCommand[] = []

    if (becameActive && mutating) {
      const targets = await loadTargetDevices(rule.device_ids)
      commands = targets.map((device) => ({
        device_id: device.id,
        action: 'show_page',
        payload: { page_id: alertPageId, alert_rule_id: rule.id, message: rule.message, severity: rule.severity },
      }))
      // Recorded before dispatching so a device that moves pages mid-alert returns to where it was
      // when the alert fired, which is what the administrator expects to get back.
      restorePageIds = targets.reduce((recorded, device) => mergeRestorePages(device, alertPageId, recorded), {})
    } else if (becameResolved && mutating) {
      commands = await resolveAlertPageCommands(rule.id, alertPageId, rule.device_ids, previousPages)
    }

    await db
      .update(alertRules)
      .set({
        active,
        last_value: value,
        last_evaluated_at: evaluatedAt,
        restore_page_ids: becameResolved ? {} : restorePageIds,
        ...(becameActive ? { last_triggered_at: evaluatedAt } : {}),
      })
      .where(eq(alertRules.id, rule.id))

    if (commands.length > 0) {
      await dispatch(commands)
    }
    if (becameActive) {
      triggered += 1
    }
    if (becameResolved) {
      restored += commands.length
    }
  }
  return { evaluated: rules.length, triggered, restored }
}
