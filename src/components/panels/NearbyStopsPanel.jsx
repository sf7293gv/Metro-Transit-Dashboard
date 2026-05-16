import { useState, useRef } from 'react'

// ── constants ─────────────────────────────────────────────────────────────────

const RADIUS      = 0.5   // miles
const CONCURRENCY = 15    // parallel coord-resolve calls

// ── helpers ───────────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R  = 3958.8
  const dL = (lat2 - lat1) * Math.PI / 180
  const dl = (lon2 - lon1) * Math.PI / 180
  const a  = Math.sin(dL / 2) ** 2
           + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dl / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function formatDist(mi) {
  return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(2)} mi`
}

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

function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.5A6.5 6.5 0 1 0 14 15.2" />
      <path d="M14 11V15h4" />
    </svg>
  )
}

// ── stop card ─────────────────────────────────────────────────────────────────

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

      <div className="nearby-stop-routes">
        {stop.routes.slice(0, 7).map(r => (
          <span key={r} className="nearby-route-badge">{r}</span>
        ))}
        {stop.routes.length > 7 && (
          <span className="nearby-route-badge nearby-route-more">+{stop.routes.length - 7}</span>
        )}
      </div>

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

function NearbyStopsPanel({ onStopSelect }) {
  const [phase,    setPhase]    = useState('idle')
  const [stops,    setStops]    = useState([])
  const [progress, setProgress] = useState({ checked: 0, total: 0 })
  const [errMsg,   setErrMsg]   = useState('')
  const scanIdRef = useRef(0)

  async function startScan() {
    const id = ++scanIdRef.current
    setPhase('locating')
    setStops([])
    setProgress({ checked: 0, total: 0 })
    setErrMsg('')

    // 1 — GPS
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

    // 2 — All routes
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

    // 3 — Stop lists (place_codes) for every route × direction, batched at 30
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

    // 4 — Deduplicate stops by place_code; track which routes serve each
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
            fetchRoute:   routeId,
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

    // 5 — Resolve coordinates + departures in batches; display progressively
    //     GET /nextrip/{route}/{dir}/{place_code} returns both coords AND departures
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
          if (dist > RADIUS) return null
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
      if (anyNew) setStops([...nearby].sort((a, b) => a.distance - b.distance))
    }

    if (id !== scanIdRef.current) return

    // 6 — Refresh departures via stop_id to get ALL routes at each stop
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

  const pct = progress.total > 0 ? (progress.checked / progress.total) * 100 : 0

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Nearby Stops</div>
        <div className="panel-heading">Within ½ mile of you</div>
      </div>

      <div className="panel-body">

        {/* ── idle ── */}
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

        {/* ── locating ── */}
        {phase === 'locating' && (
          <div className="nearby-state-msg">
            <span className="spinner" style={{ width: 18, height: 18 }} />
            <span>Getting your location…</span>
          </div>
        )}

        {/* ── scanning ── */}
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

        {/* ── error ── */}
        {phase === 'error' && (
          <>
            <div className="error-msg">
              <WarnIcon />
              <span>{errMsg}</span>
            </div>
            <button className="panel-btn" onClick={startScan}>Try Again</button>
          </>
        )}

        {/* ── done ── */}
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
