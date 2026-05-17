/*
 * TripPlannerPanel.jsx — "Trip Planner" panel for planning a transit trip.
 * The user enters a starting address and a destination; the panel:
 *   1. Geocodes both addresses via OpenStreetMap Nominatim
 *   2. Builds a coordinate cache of every Metro Transit stop (same approach as NearbyStops)
 *   3. Finds the nearest stop to the origin using the Haversine formula
 *   4. Fetches the next 3 departures from that stop
 *
 * Results include the origin stop name and walk distance, departure suggestions
 * with live/scheduled badges, a "Track Route" shortcut, and the nearest destination stop.
 * The map is updated with A/B pins via the onTripUpdate callback.
 *
 * The stop coordinate cache is module-level and shared with TripPlannerPanel instances —
 * it survives remounts and is only built once per browser session.
 */

import { useState } from 'react'

// ── module-level stop coordinate cache ────────────────────────────────────────
// Built once per session; persists across searches and remounts.

// stopCoordCache — Map<place_code, {place_code, stop_id, description, lat, lng}>; null until built
let stopCoordCache = null
// buildingPromise — prevents parallel builds if called before the first one completes
let buildingPromise = null

// Haversine formula — straight-line distance in miles between two lat/lon coordinates
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Formats a distance in miles as "X ft" under 0.1 mi, or "X.XX mi" otherwise
function formatDist(mi) {
  return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(2)} mi`
}

/*
 * Geocodes an address string to lat/lng using OpenStreetMap Nominatim.
 * API: GET https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1&countrycodes=us
 * Returns: {lat, lng, displayName} or null if not found.
 * Requires User-Agent header per Nominatim usage policy.
 */
async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MetroTransitDashboard/1.0', 'Accept-Language': 'en' },
  })
  if (!res.ok) throw new Error('Geocoding service unavailable.')
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name }
}

/*
 * Builds the stop coordinate cache used to find the nearest stop to a lat/lng.
 * Two phases:
 *   Phase 1 (0–40%): collect unique place_codes from all route stop lists
 *     GET https://svc.metrotransit.org/nextrip/routes → all route IDs
 *     GET https://svc.metrotransit.org/nextrip/stops/{route_id}/{dir} → stop lists
 *   Phase 2 (40–100%): resolve lat/lng for each unique stop
 *     GET https://svc.metrotransit.org/nextrip/{route}/{dir}/{place_code}
 *     → {stops: [{stop_id, latitude, longitude}]}
 * onProgress callback receives a percentage 0–100 for the progress bar.
 */
async function buildCoordCache(onProgress) {
  if (stopCoordCache !== null) return stopCoordCache
  if (buildingPromise) return buildingPromise

  buildingPromise = (async () => {
    try {
      // Phase 1 — collect unique place_codes from all route stop lists (0→40%)
      const routes = await fetch('https://svc.metrotransit.org/nextrip/routes')
        .then(r => r.json()).catch(() => [])

      const tasks = routes.flatMap(r => [
        { routeId: r.route_id, dir: 0 },
        { routeId: r.route_id, dir: 1 },
      ])

      const stopMap = new Map()
      for (let i = 0; i < tasks.length; i += 30) {
        const batch = tasks.slice(i, i + 30)
        const out = await Promise.allSettled(
          batch.map(({ routeId, dir }) =>
            fetch(`https://svc.metrotransit.org/nextrip/stops/${routeId}/${dir}`)
              .then(r => r.json())
              .then(list => ({ routeId, dir, list }))
              .catch(() => null)
          )
        )
        for (const r of out) {
          if (r.status !== 'fulfilled' || !r.value) continue
          const { routeId, dir, list } = r.value
          if (!Array.isArray(list)) continue
          for (const s of list) {
            // First occurrence wins — one route/dir pair is enough for coord lookup
            if (s.place_code && s.description && !stopMap.has(s.place_code)) {
              stopMap.set(s.place_code, {
                place_code:  s.place_code,
                description: s.description,
                fetchRoute:  routeId,
                fetchDir:    dir,
              })
            }
          }
        }
        onProgress?.(Math.round(((i + batch.length) / tasks.length) * 40))
      }

      // Phase 2 — resolve lat/lng for every unique stop (40→100%)
      const stopList = [...stopMap.values()]
      const coordMap = new Map()
      const BATCH = 20

      for (let i = 0; i < stopList.length; i += BATCH) {
        const batch = stopList.slice(i, i + BATCH)
        const out = await Promise.allSettled(
          batch.map(s =>
            fetch(`https://svc.metrotransit.org/nextrip/${s.fetchRoute}/${s.fetchDir}/${s.place_code}`)
              .then(r => r.json())
              .then(data => {
                const stop = data.stops?.[0]
                if (!stop?.stop_id || !stop?.latitude) return null
                return {
                  place_code:  s.place_code,
                  stop_id:     stop.stop_id,
                  description: stop.description || s.description,
                  lat:         stop.latitude,
                  lng:         stop.longitude,
                }
              })
              .catch(() => null)
          )
        )
        for (const r of out) {
          if (r.status === 'fulfilled' && r.value) coordMap.set(r.value.place_code, r.value)
        }
        onProgress?.(40 + Math.round(((i + batch.length) / stopList.length) * 60))
      }

      stopCoordCache = coordMap
      return coordMap
    } catch (err) {
      buildingPromise = null  // allow retry if the build fails
      throw err
    }
  })()

  return buildingPromise
}

