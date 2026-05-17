import { useRegisterSW } from 'virtual:pwa-register/react'

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.57" />
    </svg>
  )
}

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
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
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
        if (now - lastCheck < 60_000) return  // at most once per minute
        lastCheck = now
        registration.update().catch(() => {})
      })
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker registration failed:', err)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="update-toast" role="alert" aria-live="polite">
      <span className="update-toast-msg">Update available — tap to refresh</span>
      <div className="update-toast-actions">
        <button
          className="update-toast-refresh"
          onClick={() => updateServiceWorker(true)}
        >
          <RefreshIcon />
          Refresh
        </button>
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
