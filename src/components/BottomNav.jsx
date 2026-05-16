const NAV_ITEMS = [
  { id: 'map',     label: 'Live Map', icon: '🗺️' },
  { id: 'stops',   label: 'Stops',    icon: '🔍' },
  { id: 'nearby',  label: 'Nearby',   icon: '📍' },
  { id: 'routes',  label: 'Routes',   icon: '⭐' },
  { id: 'commute', label: 'Commute',  icon: '🚌' },
  { id: 'status',  label: 'Status',   icon: '🚨' },
  { id: 'planner', label: 'Plan',     icon: '🗓️' },
]

function BottomNav({ activePanel, onPanelChange, favorites = [] }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(({ id, label, icon }) => (
        <button
          key={id}
          className={`bottom-nav-tab${activePanel === id ? ' active' : ''}`}
          onClick={() => onPanelChange(id)}
          aria-label={label}
          aria-current={activePanel === id ? 'page' : undefined}
        >
          <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
          <span className="bottom-nav-label">{label}</span>
          {id === 'routes' && favorites.length > 0 && (
            <span className="bottom-nav-badge" aria-label={`${favorites.length} favorites`}>
              {favorites.length}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
