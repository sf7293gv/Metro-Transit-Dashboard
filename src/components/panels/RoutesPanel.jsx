import { useState, useEffect, useMemo } from 'react'

const AGENCY_NAMES = {
  0: 'Metro Transit',
  2: 'Met Council',
  3: 'Minnesota Valley',
  4: 'Maple Grove',
  5: 'Plymouth',
  6: 'SouthWest Transit',
  10: 'Airport (MAC)',
  11: 'University of Minnesota',
}

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

function RoutesPanel({ onTrackRoute }) {
  const [routes, setRoutes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [query, setQuery]     = useState('')

  useEffect(() => {
    fetch('https://svc.metrotransit.org/nextrip/routes')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => setRoutes(data))
      .catch(() => setError('Could not load routes.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return routes
    const q = query.toLowerCase()
    return routes.filter(r =>
      r.route_label.toLowerCase().includes(q) ||
      r.route_id.toLowerCase().includes(q)
    )
  }, [routes, query])

  // Group by agency
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      const name = AGENCY_NAMES[r.agency_id] ?? `Agency ${r.agency_id}`
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(r)
    }
    return map
  }, [filtered])

  return (
    <div className="search-panel" style={{ overflow: 'hidden' }}>
      <div className="panel-header">
        <div className="panel-eyebrow">All Routes</div>
        <div className="panel-heading">Click any route to track it live</div>
      </div>

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

      {!loading && !error && (
        <div className="routes-count">
          {filtered.length} route{filtered.length !== 1 ? 's' : ''}
          {query ? ' matching' : ' available'}
        </div>
      )}

      <div className="routes-list">
        {loading && (
          <div className="routes-empty">
            <span className="spinner-dark" style={{ margin: '0 auto 8px', display: 'block', width: 20, height: 20 }} />
            Loading routes…
          </div>
        )}

        {error && (
          <div className="routes-empty" style={{ color: 'var(--error)' }}>{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="routes-empty">No routes match "{query}"</div>
        )}

        {!loading && !error && [...groups.entries()].map(([agencyName, agencyRoutes]) => (
          <div key={agencyName}>
            <div className="routes-group-label">{agencyName}</div>
            {agencyRoutes.map(route => (
              <div
                key={route.route_id}
                className="route-item"
                onClick={() => onTrackRoute(route.route_id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onTrackRoute(route.route_id)}
              >
                <span className="route-item-label">{route.route_label}</span>
                <span className="route-item-id">{route.route_id}</span>
                <span className="route-item-track">Track</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default RoutesPanel
