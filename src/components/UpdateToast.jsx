/*
 * UpdateToast.jsx — "Update available" notification for the PWA.
 * Uses vite-plugin-pwa's useRegisterSW hook to detect when a new service worker
 * is waiting. Shown above the bottom nav on mobile, bottom-right on desktop.
 *
 * The service worker is configured with registerType: 'prompt' so it does NOT
 * auto-update. This component checks for updates on every app foreground event
 * via the visibilitychange listener, then prompts the user explicitly.
 *
 * Clicking Refresh activates the new service worker and reloads the page.
 * Clicking X dismisses the toast; the update applies the next time the user
 * closes and reopens the app.
 */

import { useRegisterSW } from 'virtual:pwa-register/react'

// Circular arrow icon for the Refresh button
function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.57" />
    </svg>
  )
}

// X icon for the dismiss button
function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

function UpdateToast() {
  const {
    // needRefresh — [boolean, setter]; true when a new SW is waiting
    needRefresh: [needRefresh, setNeedRefresh],
    // updateServiceWorker(true) sends SKIP_WAITING to the new SW and reloads
    updateServiceWorker,
  } = useRegisterSW({
    // onRegisteredSW fires once after the service worker is successfully registered
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      // Check for a new SW version every time the user brings the app
      // to the foreground (switches back from another app, reopens from
      // homescreen, returns to the tab). This is the primary mechanism
      // that catches updates on iPhone where the page doesn't full-reload.
      let lastCheck = 0
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        const now = Date.now()
        if (now - lastCheck < 60_000) return  // throttle: at most once per minute
        lastCheck = now
        registration.update().catch(() => {})
      })
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker registration failed:', err)
    },
  })

  // Nothing to show if no update is pending
  if (!needRefresh) return null

  return (
    <div className="update-toast" role="alert" aria-live="polite">
      <span className="update-toast-msg">Update available — tap to refresh</span>
      <div className="update-toast-actions">
        {/* Activates the waiting SW and triggers a full page reload */}
        <button
          className="update-toast-refresh"
          onClick={() => updateServiceWorker(true)}
        >
          <RefreshIcon />
          Refresh
        </button>
        {/* Hides the toast; update applies the next time the app is reopened */}
        <button
          className="update-toast-dismiss"
          onClick={() => setNeedRefresh(false)}
          aria-label="Dismiss update notification"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

export default UpdateToast
