/*
 * App.jsx — Root component and single source of truth for the whole app.
 *
 * Responsibilities:
 *   - Holds all shared state (active route, buses, stops, selected bus, theme, etc.)
 *   - Fetches bus positions from the NexTrip API on an interval
 *   - Fetches stop coordinates when a new route is selected
 *   - Passes data and callbacks down to Sidebar, MapView, BusDetailPanel, etc.
 *   - Manages dark/light theme and persists it to localStorage
 *   - On mobile, controls whether the bottom sheet and mobile search sheet are open
 */

import { useState, useEffect, useRef } from 'react'
import AlertsBanner from './components/AlertsBanner.jsx'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import MapView from './components/MapView.jsx'
import BusDetailPanel from './components/BusDetailPanel.jsx'
import BottomNav from './components/BottomNav.jsx'
import MobileMapSearch from './components/MobileMapSearch.jsx'
import UpdateToast from './components/UpdateToast.jsx'
import './index.css'

// How often (ms) to re-fetch bus positions while a route is active
const REFRESH_INTERVAL = 30000

// localStorage keys — changing these would lose users' saved data
const HISTORY_KEY   = 'mt-route-history'
const FAVORITES_KEY = 'mt-favorites'
const THEME_KEY     = 'mt-theme'

// Reads the saved theme from localStorage; defaults to dark if nothing is stored
function loadTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

// Runs immediately when the JS module loads — before React renders — so the
// correct body class is applied before the first paint, preventing a white flash
;(function applyInitialTheme() {
  try {
    if (localStorage.getItem(THEME_KEY) === 'light') document.body.classList.add('light-mode')
  } catch {}
})()

// Reads saved route history from localStorage (up to 5 recent routes)
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY))   ?? [] } catch { return [] }
}

// Reads saved favorite route IDs from localStorage
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) ?? [] } catch { return [] }
}

