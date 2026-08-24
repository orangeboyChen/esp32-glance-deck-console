import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { ApiRouteError, apiRoute, noContentResponse, requestJson } from './api-response'

const request = new Request('http://localhost/api/test')

describe('api response helpers', () => {
  test('serializes JSON results and applies finalizers', async () => {
    const response = await apiRoute(async () => ({
      data: { status: 'ok' },
      finalize: (result) => {
        result.headers.set('cache-control', 'no-store')
        return result
      },
    }))(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  test('passes through native responses and creates no-content responses', async () => {
    const response = await apiRoute(async () => noContentResponse())(request)

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  test('serializes route errors and rethrows unknown errors', async () => {
    const errorResponse = await apiRoute(async () => {
      throw new ApiRouteError('invalid_request', 400)
    })(request)

    expect(errorResponse.status).toBe(400)
    expect(await errorResponse.json()).toEqual({ error: 'invalid_request' })

    await expect(
      apiRoute(async () => {
        throw new Error('unexpected')
      })(request),
    ).rejects.toThrow('unexpected')
  })

  test('validates JSON requests and hides validation details', async () => {
    const route = requestJson(z.object({ name: z.string().min(1) }), async (payload) => ({ data: payload }))
    const validResponse = await route(new Request(request.url, { method: 'POST', body: JSON.stringify({ name: 'deck' }) }))
    expect(await validResponse.json()).toEqual({ name: 'deck' })

    const invalidResponse = await route(new Request(request.url, { method: 'POST', body: JSON.stringify({ name: '' }) }))
    expect(invalidResponse.status).toBe(400)
    expect(await invalidResponse.json()).toEqual({ error: 'invalid_request' })

    const malformedResponse = await route(new Request(request.url, { method: 'POST', body: '{' }))
    expect(malformedResponse.status).toBe(400)
    expect(await malformedResponse.json()).toEqual({ error: 'invalid_request' })
  })
})
