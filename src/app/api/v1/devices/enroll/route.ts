import { approveEnrollment } from '@/server/device/enrollment'
import { currentAdministrator } from '@/server/auth/session'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { enrollmentRequestSchema } from '@/lib/api-contracts'
import type { EnrollmentResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  return requestJson(enrollmentRequestSchema, async (payload) => {
    if (!(await currentAdministrator())) {
      throw new ApiRouteError('unauthorized', 401)
    }
    try {
      const response: EnrollmentResponse = await approveEnrollment(payload.name, payload.pairing_code, payload.board_model)
      return { data: response, init: { status: 201 } }
    } catch (error) {
      throw new ApiRouteError(error instanceof Error ? error.message : 'enrollment_failed', 503)
    }
  })(request)
}
