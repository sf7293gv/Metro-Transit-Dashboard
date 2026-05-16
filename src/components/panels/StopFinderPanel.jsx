import { useState, useEffect, useRef } from 'react'

// ── module-level stop index ───────────────────────────────────────────────────

let stopIndex = null
let buildingPromise = null

async function buildStopIndex() {
  if (stopIndex !== null) return stopIndex
  if (buildingPromise) return buildingPromise
  buildingPromise = (async () => {
    const routes = await fetch('https://svc.metrotransit.org/nextrip/routes')
      .then(r => r.json())
      .catch(() => [])

    const tasks = routes.flatMap(r => [
      { routeId: r.route_id, dir: 0 },
      { routeId: r.route_id, dir: 1 },
    ])

    const stopMap = new Map()
    for (let i = 0; i < tasks.length; i += 30) {
      const batch = tasks.slice(i, i + 30)
      const results = await Promise.allSettled(
        batch.map(({ routeId, dir }) =>
          fetch(`https://svc.metrotransit.org/nextrip/stops/${routeId}/${dir}`)
            .then(r => r.json())
            .then(list => ({ routeId, dir, list }))
            .catch(() => null)
        )
      )
      for (const r of results) {
        if (r.status !== 'fulfilled' || !r.value) continue
        const { routeId, dir, list } = r.value
        if (!Array.isArray(list)) continue
        for (const s of list) {
          if (!s.place_code || !s.description) continue
          if (!stopMap.has(s.place_code)) {
            stopMap.set(s.place_code, {
              place_code:  s.place_code,
              description: s.description,
              fetchRoute:  routeId,
              fetchDir:    dir,
            })
          }
        }
      }
    }

    stopIndex = [...stopMap.values()]
    return stopIndex
  })()
  return buildingPromise
}

// ── icons ─────────────────────────────────────────────────────────────────────

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

// ── highlight matching substring ──────────────────────────────────────────────

function HighlightMatch({ text, query }) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="suggestion-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── departure item ────────────────────────────────────────────────────────────

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

// ── main component ────────────────────────────────────────────────────────────

function StopFinderPanel({ stopId }) {
  const [input,        setInput]        = useState('')
  const [data,         setData]         = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [indexReady,   setIndexReady]   = useState(stopIndex !== null)
  const [suggestions,  setSuggestions]  = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIdx,    setActiveIdx]    = useState(-1)

  const wrapperRef = useRef(null)

  // Kick off index build in background
  useEffect(() => {
    if (stopIndex !== null) return
    buildStopIndex().then(() => setIndexReady(true)).catch(() => {})
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  async function fetchStop(explicitId) {
    const id = (explicitId != null ? String(explicitId) : input).trim()
    if (!id) { setError('Enter a stop ID or name.'); return }
    if (isNaN(Number(id))) { setError('Stop IDs are numeric. Select a suggestion or enter a number.'); return }

    setLoading(true)
    setError(null)
    setData(null)
    setShowDropdown(false)
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

  async function selectSuggestion(stop) {
    setShowDropdown(false)
    setSuggestions([])
    setInput(stop.description)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      // Resolve place_code → numeric stop_id via the route/dir/place endpoint
      const depRes = await fetch(
        `https://svc.metrotransit.org/nextrip/${stop.fetchRoute}/${stop.fetchDir}/${stop.place_code}`
      )
      if (!depRes.ok) throw new Error()
      const depJson = await depRes.json()
      const resolvedId = depJson.stops?.[0]?.stop_id
      if (!resolvedId) throw new Error()

      // Fetch full all-routes departures for this stop
      const res = await fetch(`https://svc.metrotransit.org/nextrip/${resolvedId}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (!json.stops?.length) throw new Error()
      setData(json)
    } catch {
      setError('Could not load stop. Try entering the stop ID directly.')
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(e) {
    const val = e.target.value
    setInput(val)
    setData(null)
    setError(null)

    const trimmed = val.trim()
    if (!trimmed || /^\d+$/.test(trimmed)) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    if (stopIndex !== null) {
      const q = trimmed.toLowerCase()
      const matches = stopIndex
        .filter(s => s.description.toLowerCase().includes(q))
        .slice(0, 6)
      setSuggestions(matches)
      setShowDropdown(matches.length > 0)
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }
    setActiveIdx(-1)
  }

  function handleKeyDown(e) {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') fetchStop()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectSuggestion(activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIdx(-1)
    }
  }

  function handleFind() {
    const trimmed = input.trim()
    if (!/^\d+$/.test(trimmed) && suggestions.length > 0) {
      selectSuggestion(suggestions[0])
    } else {
      fetchStop()
    }
  }

  // Triggered externally (e.g. map stop marker click)
  useEffect(() => {
    if (stopId == null) return
    setInput(String(stopId))
    setSuggestions([])
    setShowDropdown(false)
    fetchStop(stopId)
  }, [stopId]) // eslint-disable-line react-hooks/exhaustive-deps

  const isNumericOnly  = /^\d+$/.test(input.trim())
  const showIndexHint  = !indexReady && input.trim().length > 0 && !isNumericOnly

  const stop       = data?.stops?.[0]
  const alerts     = data?.alerts ?? []
  const departures = data?.departures ?? []

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Stop Finder</div>
        <div className="panel-heading">Real-time departures</div>
      </div>

      {/* Search area lives outside panel-body so suggestions aren't clipped by overflow */}
      <div className="stop-finder-search-area" ref={wrapperRef}>
        <div className="stop-finder-form">
          <input
            className="panel-input"
            type="text"
            placeholder="Stop ID or name (e.g. Target Field)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
            autoComplete="off"
          />
          <button
            className="panel-btn panel-btn-sm"
            onClick={handleFind}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Find'}
          </button>
        </div>

        {showIndexHint && (
          <div className="stop-index-hint">
            <span className="spinner" style={{ width: 10, height: 10 }} />
            Building stop index…
          </div>
        )}

        {showDropdown && suggestions.length > 0 && (
          <div className="stop-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={s.place_code}
                className={`stop-suggestion-item${i === activeIdx ? ' active' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectSuggestion(s) }}
              >
                <span className="stop-suggestion-name">
                  <HighlightMatch text={s.description} query={input} />
                </span>
                <span className="stop-suggestion-code">{s.place_code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel-body">
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
