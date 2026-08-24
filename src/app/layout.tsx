import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

import './tailwind.css'
import './styles.scss'
import { ConsoleShell } from '@/app/_components/console-shell'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Glance Deck',
  description: 'ESP32 reflective display control plane',
}

const rootLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <ConsoleShell>{children}</ConsoleShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export default rootLayout