// Iterates the entire coordinate map and returns the stop closest to a lat/lng point
function findNearestStop(coordMap, lat, lng) {
  let nearest = null
  let minDist = Infinity
  for (const stop of coordMap.values()) {
    const d = haversine(lat, lng, stop.lat, stop.lng)
    if (d < minDist) { minDist = d; nearest = stop }
  }
  return nearest ? { ...nearest, distance: minDist } : null
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

// Location pin icon for the "Use my location" button
function LocationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2C6.686 2 4 4.686 4 8c0 4.418 6 10 6 10s6-5.582 6-10c0-3.314-2.686-6-6-6z"/>
      <circle cx="10" cy="8" r="2.5"/>
    </svg>
  )
}

// Decorative A→B illustration shown in the idle (no result) state
function EmptyIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="14" r="10" stroke="currentColor" strokeWidth="1.6"/>
      <text x="16" y="18.5" textAnchor="middle" fill="currentColor" fontSize="11"
        fontWeight="700" fontFamily="system-ui,sans-serif">A</text>
      <circle cx="48" cy="50" r="10" stroke="currentColor" strokeWidth="1.6"/>
      <text x="48" y="54.5" textAnchor="middle" fill="currentColor" fontSize="11"
        fontWeight="700" fontFamily="system-ui,sans-serif">B</text>
      <path d="M22 20 Q32 32 42 44" stroke="currentColor" strokeWidth="1.4"
        strokeDasharray="3.5 3" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="3" fill="currentColor" opacity="0.35"/>
    </svg>
  )
}

// ── main component ────────────────────────────────────────────────────────────

/*
 * Props:
 *   onTripUpdate — called with {from: {lat,lng,label}, to: {lat,lng,label}} after a
 *                  successful search; App.jsx uses this to place A/B pins on the map
 *   onTrackRoute — called with a route_id when "Track Route →" is clicked
 */
