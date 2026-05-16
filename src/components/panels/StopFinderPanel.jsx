import { useState, useEffect } from 'react'

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

function DepartureItem({ dep }) {
  return (
    <div className="departure-item">
      <span className="departure-route-badge">{dep.route_short_name}</span>
      <div className="departure-info">
        <div className="departure-dest">{dep.description}</div>
        <div className="departure-sub">{dep.direction_text}</div>
      </div>
      <span className="departure-time">{dep.departure_text}</span>
      {dep.actual
        ? <span className="badge-live">Live</span>
        : <span className="badge-sched">Sched</span>
      }
    </div>
  )
}

function StopFinderPanel({ stopId }) {
  const [input, setInput]     = useState('')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // explicitId lets the useEffect call fetchStop without relying on stale `input` state
  async function fetchStop(explicitId) {
    const id = (explicitId != null ? String(explicitId) : input).trim()
    if (!id) { setError('Enter a stop ID.'); return }
    if (isNaN(Number(id))) { setError('Stop IDs are numeric (e.g. 56913).'); return }

    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`https://svc.metrotransit.org/nextrip/${id}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (!json.stops?.length) throw new Error()
      setData(json)
    } catch {
      setError('Stop not found. Double-check the stop ID.')
    } finally {
      setLoading(false)
    }
  }

  // Triggered by map marker click — update input field and auto-fetch
  useEffect(() => {
    if (stopId == null) return
    setInput(String(stopId))
    fetchStop(stopId)
  }, [stopId]) // eslint-disable-line react-hooks/exhaustive-deps

  const stop        = data?.stops?.[0]
  const alerts      = data?.alerts ?? []
  const departures  = data?.departures ?? []

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Stop Finder</div>
        <div className="panel-heading">Real-time departures</div>
      </div>

      <div className="panel-body">
        <div className="stop-finder-form">
          <input
            className="panel-input"
            type="text"
            inputMode="numeric"
            placeholder="Stop ID (e.g. 56913)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchStop()}
          />
          <button
            className="panel-btn panel-btn-sm"
            onClick={fetchStop}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Find'}
          </button>
        </div>

        {error && (
          <div className="error-msg">
            <WarnIcon />
            <span>{error}</span>
          </div>
        )}

        {stop && (
          <>
            <div>
              <div className="stop-name-label">{stop.description}</div>
              <div className="stop-name-sub">Stop #{stop.stop_id}</div>
            </div>

            {alerts.length > 0 && (
              <div className="alert-box">
                <div className="alert-box-label">⚠ Service Alert{alerts.length > 1 ? 's' : ''}</div>
                {alerts.map((a, i) => (
                  <div key={i}>{a.alert_text}</div>
                ))}
              </div>
            )}

            {departures.length === 0 ? (
              <div className="routes-empty">No upcoming departures found.</div>
            ) : (
              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>
                  Upcoming departures
                </div>
                <div className="departure-list">
                  {departures.map((dep, i) => (
                    <DepartureItem key={`${dep.trip_id}-${i}`} dep={dep} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default StopFinderPanel
