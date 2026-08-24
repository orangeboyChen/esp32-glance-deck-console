import { clearSession } from '@/server/auth/session'
import { apiRoute, noContentResponse } from '@/lib/api-response'

export const POST = apiRoute<null>(async () => {
  await clearSession()
  return noContentResponse()
})
