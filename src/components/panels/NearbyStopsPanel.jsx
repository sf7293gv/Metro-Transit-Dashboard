/*
 * NearbyStopsPanel.jsx — Finds all Metro Transit stops within ½ mile of the user.
 * Performs a 6-phase scan:
 *   1. Get GPS coordinates via the browser Geolocation API
 *   2. Fetch the list of all routes
 *   3. Fetch stop lists for every route × direction (batched at 30 to avoid rate limits)
 *   4. Deduplicate stops by place_code and build a unified map
 *   5. Resolve coordinates + departures for each unique stop (batched at 15)
 *   6. Re-fetch departures by stop_id to capture all routes serving each stop
 *
 * Results appear progressively as each batch completes.
 * Uses a scanIdRef to discard results from cancelled/superseded scans.
 */

import { useState, useRef } from 'react'

// ── constants ─────────────────────────────────────────────────────────────────

const RADIUS      = 0.5   // search radius in miles
const CONCURRENCY = 15    // parallel coordinate-resolve calls per batch

// ── helpers ───────────────────────────────────────────────────────────────────

// Haversine formula — calculates the straight-line distance in miles between two lat/lon points
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 3958.8
  const dL = (lat2 - lat1) * Math.PI / 180
  const dl = (lon2 - lon1) * Math.PI / 180
  const a  = Math.sin(dL / 2) ** 2
           + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dl / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Formats a distance in miles as "X ft" under 0.1 mi, or "X.XX mi" otherwise
