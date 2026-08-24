'use client'

import { ConfigProvider, ToastHost } from '@lobehub/ui'
import { Provider as JotaiProvider } from 'jotai'
import { motion } from 'motion/react'
import dynamic from 'next/dynamic'
import { useEffect, useState, type ReactNode } from 'react'
import { ConsoleThemeContext, type ConsoleThemeMode } from './theme-context'

const ThemeProvider = dynamic(() => import('@lobehub/ui').then(({ ThemeProvider: provider }) => provider), {
  ssr: false,
})

const consoleThemeStorageKey = 'glance-deck-theme'

const getStoredThemeMode = (): ConsoleThemeMode => {
  if (typeof window === 'undefined') {
    return 'auto'
  }
  const storedThemeMode = window.localStorage.getItem(consoleThemeStorageKey)
  return storedThemeMode === 'light' || storedThemeMode === 'dark' || storedThemeMode === 'auto' ? storedThemeMode : 'auto'
}

export const Providers = ({ children }: { children: ReactNode }) => {
  const [themeMode, setThemeMode] = useState<ConsoleThemeMode>(getStoredThemeMode)

  useEffect(() => {
    window.localStorage.setItem(consoleThemeStorageKey, themeMode)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      document.documentElement.dataset.consoleTheme = themeMode === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : themeMode
    }
    applyTheme()
    if (themeMode !== 'auto') {
      return
    }
    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [themeMode])

  return (
    <ConfigProvider motion={motion}>
      <JotaiProvider>
        <ConsoleThemeContext.Provider value={{ setThemeMode, themeMode }}>
          <ThemeProvider onThemeModeChange={setThemeMode} themeMode={themeMode}>
            {children}
            <ToastHost />
          </ThemeProvider>
        </ConsoleThemeContext.Provider>
      </JotaiProvider>
    </ConfigProvider>
  )
}
