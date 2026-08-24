import { NextResponse } from 'next/server'
import { claimEnrollment } from '@/server/device/enrollment'
import { enrollmentClaimRequestSchema } from '@/lib/api-contracts'
import type { EnrollmentClaimResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  const body = enrollmentClaimRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_pairing_code' }, { status: 400 })
  }
  try {
    const response: EnrollmentClaimResponse = await claimEnrollment(body.data.pairing_code, body.data.claim_secret)
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'claim_failed' }, { status: 401 })
  }
}
