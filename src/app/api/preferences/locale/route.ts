import { NextResponse } from 'next/server'
import { z } from 'zod'

import { routing } from '@/i18n/routing'

const localeSchema = z.object({ locale: z.enum(routing.locales) })

export const POST = async (request: Request) => {
  const parsed = localeSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'invalid_locale' }, { status: 400 })

  const response = NextResponse.json({ locale: parsed.data.locale })
  response.cookies.set('NEXT_LOCALE', parsed.data.locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'strict',
    secure: true,
    path: '/',
  })
  return response
}
