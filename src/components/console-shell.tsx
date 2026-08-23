'use client'

import { Button, Flexbox, Layout, Segmented, SideNav, Text, toast } from '@lobehub/ui'
import { Bell, Cpu, Database, LogOut, Monitor, PanelsTopLeft, Settings } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'

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

function is_authentication_path(pathname: string) {
  return pathname.endsWith('/login') || pathname.endsWith('/setup')
}

function is_current_path(pathname: string, href: string) {
  return href === '/' ? pathname === '/' || /^\/(en|zh-CN|ja)$/.test(pathname) : pathname.endsWith(href)
}

export function ConsoleShell({ children }: ConsoleShellProps) {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const translate = useTranslations('Dashboard')
  const [logging_out, set_logging_out] = useState(false)

  if (is_authentication_path(pathname)) return <>{children}</>

  const navigate = (href: string) => router.push(href)
  const logout = async () => {
    set_logging_out(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('logout_failed')
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error(translate('logoutFailed'))
      set_logging_out(false)
    }
  }
  const language_control = (
    <Segmented
      aria-label={translate('language')}
      onChange={(value) => router.replace(pathname, { locale: value as 'en' | 'zh-CN' | 'ja' })}
      options={[{ label: 'EN', value: 'en' }, { label: '中文', value: 'zh-CN' }, { label: '日本語', value: 'ja' }]}
      value={locale}
    />
  )

  return (
    <Layout
      header={<header className="app-toolbar"><Flexbox className="app-brand" horizontal align="center" gap={10}><span aria-hidden className="app-mark"><Monitor size={17} /></span><Text strong>Glance Deck</Text><Text className="app-toolbar-context" type="secondary">{translate('controlPlane')}</Text></Flexbox><nav aria-label={translate('controlPlane')} className="mobile-navigation">{navigation.map(({ href, icon: Icon, key }) => <Button aria-current={is_current_path(pathname, href) ? 'page' : undefined} icon={Icon} key={href} onClick={() => navigate(href)} size="large" type={is_current_path(pathname, href) ? 'primary' : 'text'}>{translate(key)}</Button>)}<Button icon={LogOut} loading={logging_out} onClick={() => void logout()} size="large" type="text">{translate('logout')}</Button></nav><div className="mobile-language-control">{language_control}</div></header>}
      headerHeight={64}
      sidebar={<aside aria-label={translate('controlPlane')} className="app-sidebar"><SideNav avatar={<span aria-hidden className="app-mark app-mark-large"><Monitor size={18} /></span>} bottomActions={<Flexbox gap={8}>{language_control}<Button icon={LogOut} loading={logging_out} onClick={() => void logout()} size="large" type="text">{translate('logout')}</Button></Flexbox>} topActions={navigation.map(({ href, icon: Icon, key }) => <Button aria-current={is_current_path(pathname, href) ? 'page' : undefined} icon={Icon} key={href} onClick={() => navigate(href)} size="large" type={is_current_path(pathname, href) ? 'primary' : 'text'}>{translate(key)}</Button>)} /></aside>}
      asideWidth={224}
    >
      <div className="app-content">{children}</div>
    </Layout>
  )
}
