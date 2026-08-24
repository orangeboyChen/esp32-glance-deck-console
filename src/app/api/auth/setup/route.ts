import { createInitialAdministrator, createSession } from '@/server/auth/session'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { setupRequestSchema } from '@/lib/api-contracts'
import type { AuthResponse } from '@/lib/api-contracts'

export const POST = requestJson(setupRequestSchema, async (payload) => {
  try {
    const administrator = await createInitialAdministrator(payload.email, payload.password)
    await createSession(administrator.id)
    const response: AuthResponse = { administrator: { id: administrator.id, email: administrator.email } }
    return { data: response, init: { status: 201 } }
  } catch (error) {
    if (error instanceof Error && error.message === 'administrator_exists') {
      throw new ApiRouteError('already_initialized', 409)
    }
    throw error
  }
})
