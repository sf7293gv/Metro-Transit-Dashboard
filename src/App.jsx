import { useState, useEffect, useRef } from 'react'
import AlertsBanner from './components/AlertsBanner.jsx'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import MapView from './components/MapView.jsx'
import BusDetailPanel from './components/BusDetailPanel.jsx'
import './index.css'

const REFRESH_INTERVAL = 30000
const HISTORY_KEY    = 'mt-route-history'
const FAVORITES_KEY  = 'mt-favorites'
const THEME_KEY      = 'mt-theme'

function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

// Apply saved theme before first React render to avoid flash-of-wrong-theme
;(function applyInitialTheme() {
  try {
    if (localStorage.getItem(THEME_KEY) === 'light') document.body.classList.add('light-mode')
  } catch {}
})()

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY))   ?? [] } catch { return [] }
}
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) ?? [] } catch { return [] }
}

// ─── Stop coordinate resolution ───────────────────────────────────────────────
//
// GET /nextrip/stops/{route}/{dir} only returns { place_code, description }.
// There are NO latitude/longitude fields in that response.
//
// To get coordinates we must call the departures endpoint for each place_code:
//   GET /nextrip/{route}/{dir}/{place_code}
// which returns { stops: [{ stop_id, latitude, longitude, description }], ... }
//
async function fetchStops(routeId) {
  try {
    // Step 1 — fetch the stop lists for both directions in parallel
    const [r0, r1] = await Promise.allSettled([
      fetch(`https://svc.metrotransit.org/nextrip/stops/${routeId}/0`).then(r => r.json()),
      fetch(`https://svc.metrotransit.org/nextrip/stops/${routeId}/1`).then(r => r.json()),
    ])

    const list0 = r0.status === 'fulfilled' && Array.isArray(r0.value) ? r0.value : []
    const list1 = r1.status === 'fulfilled' && Array.isArray(r1.value) ? r1.value : []

    // ── USER-REQUESTED DIAGNOSTIC LOG ─────────────────────────────────────
    console.group(`[NexTrip] stops response for route ${routeId}`)
    console.log('Direction 0 raw:', list0)
    console.log('Direction 1 raw:', list1)
    console.log(
      'Has lat/lon?',
      'latitude' in (list0[0] ?? list1[0] ?? {}),  // expected: false
      '← stops list never includes coordinates; must resolve per stop'
    )
    console.groupEnd()
    // ──────────────────────────────────────────────────────────────────────

    // Step 2 — deduplicate by place_code (same physical stop appears in both dirs)
    const seen = new Set()
    const unique = []
    for (const [list, dir] of [[list0, 0], [list1, 1]]) {
      for (const s of list) {
        if (s.place_code && !seen.has(s.place_code)) {
          seen.add(s.place_code)
          unique.push({ place_code: s.place_code, description: s.description, dir })
        }
      }
    }

    // Step 3 — for each unique place_code, hit the departures endpoint to get
    //          the actual stop_id + latitude + longitude
    const coordResults = await Promise.allSettled(
      unique.map(p =>
        fetch(`https://svc.metrotransit.org/nextrip/${routeId}/${p.dir}/${p.place_code}`)
          .then(r => r.json())
          .then(data => {
            const stop = data.stops?.[0]
            if (!stop?.latitude || !stop?.longitude) return null
            return {
              stop_id:     stop.stop_id,
              latitude:    stop.latitude,
              longitude:   stop.longitude,
              description: stop.description || p.description,
              place_code:  p.place_code,
            }
          })
          .catch(() => null)
      )
    )

    const markers = coordResults
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)

    console.log(`[NexTrip] Resolved ${markers.length} stop markers with coordinates:`, markers)
    return markers
  } catch (err) {
    console.error('[NexTrip] fetchStops failed:', err)
    return []
  }
}
// ──────────────────────────────────────────────────────────────────────────────

