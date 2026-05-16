# Metro Transit Dashboard

A real-time bus tracking dashboard for the Twin Cities Metro Transit system, built with React and the NexTrip public API.

**[Live Demo →](https://metro-transit-dashboard.vercel.app)**

---

## Built With

- [React 18](https://react.dev) — UI framework
- [Vite](https://vitejs.dev) — build tooling and dev server
- [Leaflet.js](https://leafletjs.com) + [React-Leaflet v4](https://react-leaflet.js.org) — interactive map
- [Metro Transit NexTrip API](https://svc.metrotransit.org/nextrip) — live vehicle positions, departures, stops, and routes
- [CARTO Dark Matter](https://carto.com/basemaps) — dark tile layer

---

## Features

### Live Bus Tracking
Tracks every active bus on a chosen route in real time using GPS vehicle positions from the NexTrip API. Positions refresh automatically every 30 seconds with a countdown timer. The last 5 searched routes are saved as quick-access chips.

### Clickable Bus Markers
Clicking any bus on the map opens a detail panel showing:
- Route number, direction, and terminal
- Current speed (mph) and compass heading
- Time since last GPS ping (live-updating, e.g. "12 seconds ago")
- A one-click button to jump to that route's full map view

### Clickable Stop Markers
Every stop on the active route is plotted on the map. Clicking a stop automatically switches to the Stop Finder panel and loads live departures for that stop — no manual entry needed.

### Stop Finder
Search any Metro Transit stop by ID to see real-time departures. Each departure shows the route badge, destination, direction, scheduled or live arrival time, and a **Live** / **Sched** badge. Active service alerts for the stop are shown inline.

### My Commute
Save a home stop and a work stop. Departure times for both load automatically on every visit and can be refreshed with a single tap. Stop IDs are persisted to `localStorage` so the panel is ready the next time you open the app.

### Browse All Routes
A searchable list of all 143+ Metro Transit routes, grouped by agency (Metro Transit, Minnesota Valley, SouthWest Transit, etc.). Click any route to begin tracking it live on the map immediately.

### Mobile Responsive
The sidebar becomes a full-height drawer on small screens. The bus detail panel becomes a bottom sheet that slides up from the bottom of the viewport. All touch interactions are smooth.

---

## How It Works

The NexTrip API has a few non-obvious quirks that the app works around:

1. **Vehicle positions** — `GET /nextrip/vehicles/{route}` returns all active buses with `latitude`, `longitude`, `bearing`, and `speed`.

2. **Stop coordinates** — `GET /nextrip/stops/{route}/{direction}` returns only `place_code` and `description` — **no coordinates**. To plot stop markers, the app resolves coordinates by calling `GET /nextrip/{route}/{direction}/{place_code}` (the departures endpoint) for each unique stop, which includes `stops[0].latitude` and `stops[0].longitude` in its response. Both directions are fetched in parallel and deduplicated by `place_code` before resolution.

3. **Departures by stop** — `GET /nextrip/{stop_id}` returns departures, the stop's coordinates, description, and any active alerts — used by the Stop Finder and My Commute panels.

4. **All routes** — `GET /nextrip/routes` returns every route with `route_id`, `route_label`, and `agency_id`.

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Clone the repository
git clone https://github.com/mouhamadzabaneh/metro-transit-react.git
cd metro-transit-react

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`. No API key or environment variables are required — the NexTrip API is public.

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

---

## Screenshots

> _Screenshots coming soon._

| Live Map | Stop Finder | My Commute |
|----------|-------------|------------|
| _(map with bus markers)_ | _(departure list)_ | _(saved stops)_ |

---

## Future Improvements

- **Trip shape polylines** — draw the route path on the map using GTFS shape data
- **Departure alerts** — highlight buses that are running significantly late
- **Fare information** — show fare zone and pricing for each route
- **Accessibility** — ARIA live regions so departure updates are announced to screen readers
- **Offline support** — cache the routes list and last-known stop data with a service worker
- **Dark/light theme toggle** — make the dark theme optional
- **Keyboard navigation** — full keyboard control for the sidebar panels and map markers
- **Unit tests** — cover the API fetch logic and departure time formatting helpers

---

## Author

**Mouhamad Zabaneh** — [@mouhamadzabaneh](https://github.com/mouhamadzabaneh)
