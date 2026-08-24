import { beginPasskeyAuthentication } from '@/server/auth/webauthn'
import { ApiRouteError, apiRoute } from '@/lib/api-response'
import type { PasskeyLoginOptions } from '@/lib/api-contracts'

export const POST = apiRoute(async () => {
  try {
    const response: PasskeyLoginOptions = await beginPasskeyAuthentication()
    return { data: response }
  } catch (error) {
    throw new ApiRouteError(error instanceof Error ? error.message : 'authentication_unavailable', 503)
  }
})
