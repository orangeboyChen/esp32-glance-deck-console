import { announceEnrollment } from '@/server/device/enrollment'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { enrollmentAnnounceRequestSchema } from '@/lib/api-contracts'
import type { EnrollmentAnnounceResponse } from '@/lib/api-contracts'

export const POST = requestJson(enrollmentAnnounceRequestSchema, async (payload) => {
  try {
    const result = await announceEnrollment(payload.pairing_code, payload.claim_secret, payload.board_model)
    const response: EnrollmentAnnounceResponse = {
      expires_at: result.expires_at.toISOString(),
      status: result.status as EnrollmentAnnounceResponse['status'],
    }
    return { data: response, init: { status: 201 } }
  } catch (error) {
    throw new ApiRouteError(error instanceof Error ? error.message : 'enrollment_request_failed', 409)
  }
})
