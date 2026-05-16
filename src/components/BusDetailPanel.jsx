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

/* ── compass SVG (arrow rotates to match bearing) ── */

function CompassIcon({ bearing }) {
  return (
    <div className="compass-icon" style={{ transform: `rotate(${bearing ?? 0}deg)` }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12.5" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
        {/* North arrow — filled accent */}
        <path d="M14 4 L17.5 18 L14 15.5 L10.5 18 Z" fill="#0053A0" />
        {/* South arrow — dimmed */}
        <path d="M14 24 L10.5 10 L14 12.5 L17.5 10 Z" fill="rgba(255,255,255,0.15)" />
        <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.35)" />
      </svg>
    </div>
  )
}

/* ── close button ──────────────────────────────────── */

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

/* ── detail row ───────────────────────────────────── */

function Row({ label, children }) {
  return (
    <div className="bus-detail-row">
      <div className="bus-detail-label">{label}</div>
      <div className="bus-detail-value">{children}</div>
    </div>
  )
}

/* ── main component ───────────────────────────────── */

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

  const isOpen = bus !== null

  return (
    <aside
      className={`bus-detail-panel${isOpen ? ' open' : ''}`}
      aria-label="Bus details"
      aria-hidden={!isOpen}
    >
      {/* Mobile drag-handle hint */}
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
          <Row label="Route">
            Route {bus.route_id}
          </Row>

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
