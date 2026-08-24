import { NextResponse } from 'next/server'
import { announceEnrollment } from '@/server/device/enrollment'
import { enrollmentAnnounceRequestSchema } from '@/lib/api-contracts'
import type { EnrollmentAnnounceResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  const body = enrollmentAnnounceRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_enrollment_request' }, { status: 400 })
  }
  try {
    const result = await announceEnrollment(body.data.pairing_code, body.data.claim_secret, body.data.board_model)
    const response: EnrollmentAnnounceResponse = {
      expires_at: result.expires_at.toISOString(),
      status: result.status as EnrollmentAnnounceResponse['status'],
    }
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'enrollment_request_failed' }, { status: 409 })
  }
}
