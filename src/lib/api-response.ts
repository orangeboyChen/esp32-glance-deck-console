import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import type { ApiErrorResponse, JsonObject, JsonValue } from '@/lib/api-contracts'

export type JsonRouteResult<ResponsePayload> = { data: ResponsePayload; init?: ResponseInit }

export class ApiRouteError extends Error {
  readonly status: number
  readonly issues?: JsonValue[]

  constructor(message: string, status: number, issues?: JsonValue[]) {
    super(message)
    this.name = 'ApiRouteError'
    this.status = status
    this.issues = issues
  }
}

export const apiResponse = <Response>(payload: Response, init?: ResponseInit) => NextResponse.json(payload, init)

export const noContentResponse = () => new NextResponse(null, { status: 204 })

export const requestJson = <RequestPayload extends JsonValue, ResponsePayload extends JsonValue>(
  schema: ZodType<RequestPayload>,
  handler: (payload: RequestPayload, request: Request) => Promise<JsonRouteResult<ResponsePayload>>,
  invalidMessage: string,
) => {
  return async (request: Request) => {
    const parsed = schema.safeParse(await request.json().catch(() => undefined))
    if (!parsed.success) {
      const issues: JsonValue[] = parsed.error.issues.map((issue): JsonObject => ({
        code: issue.code,
        message: issue.message,
        path: issue.path.map((segment) => String(segment)),
      }))
      return apiResponse<ApiErrorResponse>({ error: invalidMessage, issues }, { status: 400 })
    }
    try {
      const result = await handler(parsed.data, request)
      return apiResponse<ResponsePayload>(result.data, result.init)
    } catch (error) {
      if (error instanceof ApiRouteError) {
        return apiResponse<ApiErrorResponse>({ error: error.message, issues: error.issues }, { status: error.status })
      }
      throw error
    }
  }
}