function TripPlannerPanel({ onTripUpdate, onTrackRoute }) {
  // fromInput — text in the "Starting location" field
  const [fromInput,          setFromInput]          = useState('')
  // toInput — text in the "Destination" field
  const [toInput,            setToInput]            = useState('')
  // fromCoordsOverride — set when GPS is used; bypasses geocoding for the origin
  const [fromCoordsOverride, setFromCoordsOverride] = useState(null)

  // phase — controls which body content is shown: 'idle'|'geocoding'|'scanning'|'loading'|'done'|'error'
  const [phase,    setPhase]    = useState('idle')
  // progress — 0–100 percentage for the cache-build progress bar
  const [progress, setProgress] = useState(0)
  // result — { from, to, originStop, destStop, departures } on success
  const [result,   setResult]   = useState(null)
  // error — human-readable error string or null
  const [error,    setError]    = useState(null)

  /*
   * Main search handler — runs the full geocode → cache → nearest-stop → departures flow.
   */
  async function handleFindRoutes() {
    const from = fromInput.trim()
    const to   = toInput.trim()
    if (!from) { setError('Enter a starting location.'); return }
    if (!to)   { setError('Enter a destination.'); return }

    setError(null)
    setResult(null)

    try {
      // Step 1 — Geocode both addresses (or use GPS override for origin)
      setPhase('geocoding')
      const [fromCoords, toCoords] = await Promise.all([
        fromCoordsOverride
          ? Promise.resolve({ ...fromCoordsOverride, displayName: from })
          : geocodeAddress(from),
        geocodeAddress(to),
      ])

      if (!fromCoords) throw new Error(`Could not find "${from}". Try a more specific address.`)
      if (!toCoords)   throw new Error(`Could not find "${to}". Try a more specific address.`)

      // Step 2 — Build stop coordinate cache (skipped if already built)
      setPhase('scanning')
      setProgress(stopCoordCache !== null ? 100 : 0)
      const coordMap = await buildCoordCache(pct => setProgress(pct))
      setProgress(100)

      // Step 3 — Find the nearest stop to the origin and destination
      const originStop = findNearestStop(coordMap, fromCoords.lat, fromCoords.lng)
      const destStop   = findNearestStop(coordMap, toCoords.lat,   toCoords.lng)
      if (!originStop) throw new Error('No transit stops found near your starting location.')

      // Step 4 — Fetch the next 3 departures from the origin stop
      // GET https://svc.metrotransit.org/nextrip/{stop_id}
      // Returns: { departures: [{route_short_name, description, departure_text, actual, route_id}] }
      setPhase('loading')
      const depRes = await fetch(`https://svc.metrotransit.org/nextrip/${originStop.stop_id}`)
      if (!depRes.ok) throw new Error('Could not load departures from the nearest stop.')
      const depJson = await depRes.json()
      const departures = (depJson.departures ?? []).slice(0, 3)

      setResult({ from: fromCoords, to: toCoords, originStop, destStop, departures })
      setPhase('done')

      // Update the map with A/B pins for the trip endpoints
      onTripUpdate?.({
        from: { lat: fromCoords.lat, lng: fromCoords.lng, label: from },
        to:   { lat: toCoords.lat,   lng: toCoords.lng,   label: to },
      })
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  // Fills the origin field with the user's current GPS coordinates
  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setFromInput('My Location')
        setFromCoordsOverride({ lat, lng })
      },
      () => setError('Could not get your location. Check browser permissions.')
    )
  }

  // true while any of the async phases are running — disables inputs and the Find button
  const isSearching = phase === 'geocoding' || phase === 'scanning' || phase === 'loading'
  // Label for the progress bar during the cache-build phase
  const scanLabel   = progress < 40 ? 'Loading route network…' : 'Mapping stop locations…'

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Trip Planner</div>
        <div className="panel-heading">Plan your ride</div>
      </div>

      {/* Origin and destination inputs with A/B labels */}
      <div className="trip-form-area">
        <div className="trip-field-row">
          <span className="trip-field-dot trip-dot-from">A</span>
          <input
            className="panel-input"
            type="text"
            placeholder="Starting location or address"
            value={fromInput}
            onChange={e => { setFromInput(e.target.value); setFromCoordsOverride(null) }}
            onKeyDown={e => e.key === 'Enter' && handleFindRoutes()}
            disabled={isSearching}
          />
          {/* GPS button — replaces origin text with "My Location" and stores lat/lng */}
          <button
            className="trip-loc-btn"
            onClick={handleUseMyLocation}
            title="Use my location"
            aria-label="Use my current location"
            disabled={isSearching}
          >
            <LocationIcon />
          </button>
        </div>

        {/* Decorative connecting line between A and B fields */}
        <div className="trip-connector" aria-hidden="true" />

        <div className="trip-field-row">
          <span className="trip-field-dot trip-dot-to">B</span>
          <input
            className="panel-input"
            type="text"
            placeholder="Destination address"
            value={toInput}
            onChange={e => setToInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFindRoutes()}
            disabled={isSearching}
          />
        </div>

        {/* Find Routes button — disabled while searching or inputs are empty */}
        <button
          className="panel-btn"
          style={{ marginTop: 4, width: '100%' }}
          onClick={handleFindRoutes}
          disabled={isSearching || !fromInput.trim() || !toInput.trim()}
        >
          {isSearching
            ? <><span className="spinner" style={{ width: 14, height: 14 }} />Searching…</>
            : 'Find Routes'
          }
        </button>
      </div>

      <div className="panel-body">

        {/* Geocoding or API error */}
        {error && (
          <div className="error-msg">
            <WarnIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Progress bar shown while the stop coordinate cache is being built */}
        {phase === 'scanning' && progress < 100 && (
          <div className="trip-scan-wrap">
            <div className="trip-scan-row">
              <span className="trip-scan-label">{scanLabel}</span>
              <span className="trip-scan-pct">{progress}%</span>
            </div>
            <div className="trip-prog-bar">
              <div className="trip-prog-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="trip-scan-note">Building stop index — only happens once per session</span>
          </div>
        )}

        {/* Idle state — shown before the user submits their first search */}
        {phase === 'idle' && (
          <div className="trip-empty">
            <div className="trip-empty-icon"><EmptyIllustration /></div>
            <p className="trip-empty-title">Where are you going?</p>
            <p className="trip-empty-sub">
              Enter a starting point and destination to find nearby transit options.
            </p>
          </div>
        )}

        {/* Results — shown after a successful search */}
        {phase === 'done' && result && (
          <>
            {/* Origin stop card — shows stop name and walk distance */}
            <div className="trip-stop-card">
              <span className="trip-stop-dot trip-dot-from" />
              <div>
                <div className="trip-stop-name">{result.originStop.description}</div>
                <div className="trip-stop-sub">Walk {formatDist(result.originStop.distance)} to board</div>
              </div>
            </div>

            {/* Departure suggestions from the origin stop */}
            <div className="section-label">Next departures</div>
            {result.departures.length === 0 ? (
              <div className="routes-empty">No upcoming departures from this stop.</div>
            ) : result.departures.map((dep, i) => (
              <div key={`${dep.trip_id}-${i}`} className="trip-dep-card">
                <div className="trip-dep-top">
                  <span className="departure-route-badge">{dep.route_short_name}</span>
                  <span className="trip-dep-dest">{dep.description}</span>
                  <span className="trip-dep-time">{dep.departure_text}</span>
                  {dep.actual
                    ? <span className="badge-live">Live</span>
                    : <span className="badge-sched">Sched</span>
                  }
                </div>
                <div className="trip-dep-footer">
                  <span className="trip-dep-walk">
                    Walk {formatDist(result.originStop.distance)} to stop
                  </span>
                  {/* Shortcut to start tracking this route on the map */}
                  <button
                    className="trip-track-btn"
                    onClick={() => onTrackRoute?.(dep.route_id)}
                  >
                    Track Route →
                  </button>
                </div>
              </div>
            ))}

            {/* Destination stop card — shows nearest stop to the destination */}
            {result.destStop && (
              <div className="trip-stop-card">
                <span className="trip-stop-dot trip-dot-to" />
                <div>
                  <div className="trip-stop-name">{result.destStop.description}</div>
                  <div className="trip-stop-sub">
                    Nearest stop {formatDist(result.destStop.distance)} from destination
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}

export default TripPlannerPanel
