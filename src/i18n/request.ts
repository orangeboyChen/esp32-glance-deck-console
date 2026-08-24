import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

import { routing } from './routing'

const detectLocale = (acceptLanguage: string | null) => {
  for (const language of acceptLanguage?.split(',').map((value) => value.split(';')[0].trim().toLowerCase()) ?? []) {
    if (language.startsWith('zh')) {
      return 'zh-CN'
    }
    if (language.startsWith('ja')) {
      return 'ja'
    }
    if (language.startsWith('en')) {
      return 'en'
    }
  }
  return routing.defaultLocale
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const localePreference = cookieLocale === 'auto' || !cookieLocale ? 'auto' : cookieLocale
  const locale =
    localePreference === 'auto'
      ? detectLocale((await headers()).get('accept-language'))
      : routing.locales.includes(localePreference as (typeof routing.locales)[number])
        ? localePreference
        : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
