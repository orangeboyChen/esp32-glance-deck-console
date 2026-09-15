import { Flexbox } from '@lobehub/ui'

/**
 * Shown by the per-route `loading.tsx` boundaries while a tab's server component renders. Without
 * these, Next holds the previous tab on screen until the new one is fully rendered, so switching
 * tabs feels unresponsive even when the server is fast.
 */
export const RouteLoading = () => (
  <div aria-busy="true" aria-live="polite" className="route-loading">
    <Flexbox horizontal align="center" gap={8}>
      <span className="route-loading-dot" />
      <span className="route-loading-dot" />
      <span className="route-loading-dot" />
    </Flexbox>
  </div>
)
