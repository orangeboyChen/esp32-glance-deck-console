'use client'

import { Flexbox, Layout, Select, Text, ThemeSwitch, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { Bell, Cpu, Database, LogOut, Monitor, PanelsTopLeft, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, type ReactNode } from 'react'
import { loggingOutAtom } from '@/app/_components/console-shell-state'
import { useConsoleTheme } from '@/app/theme-context'
import { Api } from '@/lib/api-client'
import { usePathname, useRouter } from '@/i18n/navigation'

type ConsoleShellProps = { children: ReactNode }

const navigation = [
  { href: '/', icon: Monitor, key: 'devices' },
  { href: '/sources', icon: Database, key: 'sources' },
  { href: '/displays', icon: PanelsTopLeft, key: 'displays' },
  { href: '/alerts', icon: Bell, key: 'alerts' },
  { href: '/firmware', icon: Cpu, key: 'firmware' },
  { href: '/settings', icon: Settings, key: 'settings' },
] as const

type LocalePreference = 'auto' | 'en' | 'zh-CN' | 'ja'

const isAuthenticationPath = (pathname: string) => {
  return pathname.endsWith('/login') || pathname.endsWith('/setup')
}

const isCurrentPath = (pathname: string, href: string) => {
  return href === '/' ? pathname === '/' : pathname.endsWith(href)
}

export const ConsoleShell = ({ children }: ConsoleShellProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const translate = useTranslations('Dashboard')
  const [loggingOut, setLoggingOut] = useAtom(loggingOutAtom)
  const { setThemeMode, themeMode } = useConsoleTheme()
  const [localePreference, setLocalePreference] = useState<LocalePreference>('auto')

  useEffect(() => {
    const storedLocale = window.localStorage.getItem('glance-deck-locale')
    if (storedLocale === 'auto' || storedLocale === 'en' || storedLocale === 'zh-CN' || storedLocale === 'ja') {
      setLocalePreference(storedLocale)
    }
  }, [])

  useEffect(() => {
    if (localePreference !== 'auto') {
      return
    }
    const handleLanguageChange = async () => {
      await Api.setLocale('auto')
      router.refresh()
    }
    window.addEventListener('languagechange', handleLanguageChange)
    return () => window.removeEventListener('languagechange', handleLanguageChange)
  }, [localePreference, router])

  if (isAuthenticationPath(pathname)) {
    return <>{children}</>
  }

  const navigate = (href: string) => router.push(href)
  const changeLocale = async (value: string) => {
    const preference = value as LocalePreference
    setLocalePreference(preference)
    window.localStorage.setItem('glance-deck-locale', preference)
    try {
      await Api.setLocale(preference)
      router.refresh()
    } catch {
      toast.error(translate('logoutFailed'))
    }
  }
  const logout = async () => {
    setLoggingOut(true)
    try {
      await Api.logout()
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error(translate('logoutFailed'))
      setLoggingOut(false)
    }
  }
  const languageControl = (
    <Select
      aria-label={translate('language')}
      className="app-language-select"
      onChange={(value) => void changeLocale(String(value))}
      options={[
        { label: translate('languageAuto'), value: 'auto' },
        { label: 'EN', value: 'en' },
        { label: '中文', value: 'zh-CN' },
        { label: '日本語', value: 'ja' },
      ]}
      value={localePreference}
    />
  )
  const themeControl = (
    <ThemeSwitch
      labels={{ auto: translate('themeAuto'), dark: translate('themeDark'), light: translate('themeLight') }}
      onThemeSwitch={setThemeMode}
      themeMode={themeMode}
    />
  )

  return (
    <Layout
      header={
        <header className="app-toolbar">
          <Flexbox className="app-brand" horizontal align="center" gap={10}>
            <span aria-hidden className="app-mark">
              <Monitor size={17} />
            </span>
            <Text strong>Glance Deck</Text>
            <Text className="app-toolbar-context" type="secondary">
              {translate('controlPlane')}
            </Text>
          </Flexbox>
          <nav aria-label={translate('controlPlane')} className="app-navigation-desktop">
            {navigation.map(({ href, icon: Icon, key }) => (
              <Button
                aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}
                icon={Icon}
                key={href}
                onClick={() => navigate(href)}
                onFocus={() => router.prefetch(href)}
                onPointerEnter={() => router.prefetch(href)}
                size="large"
                type={isCurrentPath(pathname, href) ? 'primary' : 'text'}
              >
                {translate(key)}
              </Button>
            ))}
          </nav>
          <div className="app-navigation-mobile">
            <Select
              aria-label={translate('controlPlane')}
              onChange={(value) => navigate(String(value))}
              options={navigation.map(({ href, key }) => ({ label: translate(key), value: href }))}
              value={navigation.find(({ href }) => isCurrentPath(pathname, href))?.href ?? '/'}
            />
          </div>
          <div className="app-toolbar-actions">
            {themeControl}
            {languageControl}
            <Button icon={LogOut} loading={loggingOut} onClick={() => void logout()} size="large" type="text">
              <span className="app-logout-label">{translate('logout')}</span>
            </Button>
          </div>
        </header>
      }
      headerHeight={64}
    >
      <div className="app-content min-h-screen">{children}</div>
    </Layout>
  )
}
