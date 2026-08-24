import { currentAdministrator } from '@/server/auth/session'
import { beginPasskeyRegistration } from '@/server/auth/webauthn'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { PasskeyRegisterOptions } from '@/lib/api-contracts'

export const POST = apiRoute(async () => {
  const administrator = await currentAdministrator()
  if (!administrator) {
    throw new ApiRouteError('unauthorized', 401)
  }
  const response: PasskeyRegisterOptions = await beginPasskeyRegistration(administrator)
  return { data: response }
})