// ─── Stop coordinate resolution ───────────────────────────────────────────────
//
// The NexTrip stops list endpoint only returns place_code + description — no lat/lon.
// To plot stops on the map we must hit the departures endpoint for each stop,
// which does return latitude and longitude inside the stops[] array.
//
async function fetchStops(routeId) {
  try {
    // Fetch the stop lists for both travel directions at the same time
    // API: GET https://svc.metrotransit.org/nextrip/stops/{routeId}/0
    //      GET https://svc.metrotransit.org/nextrip/stops/{routeId}/1
    // Returns: [{ place_code, description }, ...]  — NO coordinates
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

    // The same physical stop often appears in both directions — deduplicate by place_code
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

    // For each unique stop, call the departures endpoint which includes lat/lon
    // API: GET https://svc.metrotransit.org/nextrip/{routeId}/{dir}/{place_code}
    // Returns: { stops: [{ stop_id, latitude, longitude, description }], departures: [...] }
    const coordResults = await Promise.allSettled(
      unique.map(p =>
        fetch(`https://svc.metrotransit.org/nextrip/${routeId}/${p.dir}/${p.place_code}`)
          .then(r => r.json())
          .then(data => {
            const stop = data.stops?.[0]
            // Discard any stop that came back without coordinates
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

    // Filter out any stops that failed or had no coordinates
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
  // ── Theme ──────────────────────────────────────────────────────────────────

  // 'dark' or 'light' — controls body class and map tile URL
  const [theme, setTheme] = useState(loadTheme)

  // Whenever theme changes, update the body class and save to localStorage
  useEffect(() => {
    document.body.classList.toggle('light-mode', theme === 'light')
    try { localStorage.setItem(THEME_KEY, theme) } catch {}
  }, [theme])

  // Switches theme between dark and light
  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  // ── Sidebar / panel navigation ─────────────────────────────────────────────

  // Whether the desktop sidebar is expanded (true) or collapsed (false)
  const [sidebarOpen, setSidebarOpen]   = useState(true)

  // Which panel tab is currently active: 'map' | 'stops' | 'planner' | 'commute' | 'routes' | 'nearby' | 'status'
  const [activePanel, setActivePanel]   = useState('map')

  // ── Live Map data ──────────────────────────────────────────────────────────

  // The text the user has typed into the route number input
  const [routeInput, setRouteInput]     = useState('')

  // Array of bus objects currently on the map: [{ trip_id, latitude, longitude, route_id, direction, bearing, speed, ... }]
  const [buses, setBuses]               = useState([])

  // Array of stop marker objects for the active route: [{ stop_id, latitude, longitude, description, place_code }]
  const [stops, setStops]               = useState([])

  // The route number that is actively being tracked (null means nothing is tracked yet)
  const [activeRoute, setActiveRoute]   = useState(null)

  // Error message to show in the search panel (null means no error)
  const [error, setError]               = useState(null)

  // True while a bus fetch is in progress — disables the Track button and shows a spinner
  const [loading, setLoading]           = useState(false)

  // Seconds remaining until the next automatic bus refresh (counts down 30→0)
  const [countdown, setCountdown]       = useState(0)

  // Last 5 route numbers the user has searched, most recent first
  const [routeHistory, setRouteHistory] = useState(loadHistory)

  // Array of route ID strings the user has starred
  const [favorites,    setFavorites]    = useState(loadFavorites)

  // ── Bus detail panel ───────────────────────────────────────────────────────

  // The bus object the user clicked on, or null if no bus is selected
  const [selectedBus, setSelectedBus]   = useState(null)

  // ── Stop Finder panel ──────────────────────────────────────────────────────

  // The stop_id to load in the Stop Finder panel (set when user clicks a stop marker)
  const [selectedStopId, setSelectedStopId] = useState(null)

  // ── Map fly-to ─────────────────────────────────────────────────────────────

  // When set, the map flies to these coordinates — includes a `ts` timestamp so
  // re-selecting the same stop still triggers the fly animation
  const [mapCenter, setMapCenter] = useState(null)

  // ── Trip Planner ───────────────────────────────────────────────────────────

  // The A and B pin positions on the map: { from: {lat, lng, label}, to: {lat, lng, label} } or null
  const [tripPoints, setTripPoints] = useState(null)

  // ── Interval refs ──────────────────────────────────────────────────────────

  // Holds the setInterval ID for the bus refresh loop so we can cancel it
  const fetchIntervalRef     = useRef(null)

  // Holds the setInterval ID for the countdown timer so we can cancel it
  const countdownIntervalRef = useRef(null)

  // Resets the 30-second countdown display and starts ticking it down each second
  function startCountdown() {
    clearInterval(countdownIntervalRef.current)
    setCountdown(30)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1))
    }, 1000)
  }

  // Fetches live bus positions for a route and updates the buses state
  // API: GET https://svc.metrotransit.org/nextrip/vehicles/{routeNumber}
  // Returns: [{ trip_id, latitude, longitude, route_id, direction, terminal, bearing, speed, location_time }, ...]
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

  // When the bus list refreshes, keep the selected bus panel data in sync
  // (the bus's position and speed may have changed since it was first selected)
  useEffect(() => {
    if (!selectedBus || !buses.length) return
    const fresh = buses.find(b => b.trip_id === selectedBus.trip_id)
    if (fresh) setSelectedBus(fresh)
  }, [buses]) // eslint-disable-line react-hooks/exhaustive-deps

  // Adds or removes a route from the favorites list and saves it to localStorage
  function toggleFavorite(routeId) {
    const id = String(routeId)
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Prepends a route to history (deduplicating and capping at 5) and saves to localStorage
  function addToHistory(val) {
    setRouteHistory(prev => {
      const next = [val, ...prev.filter(r => String(r) !== String(val))].slice(0, 5)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Validates the route input and kicks off tracking — returns true on success,
  // false if validation fails (so the mobile search sheet knows whether to close)
  function handleSubmit() {
    const val = parseInt(routeInput, 10)
    if (!routeInput || isNaN(val) || val < 2 || val > 852) {
      setError('Enter a valid route number between 2 and 852.')
      return false
    }
    setError(null)
    setBuses([])
    addToHistory(val)
    setActiveRoute(val)
    return true
  }

  // Handles tapping a route chip from the recent-history list
  function handleHistorySelect(route) {
    setRouteInput(String(route))
    setError(null)
    setBuses([])
    addToHistory(route)
    setActiveRoute(route)
  }

  // Called when the user clicks a stop marker on the map or a stop card in Nearby Stops
  // Opens the Stop Finder panel and flies the map to the stop's location
  function handleStopSelect(stop) {
    setSelectedStopId(stop.stop_id)
    setActivePanel('stops')
    setSidebarOpen(true)
    if (stop.latitude != null && stop.longitude != null) {
      // Wrap coordinates in an object with a timestamp so re-selecting the same
      // stop still triggers the fly-to animation in MapController
      setMapCenter({ lat: stop.latitude, lng: stop.longitude, ts: Date.now() })
    }
  }

  // Receives updated trip planner pin coordinates from TripPlannerPanel and passes them to the map
  function handleTripUpdate(points) {
    setTripPoints(points)
  }

  // Switches to the Live Map panel and starts tracking the given route
  // Used by "Track Route" buttons in BusDetailPanel, TripPlannerPanel, etc.
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

  // Runs whenever activeRoute changes — starts the bus fetch loop and fetches stop markers once
  useEffect(() => {
    if (activeRoute === null) return

    // Cancel any existing interval before starting a new one
    clearInterval(fetchIntervalRef.current)
    setStops([])

    // Fetch buses immediately, then repeat every REFRESH_INTERVAL ms
    fetchBuses(activeRoute)
    fetchIntervalRef.current = setInterval(() => fetchBuses(activeRoute), REFRESH_INTERVAL)

    // Stops rarely change so we only fetch them once per route selection, not on the interval
    fetchStops(activeRoute).then(setStops)

    // Clean up both intervals when the component unmounts or the route changes
    return () => {
      clearInterval(fetchIntervalRef.current)
      clearInterval(countdownIntervalRef.current)
    }
  }, [activeRoute])

  // True when buses are being tracked and the last fetch succeeded — used to animate the Live badge
  const isLive = !!activeRoute && !loading && buses.length > 0

  // On mobile, the bottom sheet is open whenever any panel other than the map is selected
  const mobileSheetOpen = activePanel !== 'map'

  // Bundle all the Live Map search panel props into one object to avoid a long prop list
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
      {/* System-wide service alerts scrolling banner */}
      <AlertsBanner />

      {/* Top bar: logo, title, live indicator, theme toggle */}
      <Header isLive={isLive} theme={theme} onToggleTheme={toggleTheme} />

      <div className="app-body">
        {/* Desktop: dim the map when the sidebar is open on small screens */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile: dim the map when a panel bottom sheet is open */}
        {mobileSheetOpen && (
          <div
            className="mobile-sheet-backdrop"
            onClick={() => setActivePanel('map')}
          />
        )}

        {/* Left sidebar on desktop / bottom sheet on mobile — holds all 7 panels */}
        <Sidebar
          open={sidebarOpen}
          mobileSheetOpen={mobileSheetOpen}
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
          {/* Button that reopens the sidebar when it has been collapsed on desktop */}
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

          {/* The Leaflet map — renders buses, stop markers, and trip planner pins */}
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

          {/* Slide-in panel (desktop: right edge / mobile: bottom sheet) showing selected bus details */}
          <BusDetailPanel
            bus={selectedBus}
            onClose={() => setSelectedBus(null)}
            onTrackRoute={handleTrackRoute}
          />

          {/* Mobile-only: floating search button and compact route search sheet */}
          <MobileMapSearch
            routeInput={routeInput}
            onRouteChange={setRouteInput}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            activeRoute={activeRoute}
            busCount={buses.length}
            countdown={countdown}
            routeHistory={routeHistory}
            onHistorySelect={handleHistorySelect}
            activePanel={activePanel}
          />
        </div>
      </div>

      {/* Mobile-only: bottom tab bar replacing the sidebar nav */}
      <BottomNav
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        favorites={favorites}
      />

      {/* PWA update toast — appears when a new version is deployed */}
      <UpdateToast />
    </div>
  )
}

export default App
