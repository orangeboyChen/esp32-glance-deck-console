import { NextResponse } from 'next/server'

export const GET = () => {
  return NextResponse.json({ status: 'ok', service: 'glance-deck-console' })
}
