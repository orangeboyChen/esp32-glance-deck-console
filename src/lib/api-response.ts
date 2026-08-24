import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import type { ApiErrorResponse, JsonValue } from '@/lib/api-contracts'

export type JsonRouteResult<ResponsePayload> = {
  data: ResponsePayload
  init?: ResponseInit
  finalize?: (response: NextResponse<ResponsePayload>) => NextResponse<ResponsePayload>
}

export type ApiRouteResult<ResponsePayload> = JsonRouteResult<ResponsePayload> | Response

type ApiRouteHandler = ((request: Request) => Promise<Response>) & ((request: Request, context: unknown) => Promise<Response>)

export class ApiRouteError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRouteError'
    this.status = status
  }
}

export const apiResponse = <Response>(payload: Response, init?: ResponseInit) => NextResponse.json(payload, init)

export const noContentResponse = () => new NextResponse(null, { status: 204 })

export const apiRoute = <ResponsePayload, RouteContext = undefined>(
  handler: (request: Request, context?: RouteContext) => Promise<ApiRouteResult<ResponsePayload>>,
) => {
  const route = async (request: Request, context: unknown = undefined) => {
    try {
      const result = await handler(request, context as RouteContext)
      if (result instanceof Response) {
        return result
      }
      const response = apiResponse<ResponsePayload>(result.data, result.init)
      return result.finalize ? result.finalize(response) : response
    } catch (error) {
      if (error instanceof ApiRouteError) {
        return apiResponse<ApiErrorResponse>({ error: error.message }, { status: error.status })
      }
      throw error
    }
  }
  return route as ApiRouteHandler
}

export const requestJson = <RequestPayload extends JsonValue, ResponsePayload>(
  schema: ZodType<RequestPayload>,
  handler: (payload: RequestPayload, request: Request) => Promise<JsonRouteResult<ResponsePayload>>,
) => {
  return apiRoute<ResponsePayload>(async (request) => {
    const parsed = schema.safeParse(await request.json().catch(() => undefined))
    if (!parsed.success) {
      throw new ApiRouteError('invalid_request', 400)
    }
    return handler(parsed.data, request)
  })
}
