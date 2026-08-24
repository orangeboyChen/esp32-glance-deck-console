import { NextResponse } from 'next/server'
import { approveEnrollment } from '@/server/device/enrollment'
import { currentAdministrator } from '@/server/auth/session'
import { enrollmentRequestSchema } from '@/lib/api-contracts'
import type { EnrollmentResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  if (!(await currentAdministrator())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const body = enrollmentRequestSchema.safeParse(await request.json())
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_enrollment' }, { status: 400 })
  }
  try {
    const response: EnrollmentResponse = await approveEnrollment(body.data.name, body.data.pairing_code, body.data.board_model)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'enrollment_failed' }, { status: 503 })
  }
}
