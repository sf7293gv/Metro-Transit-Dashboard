import SearchPanel from './SearchPanel.jsx'
import StopFinderPanel from './panels/StopFinderPanel.jsx'
import MyCommutePanel from './panels/MyCommutePanel.jsx'
import RoutesPanel from './panels/RoutesPanel.jsx'
import NearbyStopsPanel from './panels/NearbyStopsPanel.jsx'
import ServiceStatusPanel from './panels/ServiceStatusPanel.jsx'

function MapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5l6-3 6 3 6-3v13l-6 3-6-3-6 3V5z" />
      <path d="M7 2v13M13 5v13" />
    </svg>
  )
}

function BusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="11" rx="2" />
      <path d="M3 9h14" />
      <circle cx="6.5" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M6.5 14v1M13.5 14v1" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 2l2.3 4.6 5.1.75-3.7 3.6.87 5.1L10 13.6l-4.57 2.46.87-5.1L2.6 7.36l5.1-.75L10 2z" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7 5h9M7 10h9M7 15h9M3 5h.01M3 10h.01M3 15h.01" />
    </svg>
  )
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2L2 17h16L10 2z" />
      <path d="M10 8v3.5M10 14.5h.01" />
    </svg>
  )
}

function NearbyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none" />
      <path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4l-6 6 6 6" />
    </svg>
  )
}

const PANELS = [
  { id: 'map',     label: 'Live Map', Icon: MapIcon    },
  { id: 'stops',   label: 'Stops',    Icon: BusIcon    },
  { id: 'commute', label: 'Commute',  Icon: StarIcon   },
  { id: 'routes',  label: 'Routes',   Icon: ListIcon   },
  { id: 'nearby',  label: 'Nearby',   Icon: NearbyIcon },
  { id: 'status',  label: 'Status',   Icon: StatusIcon },
]

function Sidebar({ open, activePanel, onPanelChange, onToggle, liveMapProps, onTrackRoute, stopId, onStopSelect, favorites = [], onToggleFavorite }) {
  return (
    <div className={`sidebar-wrapper${open ? '' : ' collapsed'}`}>
      <div className="sidebar">

        <nav className="sidebar-nav">
          {PANELS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-tab${activePanel === id ? ' active' : ''}`}
              onClick={() => onPanelChange(id)}
            >
              <Icon />
              <span className="nav-tab-text">
                {label}
                {id === 'routes' && favorites.length > 0 && (
                  <span className="nav-tab-badge">{favorites.length}</span>
                )}
              </span>
            </button>
          ))}
          <button
            className="nav-collapse-btn"
            onClick={onToggle}
            title="Collapse sidebar"
          >
            <ChevronLeftIcon />
          </button>
        </nav>

        <div className="sidebar-content">
          {/* All panels stay mounted — CSS hides inactive ones */}
          <div className={`panel-slot${activePanel === 'map'     ? ' panel-active' : ''}`}>
            <SearchPanel {...liveMapProps} />
          </div>
          <div className={`panel-slot${activePanel === 'stops'   ? ' panel-active' : ''}`}>
            <StopFinderPanel stopId={stopId} />
          </div>
          <div className={`panel-slot${activePanel === 'commute' ? ' panel-active' : ''}`}>
            <MyCommutePanel />
          </div>
          <div className={`panel-slot${activePanel === 'routes'  ? ' panel-active' : ''}`}>
            <RoutesPanel onTrackRoute={onTrackRoute} favorites={favorites} onToggleFavorite={onToggleFavorite} />
          </div>
          <div className={`panel-slot${activePanel === 'nearby'  ? ' panel-active' : ''}`}>
            <NearbyStopsPanel onStopSelect={onStopSelect} />
          </div>
          <div className={`panel-slot${activePanel === 'status'  ? ' panel-active' : ''}`}>
            <ServiceStatusPanel onStopSelect={onStopSelect} />
          </div>
        </div>

      </div>
    </div>
  )
}

export default Sidebar
