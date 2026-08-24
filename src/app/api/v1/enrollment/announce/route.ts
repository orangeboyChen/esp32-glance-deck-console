import { NextResponse } from 'next/server'
import { z } from 'zod'

import { announceEnrollment } from '@/server/device/enrollment'

const enrollmentSchema = z.object({
  pairing_code: z.string().regex(/^\d{6}$/),
  claim_secret: z.string().regex(/^[a-f0-9]{64}$/),
  board_model: z.literal('ESP32-S3-RLCD-4.2'),
})

export const POST = async (request: Request) => {
  const body = enrollmentSchema.safeParse(await request.json())
  if (!body.success) return NextResponse.json({ error: 'invalid_enrollment_request' }, { status: 400 })
  try {
    return NextResponse.json(await announceEnrollment(body.data.pairing_code, body.data.claim_secret, body.data.board_model), {
      status: 201,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'enrollment_request_failed' }, { status: 409 })
  }
}
