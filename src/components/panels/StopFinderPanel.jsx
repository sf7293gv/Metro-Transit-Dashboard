/*
 * StopFinderPanel.jsx — "Stop Finder" panel for looking up real-time departures.
 * Accepts a numeric stop ID or a stop name typed by the user.
 *
 * Name search: a module-level stop index (all stops from all routes) is built
 * in the background the first time this panel mounts. While typing, matches are
 * shown in a dropdown; selecting one resolves the place_code to a numeric stop_id
 * and then fetches departures for that stop.
 *
 * Numeric input: goes directly to GET /nextrip/{id}.
 *
 * The panel also accepts an external stopId prop (from map stop marker clicks),
 * which triggers an automatic fetch bypassing the search input.
 */

import { useState, useEffect, useRef } from 'react'

// ── module-level stop index ───────────────────────────────────────────────────
// Shared across all renders — survives component unmount and remount.

// stopIndex — array of { place_code, description, fetchRoute, fetchDir }; null until built
let stopIndex = null
// buildingPromise — prevents parallel builds if two renders call buildStopIndex simultaneously
let buildingPromise = null

/*
 * Builds a flat list of all unique stops across all routes and directions.
 * Batches requests at 30 at a time to avoid overwhelming the API.
 * GET https://svc.metrotransit.org/nextrip/routes → all route IDs
 * GET https://svc.metrotransit.org/nextrip/stops/{route_id}/{dir} → [{place_code, description}]
 */
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
          // First occurrence wins — each stop only needs one route/dir for coordinate lookup
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

// Warning circle icon for error messages
function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

// ── highlight matching substring ──────────────────────────────────────────────

// Wraps the matching portion of a suggestion label in a <mark> for visual emphasis
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

// One row in the departures list: route badge, destination, direction, time, live/sched badge
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

/*
 * Props:
 *   stopId — numeric stop ID passed in from outside (e.g. map stop marker click);
 *            when it changes, triggers an automatic fetch
 */
function StopFinderPanel({ stopId }) {
  // input — current value of the search field (stop ID or name text)
  const [input,        setInput]        = useState('')
  // data — full API response { stops, departures, alerts }
  const [data,         setData]         = useState(null)
  // loading — true while a fetch is in progress
  const [loading,      setLoading]      = useState(false)
  // error — validation or fetch error string
  const [error,        setError]        = useState(null)
  // indexReady — true once the background stop index build completes
  const [indexReady,   setIndexReady]   = useState(stopIndex !== null)
  // suggestions — up to 6 matching stop objects shown in the dropdown
  const [suggestions,  setSuggestions]  = useState([])
  // showDropdown — whether the suggestions list is visible
  const [showDropdown, setShowDropdown] = useState(false)
  // activeIdx — keyboard-navigated index in the suggestions list (-1 = none)
  const [activeIdx,    setActiveIdx]    = useState(-1)

  const wrapperRef = useRef(null)

  // Start building the stop index in the background as soon as this panel mounts
  useEffect(() => {
    if (stopIndex !== null) return
    buildStopIndex().then(() => setIndexReady(true)).catch(() => {})
  }, [])

  // Close the dropdown when the user clicks anywhere outside the search area
  useEffect(() => {
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  /*
   * Fetches departures for a numeric stop ID.
   * API: GET https://svc.metrotransit.org/nextrip/{id}
   * Returns: { stops: [{stop_id, description}], departures: [...], alerts: [...] }
   */
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

  /*
   * Fetches departures when the user selects a suggestion from the name dropdown.
   * Two-step: place_code → stop_id, then full departures fetch.
   * Step 1: GET https://svc.metrotransit.org/nextrip/{route}/{dir}/{place_code}
   *         → resolves the numeric stop_id from the place_code
   * Step 2: GET https://svc.metrotransit.org/nextrip/{stop_id}
   *         → all-routes departures for this stop
   */
  async function selectSuggestion(stop) {
    setShowDropdown(false)
    setSuggestions([])
    setInput(stop.description)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const depRes = await fetch(
        `https://svc.metrotransit.org/nextrip/${stop.fetchRoute}/${stop.fetchDir}/${stop.place_code}`
      )
      if (!depRes.ok) throw new Error()
      const depJson = await depRes.json()
      const resolvedId = depJson.stops?.[0]?.stop_id
      if (!resolvedId) throw new Error()

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

  // Updates suggestions as the user types; numeric input skips name search
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

    // Filter the in-memory index and show up to 6 matching stops
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

  // Handles ArrowUp/Down navigation within the dropdown and Enter/Escape
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
      // If nothing is keyboard-highlighted, pick the first suggestion
      selectSuggestion(activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIdx(-1)
    }
  }

  // "Find" button handler — auto-selects first suggestion for name input, otherwise numeric fetch
  function handleFind() {
    const trimmed = input.trim()
    if (!/^\d+$/.test(trimmed) && suggestions.length > 0) {
      selectSuggestion(suggestions[0])
    } else {
      fetchStop()
    }
  }

  // Triggered externally when the user clicks a stop marker on the map
  useEffect(() => {
    if (stopId == null) return
    setInput(String(stopId))
    setSuggestions([])
    setShowDropdown(false)
    fetchStop(stopId)
  }, [stopId]) // eslint-disable-line react-hooks/exhaustive-deps

  const isNumericOnly  = /^\d+$/.test(input.trim())
  // Show a "Building stop index…" hint only when the user is typing a name and index isn't ready
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

      {/* Search area sits outside panel-body so the dropdown isn't clipped by overflow:hidden */}
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

        {/* Spinner shown while the stop index is being built in the background */}
        {showIndexHint && (
          <div className="stop-index-hint">
            <span className="spinner" style={{ width: 10, height: 10 }} />
            Building stop index…
          </div>
        )}

        {/* Name-search suggestion dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="stop-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={s.place_code}
                className={`stop-suggestion-item${i === activeIdx ? ' active' : ''}`}
                // onMouseDown instead of onClick to fire before the input's onBlur
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

        {/* Stop info and departures shown after a successful fetch */}
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
