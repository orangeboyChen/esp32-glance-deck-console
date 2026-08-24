import type { HealthResponse } from '@/lib/api-contracts'
import { apiRoute } from '@/lib/api-response'

export const GET = apiRoute<HealthResponse>(async () => {
  const response: HealthResponse = { status: 'ok', service: 'glance-deck-console' }
  return { data: response }
})
