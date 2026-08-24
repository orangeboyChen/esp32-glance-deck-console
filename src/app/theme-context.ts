'use client'

import { createContext, useContext } from 'react'

export type ConsoleThemeMode = 'auto' | 'light' | 'dark'

type ConsoleThemeContextValue = {
  themeMode: ConsoleThemeMode
  setThemeMode: (themeMode: ConsoleThemeMode) => void
}

export const ConsoleThemeContext = createContext<ConsoleThemeContextValue>({
  setThemeMode: () => undefined,
  themeMode: 'auto',
})

export const useConsoleTheme = () => useContext(ConsoleThemeContext)