function formatDist(mi) {
  return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(2)} mi`
}

// Wraps the browser Geolocation API in a promise
function getUserLocation() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      p  => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      err => reject(err),
      { timeout: 10000, maximumAge: 60000 }
    )
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

// Warning circle icon for error states
function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

// Circular refresh arrow for the "Refresh" button
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.5A6.5 6.5 0 1 0 14 15.2" />
      <path d="M14 14V18M14 14h4" />
    </svg>
  )
}

// ── stop card ─────────────────────────────────────────────────────────────────

// Displays one nearby stop: name, distance, served routes (up to 7), and next 2 departures
function NearbyStopCard({ stop, onSelect }) {
  return (
    <div
      className="nearby-stop-card"
      onClick={() => onSelect(stop)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(stop)}
    >
      <div className="nearby-stop-top">
        <span className="nearby-stop-name">{stop.description}</span>
        <span className="nearby-stop-dist">{formatDist(stop.distance)}</span>
      </div>

      {/* Route badges — up to 7 shown; overflow count if more */}
      <div className="nearby-stop-routes">
        {stop.routes.slice(0, 7).map(r => (
          <span key={r} className="nearby-route-badge">{r}</span>
        ))}
        {stop.routes.length > 7 && (
          <span className="nearby-route-badge nearby-route-more">+{stop.routes.length - 7}</span>
        )}
      </div>

      {/* Next 2 departures, or a "no departures" note */}
      {stop.departures.length > 0 ? (
        <div className="nearby-deps">
          {stop.departures.slice(0, 2).map((d, i) => (
            <span key={i} className="nearby-dep">
              <span className="nearby-dep-route">{d.route_short_name}</span>
              <span className="nearby-dep-dest">{d.description}</span>
              <span className="nearby-dep-time">{d.departure_text}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="nearby-no-dep">No scheduled departures</span>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

/*
 * Props:
 *   onStopSelect — called with a stop object when the user clicks a stop card;
 *                  App.jsx uses this to fly the map to that stop
 */
function NearbyStopsPanel({ onStopSelect }) {
  // phase — controls which UI state is shown: 'idle'|'locating'|'scanning'|'error'|'done'
  const [phase,    setPhase]    = useState('idle')
  // stops — array of nearby stops sorted by distance; updated progressively during scan
  const [stops,    setStops]    = useState([])
  // progress — { checked, total } for the progress bar during scanning
  const [progress, setProgress] = useState({ checked: 0, total: 0 })
  // errMsg — human-readable error shown in the error phase
  const [errMsg,   setErrMsg]   = useState('')
  // scanIdRef — incremented on each new scan; used to discard results from old scans
  const scanIdRef = useRef(0)

  async function startScan() {
    const id = ++scanIdRef.current
    setPhase('locating')
    setStops([])
    setProgress({ checked: 0, total: 0 })
    setErrMsg('')

    // Phase 1 — Get GPS coordinates
    let lat, lng
    try {
      ;({ lat, lng } = await getUserLocation())
    } catch {
      if (id !== scanIdRef.current) return
      setErrMsg('Location access denied. Please allow location access and try again.')
      setPhase('error')
      return
    }
    if (id !== scanIdRef.current) return
    setPhase('scanning')

    // Phase 2 — Fetch all routes
    // GET https://svc.metrotransit.org/nextrip/routes
    // Returns: [{route_id, route_label, agency_id}, ...]
    let routes
    try {
      routes = await fetch('https://svc.metrotransit.org/nextrip/routes').then(r => r.json())
    } catch {
      if (id !== scanIdRef.current) return
      setErrMsg('Could not load routes. Please try again.')
      setPhase('error')
      return
    }
    if (id !== scanIdRef.current) return

    // Phase 3 — Fetch stop lists (place_codes) for every route × direction, batched at 30
    // GET https://svc.metrotransit.org/nextrip/stops/{route_id}/{dir}
    // Returns: [{place_code, description}, ...]
    const listTasks = routes.flatMap(r => [
      { routeId: r.route_id, dir: 0 },
      { routeId: r.route_id, dir: 1 },
    ])
    const listResults = []
    for (let i = 0; i < listTasks.length; i += 30) {
      if (id !== scanIdRef.current) return
      const batch = listTasks.slice(i, i + 30)
      const out = await Promise.allSettled(
        batch.map(({ routeId, dir }) =>
          fetch(`https://svc.metrotransit.org/nextrip/stops/${routeId}/${dir}`)
            .then(r => r.json())
            .then(list => ({ routeId, dir, list }))
            .catch(() => null)
        )
      )
      for (const r of out) {
        if (r.status === 'fulfilled' && r.value) listResults.push(r.value)
      }
    }
    if (id !== scanIdRef.current) return

    // Phase 4 — Deduplicate stops by place_code; record which routes serve each stop
    const stopMap = new Map()
    for (const { routeId, dir, list } of listResults) {
      if (!Array.isArray(list)) continue
      for (const s of list) {
        if (!s.place_code) continue
        if (!stopMap.has(s.place_code)) {
          stopMap.set(s.place_code, {
            place_code:   s.place_code,
            description:  s.description,
            routes:       [],
            fetchRoute:   routeId,  // one route/dir pair to use for coordinate lookup
            fetchDir:     dir,
          })
        }
        const entry = stopMap.get(s.place_code)
        if (!entry.routes.includes(routeId)) entry.routes.push(routeId)
      }
    }

    const unique = [...stopMap.values()]
    const total  = unique.length
    setProgress({ checked: 0, total })
    if (id !== scanIdRef.current) return

    // Phase 5 — Resolve coordinates + departures in batches; display progressively
    // GET https://svc.metrotransit.org/nextrip/{route}/{dir}/{place_code}
    // Returns: { stops: [{stop_id, latitude, longitude}], departures: [...] }
    const nearby = []

    for (let i = 0; i < unique.length; i += CONCURRENCY) {
      if (id !== scanIdRef.current) return
      const batch = unique.slice(i, i + CONCURRENCY)

      const results = await Promise.allSettled(
        batch.map(async stop => {
          const data = await fetch(
            `https://svc.metrotransit.org/nextrip/${stop.fetchRoute}/${stop.fetchDir}/${stop.place_code}`
          ).then(r => r.json())
          const s = data.stops?.[0]
          if (!s?.latitude || !s?.longitude) return null
          const dist = haversine(lat, lng, s.latitude, s.longitude)
          if (dist > RADIUS) return null  // outside search radius — skip
          return {
            stop_id:     s.stop_id,
            place_code:  stop.place_code,
            description: s.description || stop.description,
            latitude:    s.latitude,
            longitude:   s.longitude,
            distance:    dist,
            routes:      stop.routes,
            departures:  data.departures ?? [],
          }
        })
      )

      let anyNew = false
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) { nearby.push(r.value); anyNew = true }
      }

      const checked = Math.min(i + CONCURRENCY, total)
      if (id !== scanIdRef.current) return
      setProgress({ checked, total })
      // Render partial results immediately so the user sees stops as they're found
      if (anyNew) setStops([...nearby].sort((a, b) => a.distance - b.distance))
    }

    if (id !== scanIdRef.current) return

    // Phase 6 — Refresh departures via stop_id to capture ALL routes at each stop
    // (phase 5 only returns departures for the one route used for coordinate lookup)
    // GET https://svc.metrotransit.org/nextrip/{stop_id}
    if (nearby.length > 0) {
      const depOut = await Promise.allSettled(
        nearby.map(s =>
          fetch(`https://svc.metrotransit.org/nextrip/${s.stop_id}`)
            .then(r => r.json())
            .then(data => ({ stop_id: s.stop_id, departures: data.departures ?? [] }))
            .catch(() => null)
        )
      )
      if (id !== scanIdRef.current) return
      const depMap = new Map()
      for (const r of depOut) {
        if (r.status === 'fulfilled' && r.value) depMap.set(r.value.stop_id, r.value.departures)
      }
      setStops(
        nearby
          .map(s => ({ ...s, departures: depMap.get(s.stop_id) ?? s.departures }))
          .sort((a, b) => a.distance - b.distance)
      )
    }

    setPhase('done')
  }

  // Percentage complete for the progress bar during scanning
  const pct = progress.total > 0 ? (progress.checked / progress.total) * 100 : 0

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Nearby Stops</div>
        <div className="panel-heading">Within ½ mile of you</div>
      </div>

      <div className="panel-body">

        {/* ── idle — initial state before any scan ── */}
        {phase === 'idle' && (
          <div className="nearby-cta">
            <button className="panel-btn" onClick={startScan}>
              Find Nearby Stops
            </button>
            <p className="nearby-hint">
              Scans all Metro Transit stops within 0.5 miles.
              Takes 30–60 seconds on first use.
            </p>
          </div>
        )}

        {/* ── locating — waiting for browser GPS permission ── */}
        {phase === 'locating' && (
          <div className="nearby-state-msg">
            <span className="spinner" style={{ width: 18, height: 18 }} />
            <span>Getting your location…</span>
          </div>
        )}

        {/* ── scanning — showing progress bar and partial results ── */}
        {phase === 'scanning' && (
          <>
            <div className="nearby-progress-wrap">
              <div className="nearby-progress-label">
                {progress.total > 0
                  ? `Scanning ${progress.checked.toLocaleString()} / ${progress.total.toLocaleString()} stops…`
                  : 'Loading route data…'}
              </div>
              {progress.total > 0 && (
                <div className="nearby-progress-bar">
                  <div className="nearby-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            {stops.length > 0 && (
              <>
                <div className="section-label">
                  {stops.length} stop{stops.length !== 1 ? 's' : ''} found so far
                </div>
                {stops.map(s => (
                  <NearbyStopCard key={s.stop_id} stop={s} onSelect={onStopSelect} />
                ))}
              </>
            )}
          </>
        )}

        {/* ── error — GPS denied or API failure ── */}
        {phase === 'error' && (
          <>
            <div className="error-msg">
              <WarnIcon />
              <span>{errMsg}</span>
            </div>
            <button className="panel-btn" onClick={startScan}>Try Again</button>
          </>
        )}

        {/* ── done — scan complete, show final results ── */}
        {phase === 'done' && (
          <>
            <div className="nearby-done-bar">
              <span className="nearby-done-count">
                {stops.length} stop{stops.length !== 1 ? 's' : ''} within ½ mile
              </span>
              <button className="nearby-refresh-btn" onClick={startScan}>
                <RefreshIcon /> Refresh
              </button>
            </div>
            {stops.length === 0
              ? <div className="routes-empty">No stops found within 0.5 miles.</div>
              : stops.map(s => (
                  <NearbyStopCard key={s.stop_id} stop={s} onSelect={onStopSelect} />
                ))
            }
          </>
        )}

      </div>
    </div>
  )
}

export default NearbyStopsPanel
