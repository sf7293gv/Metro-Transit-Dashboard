/*
 * BottomNav.jsx — Fixed bottom navigation bar shown only on mobile (≤768px).
 * Renders seven emoji-labeled tabs, one per panel in the app.
 * The active tab is highlighted and receives aria-current="page".
 * A small badge on the Routes tab shows the number of starred routes.
 * Hidden on desktop via "display: none" in index.css.
 */

// Tab definitions — id must match the panel ids used in App.jsx and Sidebar.jsx
const NAV_ITEMS = [
  { id: 'map',     label: 'Live Map', icon: '🗺️' },
  { id: 'stops',   label: 'Stops',    icon: '🔍' },
  { id: 'nearby',  label: 'Nearby',   icon: '📍' },
  { id: 'routes',  label: 'Routes',   icon: '⭐' },
  { id: 'commute', label: 'Commute',  icon: '🚌' },
  { id: 'status',  label: 'Status',   icon: '🚨' },
  { id: 'planner', label: 'Plan',     icon: '🗓️' },
]

/*
 * Props:
 *   activePanel   — id of the currently visible panel
 *   onPanelChange — called with the new panel id when a tab is tapped
 *   favorites     — array of starred route IDs; length drives the Routes badge
 */
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
          {/* Badge shows starred route count on the Routes tab */}
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
