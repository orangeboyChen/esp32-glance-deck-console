import { localeRequestSchema } from '@/lib/api-contracts'
import type { LocaleResponse } from '@/lib/api-contracts'
import { requestJson } from '@/lib/api-response'

export const POST = requestJson(localeRequestSchema, async (payload) => {
  const response: LocaleResponse = { locale: payload.locale }
  return {
    data: response,
    finalize: (result) => {
      result.cookies.set('NEXT_LOCALE', payload.locale, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'strict',
        secure: true,
        path: '/',
      })
      return result
    },
  }
})
