'use client'

import { Flexbox, Layout, Segmented, SideNav, Text, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { Bell, Cpu, Database, LogOut, Monitor, PanelsTopLeft, Settings } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode } from 'react'
import { loggingOutAtom } from '@/app/_components/console-shell-state'
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

const isAuthenticationPath = (pathname: string) => {
  return pathname.endsWith('/login') || pathname.endsWith('/setup')
}

const isCurrentPath = (pathname: string, href: string) => {
  return href === '/' ? pathname === '/' : pathname.endsWith(href)
}

export const ConsoleShell = ({ children }: ConsoleShellProps) => {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const translate = useTranslations('Dashboard')
  const [loggingOut, setLoggingOut] = useAtom(loggingOutAtom)

  if (isAuthenticationPath(pathname)) {
    return <>{children}</>
  }

  const navigate = (href: string) => router.push(href)
  const changeLocale = async (value: string) => {
    try {
      await Api.setLocale(value)
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
    <Segmented
      aria-label={translate('language')}
      onChange={(value) => void changeLocale(String(value))}
      options={[
        { label: 'EN', value: 'en' },
        { label: '中文', value: 'zh-CN' },
        { label: '日本語', value: 'ja' },
      ]}
      value={locale}
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
          <nav aria-label={translate('controlPlane')} className="mobile-navigation">
            {navigation.map(({ href, icon: Icon, key }) => (
              <Button
                aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}
                icon={Icon}
                key={href}
                onClick={() => navigate(href)}
                size="large"
                type={isCurrentPath(pathname, href) ? 'primary' : 'text'}
              >
                {translate(key)}
              </Button>
            ))}
            <Button icon={LogOut} loading={loggingOut} onClick={() => void logout()} size="large" type="text">
              {translate('logout')}
            </Button>
          </nav>
          <div className="mobile-language-control">{languageControl}</div>
        </header>
      }
      headerHeight={64}
      sidebar={
        <aside aria-label={translate('controlPlane')} className="app-sidebar">
          <SideNav
            avatar={
              <span aria-hidden className="app-mark app-mark-large">
                <Monitor size={18} />
              </span>
            }
            bottomActions={
              <Flexbox gap={8}>
                {languageControl}
                <Button icon={LogOut} loading={loggingOut} onClick={() => void logout()} size="large" type="text">
                  {translate('logout')}
                </Button>
              </Flexbox>
            }
            topActions={navigation.map(({ href, icon: Icon, key }) => (
              <Button
                aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}
                icon={Icon}
                key={href}
                onClick={() => navigate(href)}
                size="large"
                type={isCurrentPath(pathname, href) ? 'primary' : 'text'}
              >
                {translate(key)}
              </Button>
            ))}
          />
        </aside>
      }
      asideWidth={224}
    >
      <div className="app-content min-h-screen">{children}</div>
    </Layout>
  )
}
