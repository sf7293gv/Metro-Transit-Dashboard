import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const TWIN_CITIES = [44.96, -93.2]
const ZOOM = 11

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

const busIcon = L.divIcon({
  html: `<div class="bus-marker">${busSvg}</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -22],
})

function MapView({ buses }) {
  return (
    <MapContainer
      center={TWIN_CITIES}
      zoom={ZOOM}
      className="map-container"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      {buses.map(bus => (
        <Marker
          key={bus.trip_id}
          position={[bus.latitude, bus.longitude]}
          icon={busIcon}
        >
          <Popup>
            <div className="popup-route">Route {bus.route_id}</div>
            <div className="popup-row">Direction: <strong>{bus.direction_text || bus.direction || 'Unknown'}</strong></div>
            <div className="popup-row">Terminal: <strong>{bus.terminal || 'Unknown'}</strong></div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

export default MapView
