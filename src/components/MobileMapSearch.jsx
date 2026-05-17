import { useState, useEffect, useRef } from 'react'

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="M12 12l3.5 3.5" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

function MobileMapSearch({
  routeInput, onRouteChange, onSubmit,
  loading, error, activeRoute, busCount,
  countdown, routeHistory, onHistorySelect,
  activePanel,
}) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  // Close when a panel sheet opens
  useEffect(() => {
    if (activePanel !== 'map') setOpen(false)
  }, [activePanel])

  // Auto-focus input when sheet opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  function handleTrack() {
    const ok = onSubmit()
    if (ok) setOpen(false)
  }

  function handleHistoryTap(route) {
    onHistorySelect(route)
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleTrack()
    if (e.key === 'Escape') setOpen(false)
  }

  const isTracking = !!activeRoute
  const showFloating = activePanel === 'map' && !open

  // Bus count label for pill
  function busLabel() {
    if (loading && busCount === 0) return null
    if (busCount === 1) return '1 bus'
    if (busCount > 1)  return `${busCount} buses`
    return 'No buses'
  }

  return (
    <>
      {/* ── Floating search button (no active route) ── */}
      {showFloating && !isTracking && (
        <button
          className="mobile-map-search-btn"
          onClick={() => setOpen(true)}
          aria-label="Search for a route"
        >
          <SearchIcon />
        </button>
      )}

      {/* ── Active route pill ── */}
      {showFloating && isTracking && (
        <button
          className="mobile-route-pill"
          onClick={() => setOpen(true)}
          aria-label={`Route ${activeRoute} — tap to search`}
        >
          <span className="mrp-route">Route {activeRoute}</span>
          <span className="mrp-sep" aria-hidden="true">·</span>
          {loading && busCount === 0
            ? <span className="spinner mrp-spinner" aria-label="Loading" />
            : <span className="mrp-buses">{busLabel()}</span>
          }
        </button>
      )}

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="mobile-search-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Compact search sheet ── */}
      <div
        className={`mobile-search-sheet${open ? ' open' : ''}`}
        aria-label="Route search"
        aria-hidden={!open}
      >
        <div className="mobile-search-drag-handle" aria-hidden="true" />

        <div className="mobile-search-body">
          {/* Input row */}
          <div className="mobile-search-row">
            <input
              ref={inputRef}
              type="number"
              className="route-input mobile-search-input"
              placeholder="Route number (e.g. 21)"
              value={routeInput}
              onChange={e => onRouteChange(e.target.value)}
              onKeyDown={handleKeyDown}
              min="2"
              max="852"
              inputMode="numeric"
            />
            <button
              className="track-btn mobile-search-track-btn"
              onClick={handleTrack}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Track'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mobile-search-error">
              <WarnIcon />
              <span>{error}</span>
            </div>
          )}

          {/* Recent history chips */}
          {routeHistory.length > 0 && (
            <div className="history-section">
              <span className="history-label">Recent</span>
              <div className="history-chips">
                {routeHistory.map(r => (
                  <button
                    key={r}
                    className={`history-chip${activeRoute === r ? ' active' : ''}`}
                    onClick={() => handleHistoryTap(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status row when tracking */}
          {isTracking && (
            <div className="mobile-search-status">
              <span className="mobile-search-status-text">
                {loading
                  ? `Loading Route ${activeRoute}…`
                  : busCount > 0
                    ? `${busCount} bus${busCount > 1 ? 'es' : ''} on Route ${activeRoute}`
                    : `No buses on Route ${activeRoute}`
                }
              </span>
              {!loading && countdown > 0 && (
                <span className="countdown-label">↻ {countdown}s</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default MobileMapSearch
