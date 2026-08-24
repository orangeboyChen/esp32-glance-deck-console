import { claimEnrollment } from '@/server/device/enrollment'
import { ApiRouteError, requestJson } from '@/lib/api-response'
import { enrollmentClaimRequestSchema } from '@/lib/api-contracts'
import type { EnrollmentClaimResponse } from '@/lib/api-contracts'

export const POST = requestJson(enrollmentClaimRequestSchema, async (payload) => {
  try {
    const response: EnrollmentClaimResponse = await claimEnrollment(payload.pairing_code, payload.claim_secret)
    return { data: response }
  } catch (error) {
    throw new ApiRouteError(error instanceof Error ? error.message : 'claim_failed', 401)
  }
})
