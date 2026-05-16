import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const TWIN_CITIES = [44.96, -93.2]
const ZOOM = 11

// ── Bus icon ──────────────────────────────────────────────────────────────────

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

function makeBusIcon(selected = false) {
  return L.divIcon({
    html: `<div class="bus-marker${selected ? ' selected' : ''}">${busSvg}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

const defaultIcon  = makeBusIcon(false)
const selectedIcon = makeBusIcon(true)

// ── Stop icon ─────────────────────────────────────────────────────────────────

const stopIcon = L.divIcon({
  html: '<div class="stop-marker"></div>',
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// ── Map controller — flies to a stop when selected from outside the map ───────

function MapController({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], 16, { animate: true, duration: 0.8 })
  }, [center, map])
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

function MapView({ buses, stops = [], onBusSelect, selectedBusId, onStopSelect, mapCenter }) {
  return (
    <MapContainer
      center={TWIN_CITIES}
      zoom={ZOOM}
      className="map-container"
      zoomControl={true}
    >
      <MapController center={mapCenter} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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

      {/* Bus markers */}
      {buses.map(bus => (
        <Marker
          key={bus.trip_id}
          position={[bus.latitude, bus.longitude]}
          icon={bus.trip_id === selectedBusId ? selectedIcon : defaultIcon}
          eventHandlers={{ click: () => onBusSelect(bus) }}
        />
      ))}
    </MapContainer>
  )
}

export default MapView
