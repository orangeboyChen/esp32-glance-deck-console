import { NextResponse } from 'next/server'
import { localeRequestSchema } from '@/lib/api-contracts'
import type { LocaleResponse } from '@/lib/api-contracts'

export const POST = async (request: Request) => {
  const parsed = localeRequestSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 })
  }

  const responseBody: LocaleResponse = { locale: parsed.data.locale }
  const response = NextResponse.json(responseBody)
  response.cookies.set('NEXT_LOCALE', parsed.data.locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'strict',
    secure: true,
    path: '/',
  })
  return response
}
