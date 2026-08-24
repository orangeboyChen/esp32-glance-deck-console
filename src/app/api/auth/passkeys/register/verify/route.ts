import type { RegistrationResponseJSON } from '@simplewebauthn/types'
import { currentAdministrator } from '@/server/auth/session'
import { finishPasskeyRegistration } from '@/server/auth/webauthn'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { serializedPasskeyRegistrationSchema } from '@/lib/api-contracts'
import type { PasskeyVerifyResponse } from '@/lib/api-contracts'

export const POST = requestJson(serializedPasskeyRegistrationSchema, async (payload) => {
  const administrator = await currentAdministrator()
  if (!administrator) {
    throw new ApiRouteError('unauthorized', 401)
  }
  try {
    await finishPasskeyRegistration(administrator.id, payload as RegistrationResponseJSON)
    const response: PasskeyVerifyResponse = { verified: true }
    return { data: response, init: { status: 201 } }
  } catch (error) {
    throw new ApiRouteError(error instanceof Error ? error.message : 'verification_failed', 400)
  }
})
