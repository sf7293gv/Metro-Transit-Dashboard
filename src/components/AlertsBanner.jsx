import { useState, useEffect, useRef } from 'react'

const ALERT_STOPS = ['56913', '51403', '56034']
const ROTATE_MS   = 5000
const REFETCH_MS  = 5 * 60 * 1000

function WarningIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" clipRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516
           2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a
           .75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

function AlertsBanner() {
  const [alerts,    setAlerts]    = useState([])
  const [dismissed, setDismissed] = useState(() => new Set())
  const [index,     setIndex]     = useState(0)
  const rotateRef = useRef(null)

  async function fetchAlerts() {
    const results = await Promise.allSettled(
      ALERT_STOPS.map(id =>
        fetch(`https://svc.metrotransit.org/nextrip/${id}`)
          .then(r => r.json())
          .then(data => data.alerts ?? [])
          .catch(() => [])
      )
    )
    const seen   = new Set()
    const unique = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      for (const alert of r.value) {
        if (alert.alert_text && !seen.has(alert.alert_text)) {
          seen.add(alert.alert_text)
          unique.push({ id: alert.alert_text, text: alert.alert_text })
        }
      }
    }
    setAlerts(unique)
  }

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, REFETCH_MS)
    return () => clearInterval(id)
  }, [])

  const visible   = alerts.filter(a => !dismissed.has(a.id))
  const safeIndex = visible.length === 0 ? 0 : Math.min(index, visible.length - 1)

  // Restart rotation whenever the visible count changes
  useEffect(() => {
    clearInterval(rotateRef.current)
    if (visible.length > 1) {
      rotateRef.current = setInterval(() => {
        setIndex(i => (i + 1) % visible.length)
      }, ROTATE_MS)
    }
    return () => clearInterval(rotateRef.current)
  }, [visible.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (visible.length === 0) return null

  const current = visible[safeIndex]

  function dismiss(id) {
    setDismissed(prev => new Set([...prev, id]))
    setIndex(i => {
      const newLen = visible.length - 1
      return newLen > 0 ? Math.min(i, newLen - 1) : 0
    })
  }

  return (
    <div className="alerts-banner" role="alert" aria-live="polite">
      <div className="alerts-banner-inner">
        <span className="alerts-banner-icon"><WarningIcon /></span>

        {/* key forces remount on text change, which re-fires the CSS fade-in */}
        <p key={current.id} className="alerts-banner-text">{current.text}</p>

        {visible.length > 1 && (
          <span className="alerts-banner-counter">{safeIndex + 1} / {visible.length}</span>
        )}

        <button
          className="alerts-banner-close"
          onClick={() => dismiss(current.id)}
          aria-label="Dismiss alert"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

export default AlertsBanner
