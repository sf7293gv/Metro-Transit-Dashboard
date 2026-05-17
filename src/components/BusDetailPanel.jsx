/*
 * BusDetailPanel.jsx — Slide-in panel that shows detailed info about a selected bus.
 * Appears as a fixed overlay (right side on desktop, bottom sheet on mobile).
 * Displays route, direction, speed, heading, GPS age, and upcoming stops fetched
 * from the NexTrip API in a 4-step process.
 * Closes when the user clicks X or presses Escape.
 */

import { useState, useEffect } from 'react'

/* ── helpers ─────────────────────────────────────── */

// Converts a Unix timestamp (seconds) to a human-readable "X seconds/minutes ago" string
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

// Maps a compass bearing (0–360°) to a cardinal direction label
const COMPASS_DIRS = ['North','Northeast','East','Southeast','South','Southwest','West','Northwest']
function bearingToText(b) { return COMPASS_DIRS[Math.round((b ?? 0) / 45) % 8] }

// Expands NB/SB/EB/WB abbreviation to full direction name
const DIR_LABELS = { NB: 'Northbound', SB: 'Southbound', EB: 'Eastbound', WB: 'Westbound' }
function expandDir(d) { return DIR_LABELS[d] || d || 'Unknown' }

// Converts km/h from the API to miles per hour
function toMph(kmh) { return Math.round(kmh * 0.621371) }

// Maps the bus direction abbreviation to the first word of the API's direction_name
// (used to match NB → "North" in the /nextrip/directions/:route response)
const DIRECTION_STARTS = { NB: 'North', SB: 'South', EB: 'East', WB: 'West' }

// Finds the numeric direction_id that matches the bus's direction abbreviation
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

// Rotating compass rose; the needle points in the bus's current direction of travel
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

// Label/value row used for each piece of bus info (route, speed, heading, etc.)
function Row({ label, children }) {
  return (
    <div className="bus-detail-row">
      <div className="bus-detail-label">{label}</div>
      <div className="bus-detail-value">{children}</div>
    </div>
  )
}

/* ── trip stops timeline ─────────────────────────── */

// Renders the upcoming stops list with a vertical connecting line between them
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
        // First stop gets a highlighted dot to indicate it's the very next stop
        <div key={stop.place_code} className={`trip-stop-row${i === 0 ? ' trip-stop-next' : ''}`}>
          <div className="trip-stop-indicator">
            <div className={`trip-stop-dot${i === 0 ? ' trip-stop-dot-next' : ''}`} />
            {/* Vertical line connecting to the next stop; omitted after the last row */}
            {i < tripData.stops.length - 1 && <div className="trip-stop-line" />}
          </div>
          <div className="trip-stop-info">
            <span className="trip-stop-name">{stop.description}</span>
            <div className="trip-stop-time-wrap">
              <span className="trip-stop-time">{stop.departure_text}</span>
              {/* Live badge = real-time GPS data; Sched = scheduled only */}
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

/*
 * Props:
 *   bus          — bus object from the NexTrip vehicles list; null when panel is closed
 *   onClose      — called to deselect the bus and close the panel
 *   onTrackRoute — called with the route id when "Track Route on Map" is clicked
 */
function BusDetailPanel({ bus, onClose, onTrackRoute }) {
  // Dummy state used only to force a re-render every second so "X seconds ago" updates
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Close the panel when Escape is pressed
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // tripData — { stops: [], total, nextIndex } for the upcoming stop timeline
  const [tripData,    setTripData]    = useState(null)
  // tripLoading — true while the 4-step upcoming stops fetch is in progress
  const [tripLoading, setTripLoading] = useState(false)

  /*
   * 4-step upcoming stops fetch:
   *   1. GET /nextrip/directions/{route_id}         → array of direction objects
   *   2. GET /nextrip/stops/{route_id}/{dir_id}     → ordered stop list for this direction
   *   3. GET /nextrip/{route_id}/{dir_id}/{place_code} for every stop (parallel)
   *   4. Filter departures where trip_id matches this bus → upcoming stops only
   *
   * Re-runs when bus.trip_id or bus.location_time changes (new bus selected or position updated).
   */
  useEffect(() => {
    if (!bus) { setTripData(null); setTripLoading(false); return }

    let cancelled = false

    async function fetchTripStops() {
      setTripLoading(true)
      try {
        // Step 1 — resolve numeric direction_id from bus.direction abbreviation
        // GET https://svc.metrotransit.org/nextrip/directions/{route_id}
        // Returns: [{direction_id, direction_name}, ...]
        const dirs = await fetch(
          `https://svc.metrotransit.org/nextrip/directions/${bus.route_id}`
        ).then(r => r.json()).catch(() => null)
        if (cancelled || !dirs) return

        const dirId = resolveDirectionId(dirs, bus.direction)
        if (dirId === null) return

        // Step 2 — get the ordered stop list for this route + direction
        // GET https://svc.metrotransit.org/nextrip/stops/{route_id}/{dir_id}
        // Returns: [{place_code, description}, ...]
        const stopList = await fetch(
          `https://svc.metrotransit.org/nextrip/stops/${bus.route_id}/${dirId}`
        ).then(r => r.json()).catch(() => null)
        if (cancelled || !Array.isArray(stopList) || stopList.length === 0) return

        // Step 3 — fetch departures for every stop in parallel
        // GET https://svc.metrotransit.org/nextrip/{route_id}/{dir_id}/{place_code}
        // Returns: { stops: [...], departures: [{trip_id, departure_text, actual, ...}] }
        const results = await Promise.allSettled(
          stopList.map((stop, idx) =>
            fetch(`https://svc.metrotransit.org/nextrip/${bus.route_id}/${dirId}/${stop.place_code}`)
              .then(r => r.json())
              .then(data => ({ idx, stop, data }))
              .catch(() => null)
          )
        )
        if (cancelled) return

        // Step 4 — collect stops where this bus's trip_id appears (= upcoming stops only)
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

        // Sort by stop order and show only the next 3
        upcoming.sort((a, b) => a.stopIndex - b.stopIndex)

        if (!cancelled) {
          setTripData({
            stops:     upcoming.slice(0, 3),
            total:     stopList.length,
            nextIndex: upcoming[0]?.stopIndex ?? null,
          })
        }
      } catch {
        // Trip data is supplementary — fail silently rather than showing an error
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
      {/* Drag handle — visible on mobile to hint the panel is swipeable */}
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

      {/* Body only rendered when a bus is selected */}
      {bus && (
        <div className="bus-detail-body">
          <Row label="Route">Route {bus.route_id}</Row>

          <Row label="Direction &amp; Terminal">
            {expandDir(bus.direction)}
            {bus.terminal
              ? <span className="bus-detail-value-muted"> — Terminal {bus.terminal}</span>
              : null}
          </Row>

          {/* Rotating compass SVG + text label for current heading */}
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

          {/* Uses timeAgo() — updates every second via the tick state */}
          <Row label="Last GPS ping">
            {bus.location_time
              ? timeAgo(bus.location_time)
              : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>No GPS data</span>
            }
          </Row>

          {/* Upcoming stops — spinner while loading, then the timeline */}
          {tripLoading && (
            <div className="trip-loading">
              <span className="spinner" style={{ width: 14, height: 14 }} />
              Loading route data…
            </div>
          )}
          {!tripLoading && <TripStops tripData={tripData} />}

          {/* Shortcut to start tracking this bus's route on the map */}
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
