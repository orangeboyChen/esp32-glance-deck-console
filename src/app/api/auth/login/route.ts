import { authenticateAdministrator, createSession } from '@/server/auth/session'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { loginRequestSchema } from '@/lib/api-contracts'
import type { AuthResponse } from '@/lib/api-contracts'

export const POST = requestJson(loginRequestSchema, async (payload) => {
  const administrator = await authenticateAdministrator(payload.email, payload.password)
  if (!administrator) {
    throw new ApiRouteError('invalid_credentials', 401)
  }

  await createSession(administrator.id)
  const response: AuthResponse = { administrator: { id: administrator.id, email: administrator.email } }
  return { data: response }
})
