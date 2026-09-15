'use client'

import { useEffect } from 'react'

/**
 * Keys of data sets already fetched in this browser session.
 *
 * The Jotai store lives in the root layout, so atoms keep their values across client-side
 * navigation, but every manager refetched on mount regardless. That meant revisiting a tab paid for
 * a fresh round of authenticated API calls and flashed its loading text before showing data that
 * was already in memory. Managers now fetch on first visit and rely on their Refresh action (or a
 * mutation, which reloads explicitly) after that.
 */
const loadedKeys = new Set<string>()

/**
 * Forgets `key` so the owning manager refetches on its next mount.
 *
 * Call this from any mutation that changes data another tab reads. Without it, a tab that has
 * already loaded once keeps showing data captured before the mutation.
 */
export const invalidateSessionLoad = (key: string) => {
  loadedKeys.delete(key)
}

/**
 * Runs `load` the first time `key` is seen, and again on later mounts only if the previous attempt
 * resolved `false` to report failure.
 */
export const useSessionLoad = (key: string, load: () => Promise<boolean>) => {
  useEffect(() => {
    if (loadedKeys.has(key)) {
      return
    }
    let cancelled = false
    void load().then((succeeded) => {
      if (!cancelled && succeeded) {
        loadedKeys.add(key)
      }
    })
    return () => {
      cancelled = true
    }
    // `load` is stable per manager (useCallback with primitive deps); re-running on identity change
    // would be harmless anyway because the key guard short-circuits a repeat fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
