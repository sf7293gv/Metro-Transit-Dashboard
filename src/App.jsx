import { useState, useEffect, useRef } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import MapView from './components/MapView.jsx'
import './index.css'

const REFRESH_INTERVAL = 30000
const HISTORY_KEY = 'mt-route-history'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [] } catch { return [] }
}

function App() {
  // Sidebar navigation
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [activePanel, setActivePanel]   = useState('map')

  // Live Map panel state (shared with MapView)
  const [routeInput, setRouteInput]     = useState('')
  const [buses, setBuses]               = useState([])
  const [activeRoute, setActiveRoute]   = useState(null)
  const [error, setError]               = useState(null)
  const [loading, setLoading]           = useState(false)
  const [countdown, setCountdown]       = useState(0)
  const [routeHistory, setRouteHistory] = useState(loadHistory)

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

  // Called by Routes panel — bypasses manual-input validation
  function handleTrackRoute(routeId) {
    setRouteInput(String(routeId))
    setError(null)
    setBuses([])
    addToHistory(routeId)
    setActiveRoute(routeId)
    setActivePanel('map')
    setSidebarOpen(true)
  }

  useEffect(() => {
    if (activeRoute === null) return
    clearInterval(fetchIntervalRef.current)
    fetchBuses(activeRoute)
    fetchIntervalRef.current = setInterval(() => fetchBuses(activeRoute), REFRESH_INTERVAL)
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
  }

  return (
    <div className="app">
      <Header isLive={isLive} />
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
        />
        <div className="map-area">
          {!sidebarOpen && (
            <button
              className="sidebar-open-btn"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="M8 4l6 6-6 6" />
              </svg>
            </button>
          )}
          <MapView buses={buses} />
        </div>
      </div>
    </div>
  )
}

export default App
