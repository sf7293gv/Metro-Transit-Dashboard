/*
 * MobileMapSearch.jsx — Mobile-only route search overlay for the map view.
 * Hidden on desktop (display:none in CSS); on mobile it replaces the sidebar
 * search which is not visible when the map tab is active.
 *
 * Behavior:
 *   - When no route is tracked: shows a floating blue search button below the header.
 *   - When a route is tracked: replaces the button with a pill showing "Route X · N buses".
 *   - Tapping either opens a slide-up sheet with the route input, history chips, and status.
 *   - On valid submit the sheet closes and buses appear on the map.
 *   - Sheet closes automatically when the user navigates to another tab.
 */

import { useState, useEffect, useRef } from 'react'

// Magnifying glass icon inside the floating search button
function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="M12 12l3.5 3.5" />
    </svg>
  )
}

// Warning icon shown next to validation errors
function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

/*
 * Props mirror SearchPanel:
 *   routeInput      — current value of the route number field
 *   onRouteChange   — keystroke handler
 *   onSubmit        — called on track; returns true (valid) or false (invalid)
 *   loading         — true while buses are being fetched
 *   error           — validation/fetch error string or null
 *   activeRoute     — route number currently tracked, or null
 *   busCount        — number of buses returned
 *   countdown       — seconds until next auto-refresh
 *   routeHistory    — array of recently used route numbers
 *   onHistorySelect — called when a history chip is tapped
 *   activePanel     — current panel id from App; used to close sheet on tab change
 */
function MobileMapSearch({
  routeInput, onRouteChange, onSubmit,
  loading, error, activeRoute, busCount,
  countdown, routeHistory, onHistorySelect,
  activePanel,
}) {
  // open — controls whether the search sheet is visible
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  // Close the search sheet whenever the user switches to a non-map panel
  useEffect(() => {
    if (activePanel !== 'map') setOpen(false)
  }, [activePanel])

  // Auto-focus the input 80ms after the sheet opens (allows the CSS transition to start)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  // Call parent submit; only close the sheet if the submit was valid
  function handleTrack() {
    const ok = onSubmit()
    if (ok) setOpen(false)
  }

  // Tapping a history chip instantly loads that route and closes the sheet
  function handleHistoryTap(route) {
    onHistorySelect(route)
    setOpen(false)
  }

  // Enter submits, Escape closes
  function handleKeyDown(e) {
    if (e.key === 'Enter') handleTrack()
    if (e.key === 'Escape') setOpen(false)
  }

  // isTracking — true when a route is currently being tracked
  const isTracking = !!activeRoute
  // showFloating — show the button/pill only when map is active and sheet is closed
  const showFloating = activePanel === 'map' && !open

  // Formats the bus count for the active-route pill label
  function busLabel() {
    if (loading && busCount === 0) return null
    if (busCount === 1) return '1 bus'
    if (busCount > 1)  return `${busCount} buses`
    return 'No buses'
  }

  return (
    <>
      {/* ── Floating search button — shown when map is active and no route is tracked ── */}
      {showFloating && !isTracking && (
        <button
          className="mobile-map-search-btn"
          onClick={() => setOpen(true)}
          aria-label="Search for a route"
        >
          <SearchIcon />
        </button>
      )}

      {/* ── Active route pill — shown when a route is being tracked ── */}
      {showFloating && isTracking && (
        <button
          className="mobile-route-pill"
          onClick={() => setOpen(true)}
          aria-label={`Route ${activeRoute} — tap to search`}
        >
          <span className="mrp-route">Route {activeRoute}</span>
          <span className="mrp-sep" aria-hidden="true">·</span>
          {/* Show spinner while initial load, then bus count */}
          {loading && busCount === 0
            ? <span className="spinner mrp-spinner" aria-label="Loading" />
            : <span className="mrp-buses">{busLabel()}</span>
          }
        </button>
      )}

      {/* ── Semi-transparent backdrop — tap to close the sheet ── */}
      {open && (
        <div
          className="mobile-search-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Compact route search sheet — slides up from the bottom ── */}
      <div
        className={`mobile-search-sheet${open ? ' open' : ''}`}
        aria-label="Route search"
        aria-hidden={!open}
      >
        {/* Decorative drag handle at the top of the sheet */}
        <div className="mobile-search-drag-handle" aria-hidden="true" />

        <div className="mobile-search-body">
          {/* Route number input + track button side by side */}
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

          {/* Validation or fetch error */}
          {error && (
            <div className="mobile-search-error">
              <WarnIcon />
              <span>{error}</span>
            </div>
          )}

          {/* Recent route history chips */}
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

          {/* Status line shown at the bottom when a route is actively tracked */}
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
              {/* Countdown to next refresh */}
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
