import { eq } from 'drizzle-orm'

import { db } from '@/server/database/db'
import { alertRules } from '@/server/database/schema'
import { currentAdministrator } from '@/server/auth/session'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { DeleteAlertResponse } from '@/lib/api-contracts'

type AlertRouteContext = { params: Promise<{ alert_id: string }> }

export const DELETE = apiRoute<DeleteAlertResponse, AlertRouteContext>(async (request, context) => {
  void request
  if (!context) {
    throw new ApiRouteError('invalid_route_context', 500)
  }
  if (!(await currentAdministrator())) {
    throw new ApiRouteError('unauthorized', 401)
  }
  if (!db) {
    throw new ApiRouteError('database_unavailable', 503)
  }
  const { alert_id: alertId } = await context.params
  const [rule] = await db
    .update(alertRules)
    .set({ enabled: false, active: false })
    .where(eq(alertRules.id, alertId))
    .returning({ id: alertRules.id })
  if (!rule) {
    throw new ApiRouteError('alert_not_found', 404)
  }
  const response: DeleteAlertResponse = { rule }
  return { data: response }
})
