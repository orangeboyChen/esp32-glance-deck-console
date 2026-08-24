import { NextResponse } from 'next/server'
import type { HealthResponse } from '@/lib/api-contracts'

export const GET = () => {
  const response: HealthResponse = { status: 'ok', service: 'glance-deck-console' }
  return NextResponse.json(response)
}