function App() {
  // Theme
  const [theme, setTheme] = useState(loadTheme)

  useEffect(() => {
    document.body.classList.toggle('light-mode', theme === 'light')
    try { localStorage.setItem(THEME_KEY, theme) } catch {}
  }, [theme])

  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  // Sidebar navigation
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [activePanel, setActivePanel]   = useState('map')

  // Live Map panel state (shared with MapView)
  const [routeInput, setRouteInput]     = useState('')
  const [buses, setBuses]               = useState([])
  const [stops, setStops]               = useState([])
  const [activeRoute, setActiveRoute]   = useState(null)
  const [error, setError]               = useState(null)
  const [loading, setLoading]           = useState(false)
  const [countdown, setCountdown]       = useState(0)
  const [routeHistory, setRouteHistory] = useState(loadHistory)
  const [favorites,    setFavorites]    = useState(loadFavorites)

  // Bus detail panel
  const [selectedBus, setSelectedBus]   = useState(null)

  // Stop Finder panel — driven by map marker clicks or Nearby Stops selection
  const [selectedStopId, setSelectedStopId] = useState(null)

  // Map fly-to — updated whenever the user selects a stop from outside the map
  const [mapCenter, setMapCenter] = useState(null)

  // Trip Planner — from/to pin markers shown on the map
  const [tripPoints, setTripPoints] = useState(null)

  const fetchIntervalRef     = useRef(null)
  const countdownIntervalRef = useRef(null)

  function startCountdown() {
    clearInterval(countdownIntervalRef.current)
    setCountdown(30)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1))
    }, 1000)
  }

  async function fetchBuses(routeNumber) {
    setLoading(true)
    try {
      const res = await fetch(`https://svc.metrotransit.org/nextrip/vehicles/${routeNumber}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (!data?.length) { setError('No buses currently in service on this route.'); setBuses([]) }
      else               { setError(null); setBuses(data) }
    } catch {
      setError('Could not fetch bus data. Please try again.')
    } finally {
      setLoading(false)
      startCountdown()
    }
  }

  // Keep the detail panel fresh when buses refresh
  useEffect(() => {
    if (!selectedBus || !buses.length) return
    const fresh = buses.find(b => b.trip_id === selectedBus.trip_id)
    if (fresh) setSelectedBus(fresh)
  }, [buses]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFavorite(routeId) {
    const id = String(routeId)
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function addToHistory(val) {
    setRouteHistory(prev => {
      const next = [val, ...prev.filter(r => String(r) !== String(val))].slice(0, 5)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function handleSubmit() {
    const val = parseInt(routeInput, 10)
    if (!routeInput || isNaN(val) || val < 2 || val > 852) {
      setError('Enter a valid route number between 2 and 852.')
      return
    }
    setError(null)
    setBuses([])
    addToHistory(val)
    setActiveRoute(val)
  }

  function handleHistorySelect(route) {
    setRouteInput(String(route))
    setError(null)
    setBuses([])
    addToHistory(route)
    setActiveRoute(route)
  }

  function handleStopSelect(stop) {
    setSelectedStopId(stop.stop_id)
    setActivePanel('stops')
    setSidebarOpen(true)
    if (stop.latitude != null && stop.longitude != null) {
      // ts forces the effect to re-fire even when the same stop is selected twice
      setMapCenter({ lat: stop.latitude, lng: stop.longitude, ts: Date.now() })
    }
  }

  function handleTripUpdate(points) {
    setTripPoints(points)
  }

  function handleTrackRoute(routeId) {
    setRouteInput(String(routeId))
    setError(null)
    setBuses([])
    setSelectedBus(null)
    addToHistory(routeId)
    setActiveRoute(routeId)
    setActivePanel('map')
    setSidebarOpen(true)
  }

  // When activeRoute changes: fetch buses on interval AND fetch stops once
  useEffect(() => {
    if (activeRoute === null) return

    clearInterval(fetchIntervalRef.current)
    setStops([])

    fetchBuses(activeRoute)
    fetchIntervalRef.current = setInterval(() => fetchBuses(activeRoute), REFRESH_INTERVAL)

    // Stops don't change often — fetch once per route selection
    fetchStops(activeRoute).then(setStops)

    return () => {
      clearInterval(fetchIntervalRef.current)
      clearInterval(countdownIntervalRef.current)
    }
  }, [activeRoute])

  const isLive = !!activeRoute && !loading && buses.length > 0

  const liveMapProps = {
    routeInput, onRouteChange: setRouteInput,
    onSubmit: handleSubmit, loading, error,
    activeRoute, busCount: buses.length,
    countdown, routeHistory,
    onHistorySelect: handleHistorySelect,
    favorites, onToggleFavorite: toggleFavorite,
  }

  return (
    <div className="app">
      <AlertsBanner />
      <Header isLive={isLive} theme={theme} onToggleTheme={toggleTheme} />
      <div className="app-body">
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar
          open={sidebarOpen}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          onToggle={() => setSidebarOpen(o => !o)}
          liveMapProps={liveMapProps}
          onTrackRoute={handleTrackRoute}
          stopId={selectedStopId}
          onStopSelect={handleStopSelect}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onTripUpdate={handleTripUpdate}
        />
        <div className="map-area">
          {!sidebarOpen && (
            <button
              className="sidebar-open-btn"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M8 4l6 6-6 6" />
              </svg>
            </button>
          )}
          <MapView
            buses={buses}
            stops={stops}
            onBusSelect={setSelectedBus}
            selectedBusId={selectedBus?.trip_id}
            onStopSelect={handleStopSelect}
            mapCenter={mapCenter}
            tripPoints={tripPoints}
            theme={theme}
          />
          <BusDetailPanel
            bus={selectedBus}
            onClose={() => setSelectedBus(null)}
            onTrackRoute={handleTrackRoute}
          />
        </div>
      </div>
    </div>
  )
}

export default App
