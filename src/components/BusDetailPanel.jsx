import { useState, useEffect } from 'react'

/* ── helpers ─────────────────────────────────────── */

function timeAgo(unixSecs) {
  if (!unixSecs) return null
  const s = Math.floor(Date.now() / 1000 - unixSecs)
  if (s < 5)  return 'Just now'
  if (s < 60) return `${s} second${s !== 1 ? 's' : ''} ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  return `${h} hour${h !== 1 ? 's' : ''} ago`
}

const COMPASS_DIRS = ['North','Northeast','East','Southeast','South','Southwest','West','Northwest']
function bearingToText(b) { return COMPASS_DIRS[Math.round((b ?? 0) / 45) % 8] }

const DIR_LABELS = { NB: 'Northbound', SB: 'Southbound', EB: 'Eastbound', WB: 'Westbound' }
function expandDir(d) { return DIR_LABELS[d] || d || 'Unknown' }

function toMph(kmh) { return Math.round(kmh * 0.621371) }

// Maps the bus direction abbreviation to the first word of the API's direction_name
const DIRECTION_STARTS = { NB: 'North', SB: 'South', EB: 'East', WB: 'West' }

function resolveDirectionId(directions, busDirection) {
  if (!Array.isArray(directions) || !busDirection) return null
  const prefix = DIRECTION_STARTS[busDirection]
  if (prefix) {
    const match = directions.find(d => d.direction_name?.startsWith(prefix))
    if (match != null) return match.direction_id
  }
  return null
}

/* ── compass SVG ─────────────────────────────────── */

function CompassIcon({ bearing }) {
  return (
    <div className="compass-icon" style={{ transform: `rotate(${bearing ?? 0}deg)` }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12.5" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        <path d="M14 4 L17.5 18 L14 15.5 L10.5 18 Z" fill="#0053A0" />
        <path d="M14 24 L10.5 10 L14 12.5 L17.5 10 Z" fill="rgba(255,255,255,0.15)" />
        <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.35)" />
      </svg>
    </div>
  )
}

/* ── close button ────────────────────────────────── */

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

/* ── detail row ──────────────────────────────────── */

function Row({ label, children }) {
  return (
    <div className="bus-detail-row">
      <div className="bus-detail-label">{label}</div>
      <div className="bus-detail-value">{children}</div>
    </div>
  )
}

/* ── trip stops timeline ─────────────────────────── */

function TripStops({ tripData }) {
  if (!tripData || tripData.stops.length === 0) return null
  return (
    <div className="trip-stops-section">
      <div className="trip-section-header">
        <span className="trip-section-label">Upcoming Stops</span>
        {tripData.nextIndex !== null && (
          <span className="trip-progress">
            Stop {tripData.nextIndex + 1} of {tripData.total}
          </span>
        )}
      </div>

      {tripData.stops.map((stop, i) => (
        <div key={stop.place_code} className={`trip-stop-row${i === 0 ? ' trip-stop-next' : ''}`}>
          <div className="trip-stop-indicator">
            <div className={`trip-stop-dot${i === 0 ? ' trip-stop-dot-next' : ''}`} />
            {i < tripData.stops.length - 1 && <div className="trip-stop-line" />}
          </div>
          <div className="trip-stop-info">
            <span className="trip-stop-name">{stop.description}</span>
            <div className="trip-stop-time-wrap">
              <span className="trip-stop-time">{stop.departure_text}</span>
              {stop.actual
                ? <span className="badge-live">Live</span>
                : <span className="badge-sched">Sched</span>
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── main component ──────────────────────────────── */

function BusDetailPanel({ bus, onClose, onTrackRoute }) {
  // Tick every second so "X seconds ago" updates live
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Escape closes the panel
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Upcoming stops data
  const [tripData,    setTripData]    = useState(null)
  const [tripLoading, setTripLoading] = useState(false)

  useEffect(() => {
    if (!bus) { setTripData(null); setTripLoading(false); return }

    let cancelled = false

    async function fetchTripStops() {
      setTripLoading(true)
      try {
        // 1 — resolve numeric direction_id from bus.direction abbreviation
        const dirs = await fetch(
          `https://svc.metrotransit.org/nextrip/directions/${bus.route_id}`
        ).then(r => r.json()).catch(() => null)
        if (cancelled || !dirs) return

        const dirId = resolveDirectionId(dirs, bus.direction)
        if (dirId === null) return

        // 2 — get the ordered stop list for this route + direction
        const stopList = await fetch(
          `https://svc.metrotransit.org/nextrip/stops/${bus.route_id}/${dirId}`
        ).then(r => r.json()).catch(() => null)
        if (cancelled || !Array.isArray(stopList) || stopList.length === 0) return

        // 3 — fetch departures for every stop in parallel
        const results = await Promise.allSettled(
          stopList.map((stop, idx) =>
            fetch(`https://svc.metrotransit.org/nextrip/${bus.route_id}/${dirId}/${stop.place_code}`)
              .then(r => r.json())
              .then(data => ({ idx, stop, data }))
              .catch(() => null)
          )
        )
        if (cancelled) return

        // 4 — collect stops where this bus's trip_id appears (= upcoming stops only)
        const tripId   = String(bus.trip_id)
        const upcoming = []

        for (const r of results) {
          if (r.status !== 'fulfilled' || !r.value) continue
          const { idx, stop, data } = r.value
          const dep = data.departures?.find(d => String(d.trip_id) === tripId)
          if (!dep) continue
          upcoming.push({
            place_code:     stop.place_code,
            description:    data.stops?.[0]?.description || stop.description,
            stopIndex:      idx,
            departure_text: dep.departure_text,
            actual:         dep.actual ?? false,
          })
        }

        upcoming.sort((a, b) => a.stopIndex - b.stopIndex)

        if (!cancelled) {
          setTripData({
            stops:     upcoming.slice(0, 3),
            total:     stopList.length,
            nextIndex: upcoming[0]?.stopIndex ?? null,
          })
        }
      } catch {
        // Trip data is supplementary — fail silently
      } finally {
        if (!cancelled) setTripLoading(false)
      }
    }

    fetchTripStops()
    return () => { cancelled = true }
  }, [bus?.trip_id, bus?.location_time]) // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = bus !== null

  return (
    <aside
      className={`bus-detail-panel${isOpen ? ' open' : ''}`}
      aria-label="Bus details"
      aria-hidden={!isOpen}
    >
      <div className="bus-detail-handle" />

      <header className="bus-detail-header">
        <div className="bus-detail-header-inner">
          <span className="bus-detail-route-tag">
            Route {bus?.route_id ?? '—'}
          </span>
          <span className="bus-detail-header-label">Bus details</span>
        </div>
        <button className="bus-detail-close" onClick={onClose} aria-label="Close bus details">
          <CloseIcon />
        </button>
      </header>

      {bus && (
        <div className="bus-detail-body">
          <Row label="Route">Route {bus.route_id}</Row>

          <Row label="Direction &amp; Terminal">
            {expandDir(bus.direction)}
            {bus.terminal
              ? <span className="bus-detail-value-muted"> — Terminal {bus.terminal}</span>
              : null}
          </Row>

          <Row label="Heading">
            <div className="compass-wrap">
              <CompassIcon bearing={bus.bearing} />
              <div className="compass-text">
                <span>{bearingToText(bus.bearing)}</span>
                <span className="compass-deg">{bus.bearing}°</span>
              </div>
            </div>
          </Row>

          <Row label="Speed">
            {bus.speed > 0
              ? <>{toMph(bus.speed)}<span className="bus-detail-value-muted"> mph</span></>
              : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Stopped</span>
            }
          </Row>

          <Row label="Last GPS ping">
            {bus.location_time
              ? timeAgo(bus.location_time)
              : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>No GPS data</span>
            }
          </Row>

          {/* ── Upcoming stops ── */}
          {tripLoading && (
            <div className="trip-loading">
              <span className="spinner" style={{ width: 14, height: 14 }} />
              Loading route data…
            </div>
          )}
          {!tripLoading && <TripStops tripData={tripData} />}

          <button
            className="bus-detail-track-btn"
            onClick={() => onTrackRoute(bus.route_id)}
          >
            Track Route {bus.route_id} on Map
          </button>
        </div>
      )}
    </aside>
  )
}

export default BusDetailPanel
