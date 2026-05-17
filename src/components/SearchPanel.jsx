/*
 * SearchPanel.jsx — Desktop sidebar panel for the Live Map tab.
 * Lets the user type a route number, click "Track Route", and see
 * a countdown timer + bus count while tracking is active.
 * Also renders recent route history chips and a favorite (star) toggle.
 * All state lives in App.jsx; this component is purely presentational.
 */

// Warning icon shown next to validation error messages
function WarnIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 16 16"
      fill="currentColor" xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/>
      <path d="M7.25 4.75h1.5V9h-1.5V4.75ZM7.25 10.5h1.5V12h-1.5V10.5Z"/>
    </svg>
  )
}

// Star icon used for the favorite button; filled=true makes it gold
function StarIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20"
      fill={filled ? '#f59e0b' : 'none'}
      stroke={filled ? '#f59e0b' : 'currentColor'}
      strokeWidth="1.5" strokeLinejoin="round"
    >
      <path d="M10 2l2.3 4.6 5.1.75-3.7 3.6.87 5.1L10 13.6l-4.57 2.46.87-5.1L2.6 7.36l5.1-.75L10 2z" />
    </svg>
  )
}

/*
 * Props:
 *   routeInput      — current text in the route number field
 *   onRouteChange   — called on every keystroke with the new value
 *   onSubmit        — called when Track is clicked or Enter is pressed
 *   loading         — true while buses are being fetched
 *   error           — validation or fetch error string, or null
 *   activeRoute     — the route number currently being tracked (null if none)
 *   busCount        — number of buses returned by the last fetch
 *   countdown       — seconds remaining until the next auto-refresh (0–30)
 *   routeHistory    — array of recently tracked route numbers
 *   onHistorySelect — called with a route number when a history chip is tapped
 *   favorites       — array of favorited route IDs (as strings)
 *   onToggleFavorite — called with the route ID to star/unstar it
 */
function SearchPanel({
  routeInput, onRouteChange, onSubmit,
  loading, error, activeRoute, busCount,
  countdown, routeHistory, onHistorySelect,
  favorites = [], onToggleFavorite,
}) {
  // Whether the active route is in the user's favorites list
  const isFav = favorites.includes(String(activeRoute))

  // Percentage of the 30-second refresh cycle already elapsed, drives the progress bar
  const countdownPct = (countdown / 30) * 100

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Route Tracker</div>
        <div className="panel-heading">Find buses in service</div>
      </div>

      <div className="panel-body">
        {/* Route number input — accepts 2–852 */}
        <div>
          <label className="input-label" htmlFor="route-input">
            Route number (2 – 852)
          </label>
          <input
            id="route-input"
            className="route-input"
            type="number"
            min="2"
            max="852"
            placeholder="e.g. 5"
            value={routeInput}
            onChange={e => onRouteChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSubmit()}
          />
        </div>

        {/* Track button — disabled while loading to prevent double-submits */}
        <button className="track-btn" onClick={onSubmit} disabled={loading}>
          {loading ? (
            <><span className="spinner" />Loading…</>
          ) : (
            'Track Route'
          )}
        </button>

        {/* Inline error shown for invalid input or failed API call */}
        {error && (
          <div className="error-msg">
            <WarnIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Recent history chips — quick re-select of past routes */}
        {routeHistory.length > 0 && (
          <div className="history-section">
            <span className="history-label">Recent</span>
            <div className="history-chips">
              {routeHistory.map(route => (
                <button
                  key={route}
                  className={`history-chip${activeRoute === route ? ' active' : ''}`}
                  onClick={() => onHistorySelect(route)}
                >
                  {route}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer shown only when a route is actively tracked */}
      {activeRoute && (
        <div className="panel-footer">
          <div className="panel-status">
            {/* Bus count and route label */}
            <span className="status-text">
              Route {activeRoute}
              {' · '}
              {loading ? 'refreshing…' : `${busCount > 0 ? `${busCount} in service` : 'no buses'}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Star button to save/remove this route from favorites */}
              <button
                className={`star-btn${isFav ? ' starred' : ''}`}
                onClick={() => onToggleFavorite?.(String(activeRoute))}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <StarIcon filled={isFav} />
              </button>
              {/* Countdown label — hidden while loading */}
              {!loading && <span className="countdown-label">{countdown}s</span>}
            </div>
          </div>
          {/* Progress bar fills left-to-right as the refresh countdown ticks down */}
          <div className="countdown-track">
            <div
              className="countdown-fill"
              style={{ width: `${countdownPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchPanel
