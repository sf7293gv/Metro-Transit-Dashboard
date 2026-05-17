/*
 * AlertsBanner.jsx — Thin yellow/orange banner that auto-rotates through
 * live service alerts fetched from three major Twin Cities stops.
 * Shown at the top of the app when at least one undismissed alert exists;
 * renders nothing when all alerts are dismissed or when the API returns none.
 * Alerts are fetched on mount and every 5 minutes; dismissed alerts are
 * kept in a Set in local state (cleared when the page reloads).
 */

import { useState, useEffect, useRef } from 'react'

// Stop IDs used as sources for system-wide alerts
// (Nicollet Mall, 5th St/Nicollet, Hennepin Ave & 5th)
const ALERT_STOPS = ['56913', '51403', '56034']

const ROTATE_MS  = 5000           // milliseconds between auto-rotating to the next alert
const REFETCH_MS = 5 * 60 * 1000  // re-fetch alerts every 5 minutes

// Warning triangle icon shown at the left of each alert
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

// X button icon for dismissing an individual alert
function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

function AlertsBanner() {
  // alerts — deduplicated list of { id, text } objects from the API
  const [alerts,    setAlerts]    = useState([])
  // dismissed — Set of alert text strings the user has dismissed this session
  const [dismissed, setDismissed] = useState(() => new Set())
  // index — which alert in the visible list is currently displayed
  const [index,     setIndex]     = useState(0)
  const rotateRef = useRef(null)  // holds the setInterval id for rotation

  /*
   * Fetches alerts from all three stop IDs in parallel.
   * API: GET https://svc.metrotransit.org/nextrip/{stopId}
   * Returns: { alerts: [{alert_text, stop_closed}], departures: [...], stops: [...] }
   * Deduplicates by alert_text so the same message isn't shown multiple times.
   */
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

  // Fetch on mount, then re-fetch every 5 minutes
  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, REFETCH_MS)
    return () => clearInterval(id)
  }, [])

  // Filter out dismissed alerts; clamp index so it's never out of bounds
  const visible   = alerts.filter(a => !dismissed.has(a.id))
  const safeIndex = visible.length === 0 ? 0 : Math.min(index, visible.length - 1)

  // Restart the rotation timer whenever the number of visible alerts changes
  useEffect(() => {
    clearInterval(rotateRef.current)
    if (visible.length > 1) {
      rotateRef.current = setInterval(() => {
        setIndex(i => (i + 1) % visible.length)
      }, ROTATE_MS)
    }
    return () => clearInterval(rotateRef.current)
  }, [visible.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to show — render nothing so the banner takes up no space
  if (visible.length === 0) return null

  const current = visible[safeIndex]

  // Removes an alert from view and adjusts the index to avoid skipping
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

        {/* key forces a React remount on each new alert, which re-triggers the CSS fade-in */}
        <p key={current.id} className="alerts-banner-text">{current.text}</p>

        {/* Counter e.g. "2 / 4" shown only when there are multiple alerts */}
        {visible.length > 1 && (
          <span className="alerts-banner-counter">{safeIndex + 1} / {visible.length}</span>
        )}

        {/* Dismiss button — removes this alert for the rest of the session */}
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
