'use client'

import { ThemeProvider, ToastHost } from '@lobehub/ui'
import { Provider as JotaiProvider } from 'jotai'
import type { ReactNode } from 'react'

export const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <JotaiProvider>
      <ThemeProvider themeMode="auto">
        {children}
        <ToastHost />
      </ThemeProvider>
    </JotaiProvider>
  )
}
