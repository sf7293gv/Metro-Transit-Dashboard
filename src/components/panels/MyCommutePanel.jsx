import { useState, useEffect, useCallback } from 'react'

const HOME_KEY = 'mt-commute-home'
const WORK_KEY = 'mt-commute-work'

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M8 18v-7h4v7" />
    </svg>
  )
}

function WorkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="12" rx="1.5" />
      <path d="M13 7V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2" />
      <path d="M2 12h16" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4.5A8 8 0 1 1 2 10" />
      <path d="M2 4.5V10H7.5" />
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

function CommuteStop({ storageKey, label, Icon }) {
  const [savedId, setSavedId]   = useState(() => localStorage.getItem(storageKey) || '')
  const [inputVal, setInputVal] = useState(() => localStorage.getItem(storageKey) || '')
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const fetchStop = useCallback(async (id) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`https://svc.metrotransit.org/nextrip/${id}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (!json.stops?.length) throw new Error()
      setData(json)
    } catch {
      setError('Stop not found.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch on mount if a stop is saved
  useEffect(() => {
    if (savedId) fetchStop(savedId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    const id = inputVal.trim()
    if (!id || isNaN(Number(id))) { setError('Enter a valid numeric stop ID.'); return }
    localStorage.setItem(storageKey, id)
    setSavedId(id)
    fetchStop(id)
  }

  function handleClear() {
    localStorage.removeItem(storageKey)
    setSavedId('')
    setInputVal('')
    setData(null)
    setError(null)
  }

  const stop       = data?.stops?.[0]
  const alerts     = data?.alerts ?? []
  const departures = (data?.departures ?? []).slice(0, 3)

  return (
    <div className="commute-stop">
      <div className="commute-stop-header">
        <div className="commute-stop-title">
          <Icon />
          {label}
        </div>
        {savedId && (
          <button className="commute-clear-btn" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      <div className="commute-input-row">
        <input
          className="panel-input"
          type="text"
          inputMode="numeric"
          placeholder="Stop ID (e.g. 56913)"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <button
          className="panel-btn panel-btn-sm"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : 'Save'}
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
          <div className="commute-refresh-row">
            <div className="commute-stop-name">{stop.description}</div>
            <button
              className="commute-refresh-btn"
              onClick={() => fetchStop(savedId)}
              disabled={loading}
              title="Refresh departures"
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>

          {alerts.length > 0 && (
            <div className="alert-box">
              <div className="alert-box-label">⚠ Alert</div>
              {alerts.slice(0, 2).map((a, i) => (
                <div key={i}>{a.alert_text}</div>
              ))}
            </div>
          )}

          {departures.length === 0 ? (
            <div className="commute-empty">No upcoming departures.</div>
          ) : (
            <div className="departure-list">
              {departures.map((dep, i) => (
                <DepartureItem key={`${dep.trip_id}-${i}`} dep={dep} />
              ))}
            </div>
          )}
        </>
      )}

      {!savedId && !loading && !error && (
        <div className="commute-empty">Enter a stop ID to save this commute leg.</div>
      )}
    </div>
  )
}

function MyCommutePanel() {
  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">My Commute</div>
        <div className="panel-heading">Saved stops &amp; next buses</div>
      </div>
      <div className="panel-body">
        <CommuteStop storageKey={HOME_KEY} label="Home Stop" Icon={HomeIcon} />
        <CommuteStop storageKey={WORK_KEY} label="Work Stop" Icon={WorkIcon} />
      </div>
    </div>
  )
}

export default MyCommutePanel
