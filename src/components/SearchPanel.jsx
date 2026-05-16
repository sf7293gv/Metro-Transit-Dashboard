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

function SearchPanel({
  routeInput, onRouteChange, onSubmit,
  loading, error, activeRoute, busCount,
  countdown, routeHistory, onHistorySelect,
  favorites = [], onToggleFavorite,
}) {
  const isFav = favorites.includes(String(activeRoute))
  const countdownPct = (countdown / 30) * 100

  return (
    <div className="search-panel">
      <div className="panel-header">
        <div className="panel-eyebrow">Route Tracker</div>
        <div className="panel-heading">Find buses in service</div>
      </div>

      <div className="panel-body">
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

        <button className="track-btn" onClick={onSubmit} disabled={loading}>
          {loading ? (
            <><span className="spinner" />Loading…</>
          ) : (
            'Track Route'
          )}
        </button>

        {error && (
          <div className="error-msg">
            <WarnIcon />
            <span>{error}</span>
          </div>
        )}

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

      {activeRoute && (
        <div className="panel-footer">
          <div className="panel-status">
            <span className="status-text">
              Route {activeRoute}
              {' · '}
              {loading ? 'refreshing…' : `${busCount > 0 ? `${busCount} in service` : 'no buses'}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className={`star-btn${isFav ? ' starred' : ''}`}
                onClick={() => onToggleFavorite?.(String(activeRoute))}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <StarIcon filled={isFav} />
              </button>
              {!loading && <span className="countdown-label">{countdown}s</span>}
            </div>
          </div>
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
