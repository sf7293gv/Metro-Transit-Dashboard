/*
 * MapView.jsx — Full-screen interactive map powered by React-Leaflet.
 * Renders bus markers, stop markers (dots), and trip-planner A/B pins.
 * Two internal helper components (MapController, TripController) use the
 * useMap() hook to fly/fit the view without re-mounting the MapContainer.
 * Tile URL is swapped via a key prop to force a re-mount on theme change.
 */

import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Default map center — downtown Twin Cities area
const TWIN_CITIES = [44.96, -93.2]
const ZOOM = 11

// CartoCDN dark and light tile URLs — swapped on theme change
const TILE_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

// ── Bus icon ──────────────────────────────────────────────────────────────────

// SVG bus graphic embedded in the div icon; drawn at 20×16 inside a 36×36 container
const busSvg = `
  <svg viewBox="0 0 22 18" width="20" height="16" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="0" width="20" height="12" rx="2.5" fill="white"/>
    <rect x="3"  y="2" width="4" height="4" rx="1" fill="#0053A0"/>
    <rect x="9"  y="2" width="4" height="4" rx="1" fill="#0053A0"/>
    <rect x="15" y="2" width="4" height="4" rx="1" fill="#0053A0"/>
    <circle cx="6"  cy="15" r="3" fill="white"/>
    <circle cx="16" cy="15" r="3" fill="white"/>
    <circle cx="6"  cy="15" r="1.2" fill="#0053A0"/>
    <circle cx="16" cy="15" r="1.2" fill="#0053A0"/>
  </svg>
`

// Returns a Leaflet divIcon for a bus marker; adds 'selected' class when clicked
function makeBusIcon(selected = false) {
  return L.divIcon({
    html: `<div class="bus-marker${selected ? ' selected' : ''}">${busSvg}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

// Pre-built icons; re-using the same object avoids per-render allocations
const defaultIcon  = makeBusIcon(false)
const selectedIcon = makeBusIcon(true)

// ── Stop icon ─────────────────────────────────────────────────────────────────

// Small blue dot used for every stop on the active route
const stopIcon = L.divIcon({
  html: '<div class="stop-marker"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// ── Trip planner pin icons ─────────────────────────────────────────────────────

// Creates a teardrop map pin with a letter label (A or B)
function makeTripPin(color, letter) {
  const svg = `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 7.732 14 22 14 22S28 21.732 28 14C28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="7" fill="rgba(0,0,0,0.18)"/>
    <text x="14" y="18.5" text-anchor="middle" fill="white" font-size="11" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${letter}</text>
  </svg>`
  return L.divIcon({
    html: `<div style="line-height:0;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5))">${svg}</div>`,
    className: '',
    iconSize:   [28, 36],
    iconAnchor: [14, 36],  // anchor at the bottom tip of the pin
  })
}

// Blue "A" pin for the trip origin, red "B" pin for the destination
const fromPinIcon = makeTripPin('#0053A0', 'A')
const toPinIcon   = makeTripPin('#e05a5a', 'B')

// ── Map controller — flies to a stop when selected from outside the map ───────

/*
 * Renders nothing; reacts to the center prop changing and animates the map
 * to that coordinate. Used when a stop marker in a panel is clicked.
 */
function MapController({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], 16, { animate: true, duration: 0.8 })
  }, [center, map])
  return null
}

// ── Trip controller — fits both trip points in view ───────────────────────────

/*
 * Renders nothing; when both from and to points are provided it fits the map
 * bounds to show both pins with padding.
 */
function TripController({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points?.from || !points?.to) return
    const bounds = L.latLngBounds(
      [points.from.lat, points.from.lng],
      [points.to.lat,   points.to.lng]
    )
    map.fitBounds(bounds.pad(0.35), { animate: true, duration: 0.8 })
  }, [points, map])
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

/*
 * Props:
 *   buses        — array of bus objects from the NexTrip vehicles endpoint
 *   stops        — array of stop objects with latitude/longitude for the active route
 *   onBusSelect  — called with the bus object when a bus marker is clicked
 *   selectedBusId — trip_id of the currently selected bus (highlighted icon)
 *   onStopSelect — called with the stop object when a stop dot is clicked
 *   mapCenter    — {lat, lng} to fly to (usually a selected stop); null = no fly
 *   tripPoints   — {from: {lat,lng,label}, to: {lat,lng,label}} for the trip planner
 *   theme        — 'dark' | 'light'; switches the tile layer
 */
function MapView({ buses, stops = [], onBusSelect, selectedBusId, onStopSelect, mapCenter, tripPoints, theme }) {
  // key={tileUrl} forces TileLayer to fully remount when the theme changes,
  // which is necessary because Leaflet doesn't support dynamic URL swapping
  const tileUrl = theme === 'light' ? TILE_LIGHT : TILE_DARK
  return (
    <MapContainer
      center={TWIN_CITIES}
      zoom={ZOOM}
      className="map-container"
      zoomControl={true}
    >
      {/* Fly-to controller — responds to stop selections from panels */}
      <MapController center={mapCenter} />
      {/* Fit-bounds controller — responds to trip planner results */}
      <TripController points={tripPoints} />

      {/* Map tiles — CartoCDN dark or light depending on theme */}
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={tileUrl}
        maxZoom={19}
      />

      {/* Stop markers — rendered below buses so buses appear on top */}
      {stops.map(stop => (
        <Marker
          key={stop.stop_id}
          position={[stop.latitude, stop.longitude]}
          icon={stopIcon}
          zIndexOffset={-100}
          eventHandlers={{ click: () => onStopSelect?.(stop) }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1} className="stop-tooltip">
            {stop.description}
          </Tooltip>
        </Marker>
      ))}

      {/* Bus markers — selected bus gets a highlighted icon */}
      {buses.map(bus => (
        <Marker
          key={bus.trip_id}
          position={[bus.latitude, bus.longitude]}
          icon={bus.trip_id === selectedBusId ? selectedIcon : defaultIcon}
          eventHandlers={{ click: () => onBusSelect(bus) }}
        />
      ))}

      {/* Trip planner origin pin (blue A) */}
      {tripPoints?.from && (
        <Marker
          position={[tripPoints.from.lat, tripPoints.from.lng]}
          icon={fromPinIcon}
          zIndexOffset={600}
        >
          <Tooltip direction="top" offset={[0, -38]} opacity={1} className="stop-tooltip">
            From: {tripPoints.from.label}
          </Tooltip>
        </Marker>
      )}
      {/* Trip planner destination pin (red B) */}
      {tripPoints?.to && (
        <Marker
          position={[tripPoints.to.lat, tripPoints.to.lng]}
          icon={toPinIcon}
          zIndexOffset={600}
        >
          <Tooltip direction="top" offset={[0, -38]} opacity={1} className="stop-tooltip">
            To: {tripPoints.to.label}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  )
}

export default MapView
