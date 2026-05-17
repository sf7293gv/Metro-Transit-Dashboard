/*
 * Home.jsx — Placeholder page component.
 * Originally intended as the route for "/", but the app no longer uses a router.
 * App.jsx renders MapView directly inside the layout; this file is kept for
 * potential future routing but is not currently used.
 */

import MapView from '../components/MapView.jsx'

// Renders the full-screen map — no additional layout or state
function Home() {
  return <MapView />
}

export default Home
