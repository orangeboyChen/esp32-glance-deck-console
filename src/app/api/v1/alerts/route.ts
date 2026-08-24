import { desc, inArray } from 'drizzle-orm'
import { requireApiScope } from '@/server/auth/auth'
import { db } from '@/server/database/db'
import { alertRules, devices } from '@/server/database/schema'
import { currentAdministrator } from '@/server/auth/session'
import { ApiRouteError, apiRoute, requestJson } from '@/lib/api-response'
import type { AlertCreateRequest, AlertRule, CreateAlertResponse } from '@/lib/api-contracts'
import { alertCreateRequestSchema } from '@/lib/api-contracts'

const serializeAlertRule = (rule: typeof alertRules.$inferSelect): AlertRule => ({
  ...rule,
  severity: rule.severity as AlertRule['severity'],
  created_at: rule.created_at.toISOString(),
})

export const GET = apiRoute(async (request) => {
  if (!(await requireApiScope(request, 'alerts:read'))) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const rules = await db.select().from(alertRules).orderBy(desc(alertRules.created_at))
  return { data: { rules: rules.map(serializeAlertRule) } }
})

export const POST = async (request: Request) => {
  return requestJson<AlertCreateRequest, CreateAlertResponse>(alertCreateRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    if (!db) {
      throw new ApiRouteError('database_unavailable', 503)
    }
    const existingDevices = await db.select({ id: devices.id }).from(devices).where(inArray(devices.id, payload.device_ids))
    if (existingDevices.length !== payload.device_ids.length) {
      throw new ApiRouteError('alert_device_not_found', 400)
    }
    const [rule] = await db.insert(alertRules).values(payload).returning()
    return { data: { rule: serializeAlertRule(rule) }, init: { status: 201 } }
  })(request)
}
