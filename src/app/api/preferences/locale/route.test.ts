import { describe, expect, test } from 'bun:test'

import { POST } from './route'

describe('locale preference cookie', () => {
  test('accepts only supported locales and sets a hardened cookie', async () => {
    const response = await POST(
      new Request('http://localhost/api/preferences/locale', {
        method: 'POST',
        body: JSON.stringify({ locale: 'zh-CN' }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('NEXT_LOCALE=zh-CN')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=strict')
    expect(cookie).toContain('Path=/')
  })

  test('rejects unsupported locales', async () => {
    const response = await POST(
      new Request('http://localhost/api/preferences/locale', {
        method: 'POST',
        body: JSON.stringify({ locale: 'fr' }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.status).toBe(400)
  })
})
