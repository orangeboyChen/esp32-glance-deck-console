import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

import { routing } from './routing'

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = routing.locales.includes(cookieLocale as (typeof routing.locales)[number])
    ? (cookieLocale as (typeof routing.locales)[number])
    : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
