/*
 * RoutesPanel.jsx — Browsable list of all Metro Transit routes.
 * Fetches the full route catalog on mount and displays them grouped by agency.
 * A starred/favorites section appears at the top; routes can be starred from
 * the star button on each row. Clicking any route calls onTrackRoute so the
 * map starts showing buses for that route.
 * A search input filters the list by route label or ID in real time.
 */

import { useState, useEffect, useMemo } from 'react'

// Human-readable names for the agency_id values returned by the API
const AGENCY_NAMES = {
  0:  'Metro Transit',
  2:  'Met Council',
  3:  'Minnesota Valley',
  4:  'Maple Grove',
  5:  'Plymouth',
  6:  'SouthWest Transit',
  10: 'Airport (MAC)',
  11: 'University of Minnesota',
}

// Magnifying glass icon inside the search box
function SearchIcon() {
  return (
    <svg
      className="routes-search-icon"
      width="16" height="16" viewBox="0 0 20 20"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M13 13l4 4" />
    </svg>
  )
}

// Star icon; filled=true renders a gold filled star
function StarIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20"
      fill={filled ? '#f59e0b' : 'none'}
      stroke={filled ? '#f59e0b' : 'currentColor'}
      strokeWidth="1.5" strokeLinejoin="round"
    >
      <path d="M10 2l2.3 4.6 5.1.75-3.7 3.6.87 5.1L10 13.6l-4.57 2.46.87-5.1L2.6 7.36l5.1-.75L10 2z" />
    </svg>
  )
}

// A single route row — clicking the row tracks the route; clicking the star toggles it
function RouteRow({ route, isFavorite, onTrack, onToggle }) {
  return (
    <div
      className="route-item"
      onClick={() => onTrack(route.route_id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onTrack(route.route_id)}
    >
      <span className="route-item-label">{route.route_label}</span>
      <span className="route-item-id">{route.route_id}</span>
      <span className="route-item-track">Track</span>
      {/* stopPropagation prevents the row click from also firing when the star is clicked */}
      <button
        className={`star-btn${isFavorite ? ' starred' : ''}`}
        onClick={e => { e.stopPropagation(); onToggle(route.route_id) }}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFavorite ? `Unstar route ${route.route_id}` : `Star route ${route.route_id}`}
      >
        <StarIcon filled={isFavorite} />
      </button>
    </div>
  )
}

/*
 * Props:
 *   onTrackRoute     — called with a route_id when a route row is clicked
 *   favorites        — array of starred route IDs (as strings)
 *   onToggleFavorite — called with route_id to add/remove from favorites
 */
function RoutesPanel({ onTrackRoute, favorites = [], onToggleFavorite }) {
  // routes — full list returned by the API
  const [routes,  setRoutes]  = useState([])
  // loading — true while the initial route list is being fetched
  const [loading, setLoading] = useState(true)
  // error — error string if the fetch failed, null otherwise
  const [error,   setError]   = useState(null)
  // query — text in the search box; filters routes in real time
  const [query,   setQuery]   = useState('')

  /*
   * Fetch all routes on mount.
   * API: GET https://svc.metrotransit.org/nextrip/routes
   * Returns: [{route_id, route_label, agency_id}, ...]
   */
  useEffect(() => {
    fetch('https://svc.metrotransit.org/nextrip/routes')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => setRoutes(data))
      .catch(() => setError('Could not load routes.'))
      .finally(() => setLoading(false))
  }, [])

  // favSet — Set of favorite route IDs for O(1) membership checks
  const favSet = useMemo(() => new Set(favorites.map(String)), [favorites])

  // filtered — routes matching the search query (or all routes when query is empty)
  const filtered = useMemo(() => {
    if (!query.trim()) return routes
    const q = query.toLowerCase()
    return routes.filter(r =>
      r.route_label.toLowerCase().includes(q) ||
      r.route_id.toLowerCase().includes(q)
    )
  }, [routes, query])

  // favRoutes — starred routes from the filtered list, shown at the top
  const favRoutes = useMemo(
    () => filtered.filter(r => favSet.has(String(r.route_id))),
    [filtered, favSet]
  )

  // groups — non-starred routes grouped by agency name for the main list
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      if (favSet.has(String(r.route_id))) continue  // already in the starred section
      const name = AGENCY_NAMES[r.agency_id] ?? `Agency ${r.agency_id}`
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(r)
    }
    return map
  }, [filtered, favSet])

  return (
    <div className="search-panel" style={{ overflow: 'hidden' }}>
      <div className="panel-header">
        <div className="panel-eyebrow">All Routes</div>
        <div className="panel-heading">Click any route to track it live</div>
      </div>

      {/* Search box — filters the list by route name or number */}
      <div className="routes-search-wrap">
        <SearchIcon />
        <input
          className="routes-search"
          type="text"
          placeholder="Search routes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Route count summary */}
      {!loading && !error && (
        <div className="routes-count">
          {filtered.length} route{filtered.length !== 1 ? 's' : ''}
          {query ? ' matching' : ' available'}
        </div>
      )}

      <div className="routes-list">
        {/* Loading state */}
        {loading && (
          <div className="routes-empty">
            <span className="spinner-dark" style={{ margin: '0 auto 8px', display: 'block', width: 20, height: 20 }} />
            Loading routes…
          </div>
        )}

        {/* Fetch error */}
        {error && (
          <div className="routes-empty" style={{ color: 'var(--error)' }}>{error}</div>
        )}

        {/* Empty search results */}
        {!loading && !error && filtered.length === 0 && (
          <div className="routes-empty">No routes match "{query}"</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            {/* ── Favorites section — always shown even when empty (with placeholder) ── */}
            <div className="routes-fav-section">
              <div className="routes-group-label">Starred Routes</div>
              {favRoutes.length === 0 ? (
                <div className="routes-fav-empty">
                  Star a route to save it here
                </div>
              ) : (
                favRoutes.map(route => (
                  <RouteRow
                    key={route.route_id}
                    route={route}
                    isFavorite={true}
                    onTrack={onTrackRoute}
                    onToggle={onToggleFavorite}
                  />
                ))
              )}
            </div>

            {/* ── All routes grouped by agency ── */}
            {[...groups.entries()].map(([agencyName, agencyRoutes]) => (
              <div key={agencyName}>
                <div className="routes-group-label">{agencyName}</div>
                {agencyRoutes.map(route => (
                  <RouteRow
                    key={route.route_id}
                    route={route}
                    isFavorite={false}
                    onTrack={onTrackRoute}
                    onToggle={onToggleFavorite}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default RoutesPanel
