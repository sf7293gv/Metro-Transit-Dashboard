/*
 * ServiceStatusPanel.jsx — Live service alerts for Twin Cities transit.
 * Fetches alerts from 10 major stops and deduplicates them by alert text.
 * Closed-stop alerts appear first; general service warnings follow.
 * Data refreshes every 5 minutes automatically; user can also refresh manually.
 * Shows an "All systems normal" state when no active alerts are found.
 */

import { useState, useEffect } from 'react'

// Stop IDs for major Twin Cities hubs used as alert sources
const STOP_IDS   = [56913, 51403, 56034, 17976, 56945, 51406, 56022, 56029, 56037, 56044]
const REFETCH_MS = 5 * 60 * 1000  // re-fetch every 5 minutes

// ── icons ─────────────────────────────────────────────────────────────────────

// Warning circle icon for inline error messages
function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

// Circular arrow icon for the Refresh button
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.5A6.5 6.5 0 1 0 14 15.2" />
      <path d="M14 11V15h4" />
    </svg>
  )
}

// Checkmark icon shown in the "all clear" state
function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── alert card ────────────────────────────────────────────────────────────────

// Renders a single deduplicated alert with its text, badge type, and affected stops
function AlertCard({ alert, onViewStop }) {
  const isClosed = alert.stop_closed
  return (
    <div className={`svc-alert-card${isClosed ? ' svc-alert-closed' : ' svc-alert-warning'}`}>
      <div className="svc-alert-header">
        {/* "Stop Closed" badge in red, "Service Alert" in yellow */}
        <span className={`svc-alert-badge${isClosed ? ' svc-badge-closed' : ' svc-badge-warning'}`}>
          {isClosed ? 'Stop Closed' : 'Service Alert'}
        </span>
      </div>

      <p className="svc-alert-text">{alert.alert_text}</p>

      {/* List of stops affected by this alert, with "View Stop" buttons */}
      {alert.affectedStops.length > 0 && (
        <div className="svc-alert-stops">
          {alert.affectedStops.slice(0, 3).map(stop => (
            <div key={stop.stop_id} className="svc-alert-stop-row">
              <span className="svc-alert-stop-name">{stop.description}</span>
              <button
                className="svc-view-btn"
                onClick={() => onViewStop?.({ stop_id: stop.stop_id })}
              >
                View Stop
              </button>
            </div>
          ))}
          {/* Overflow count when more than 3 stops are affected */}
          {alert.affectedStops.length > 3 && (
            <span className="svc-alert-more">
              +{alert.affectedStops.length - 3} more stops affected
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

/*
 * Props:
 *   onStopSelect — called with {stop_id} when "View Stop" is clicked on an alert card
 */
function ServiceStatusPanel({ onStopSelect }) {
  // alerts — deduplicated array of { alert_text, stop_closed, affectedStops[] }
  const [alerts,      setAlerts]      = useState([])
  // loading — true while a fetch is in progress
  const [loading,     setLoading]     = useState(false)
  // error — error string or null
  const [error,       setError]       = useState(null)
  // lastUpdated — Date object of the most recent successful fetch
  const [lastUpdated, setLastUpdated] = useState(null)

  /*
   * Fetches alerts from all 10 stops in parallel and deduplicates by alert_text.
   * API: GET https://svc.metrotransit.org/nextrip/{stopId}
   * Returns: { stops: [{stop_id, description}], alerts: [{alert_text, stop_closed}], ... }
   */
  async function fetchStatus() {
    setLoading(true)
    setError(null)

    try {
      const results = await Promise.allSettled(
        STOP_IDS.map(id =>
          fetch(`https://svc.metrotransit.org/nextrip/${id}`)
            .then(r => r.json())
            .then(data => ({
              stopInfo: data.stops?.[0] ?? null,
              alerts:   Array.isArray(data.alerts) ? data.alerts : [],
            }))
            .catch(() => ({ stopInfo: null, alerts: [] }))
        )
      )

      // Deduplicate alerts by text; collect all stops affected by each unique message
      const alertMap = new Map()
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        const { stopInfo, alerts } = r.value
        for (const alert of alerts) {
          if (!alert.alert_text) continue
          if (!alertMap.has(alert.alert_text)) {
            alertMap.set(alert.alert_text, {
              alert_text:    alert.alert_text,
              stop_closed:   alert.stop_closed ?? false,
              affectedStops: [],
            })
          }
          const entry = alertMap.get(alert.alert_text)
          // If any source marks this alert as a closure, the combined entry is also closed
          if (alert.stop_closed) entry.stop_closed = true
          if (stopInfo && !entry.affectedStops.some(s => s.stop_id === stopInfo.stop_id)) {
            entry.affectedStops.push({
              stop_id:     stopInfo.stop_id,
              description: stopInfo.description,
            })
          }
        }
      }

      // Closed-stop alerts first, then general alerts
      const sorted = [...alertMap.values()].sort((a, b) => {
        if (a.stop_closed !== b.stop_closed) return a.stop_closed ? -1 : 1
        return 0
      })

      setAlerts(sorted)
      setLastUpdated(new Date())
    } catch {
      setError('Could not load service alerts. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount and re-fetch every 5 minutes
  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, REFETCH_MS)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Format the last-updated time as "Updated HH:MM AM/PM"
  const updatedText = lastUpdated
    ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null

  // Summary counts for the chip row above the alert cards
  const closedCount  = alerts.filter(a => a.stop_closed).length
  const warningCount = alerts.filter(a => !a.stop_closed).length

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Service Status</div>
        <div className="panel-heading">Twin Cities transit alerts</div>
      </div>

      {/* Toolbar — shows last-updated time and a manual refresh button */}
      <div className="svc-toolbar">
        <span className="svc-updated-text">
          {loading ? 'Refreshing…' : (updatedText ?? 'Checking alerts…')}
        </span>
        <button className="nearby-refresh-btn" onClick={fetchStatus} disabled={loading}>
          <RefreshIcon />
          Refresh
        </button>
      </div>

      <div className="panel-body">

        {/* Fetch error */}
        {error && !loading && (
          <div className="error-msg">
            <WarnIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Initial loading spinner — only shown before the first fetch completes */}
        {loading && alerts.length === 0 && (
          <div className="nearby-state-msg">
            <span className="spinner" style={{ width: 18, height: 18 }} />
            <span>Checking service status…</span>
          </div>
        )}

        {/* All-clear state — shown when the fetch completed but found no alerts */}
        {!loading && !error && alerts.length === 0 && lastUpdated && (
          <div className="svc-all-clear">
            <div className="svc-all-clear-icon">
              <CheckIcon />
            </div>
            <span className="svc-all-clear-title">All systems normal</span>
            <span className="svc-all-clear-sub">No active service alerts</span>
          </div>
        )}

        {/* Summary chips + alert cards */}
        {alerts.length > 0 && (
          <>
            {/* Count chips — "N closed" and "N alerts" */}
            <div className="svc-summary">
              {closedCount > 0 && (
                <span className="svc-summary-chip svc-summary-closed">
                  {closedCount} closed
                </span>
              )}
              {warningCount > 0 && (
                <span className="svc-summary-chip svc-summary-warning">
                  {warningCount} alert{warningCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* One card per unique alert */}
            {alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} onViewStop={onStopSelect} />
            ))}
          </>
        )}

      </div>
    </div>
  )
}

export default ServiceStatusPanel
