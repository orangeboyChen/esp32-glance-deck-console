import type { AuthenticationResponseJSON } from '@simplewebauthn/types'
import { createSession } from '@/server/auth/session'
import { finishPasskeyAuthentication } from '@/server/auth/webauthn'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { serializedPasskeyLoginSchema } from '@/lib/api-contracts'
import type { PasskeyVerifyResponse } from '@/lib/api-contracts'

export const POST = requestJson(serializedPasskeyLoginSchema, async (payload) => {
  try {
    const administratorId = await finishPasskeyAuthentication(payload as AuthenticationResponseJSON)
    await createSession(administratorId)
    const response: PasskeyVerifyResponse = { verified: true }
    return { data: response }
  } catch (error) {
    throw new ApiRouteError(error instanceof Error ? error.message : 'verification_failed', 401)
  }
})
