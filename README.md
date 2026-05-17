# Metro Transit Dashboard

Real-time bus tracker for the Twin Cities metro area.

🔗 **Live Demo:** https://metro-transit-dashboard.vercel.app &nbsp;|&nbsp; 📦 **GitHub:** https://github.com/sf7293gv/Metro-Transit-Dashboard

---

## What it does

Metro Transit Dashboard shows every bus on any Metro Transit route moving live on an interactive map, refreshing every 30 seconds. You can look up stop departures by name or ID, plan a trip between two addresses, and save your commute stops for one-tap departure checks. It runs entirely on the free public NexTrip API — no API key required.

## Features

🗺️ **Live Map** — Real-time bus positions with 30s auto-refresh and countdown timer  
🚌 **Bus Details** — Speed, heading, GPS age, and next 3 upcoming stops per bus  
🛑 **Stop Markers** — Every stop on the active route plotted; tap to load departures  
🔍 **Stop Finder** — Search by stop name or ID with suggestion dropdown and live departures  
📍 **Nearby Stops** — GPS-based search for stops within ½ mile, sorted by distance  
🗓️ **Trip Planner** — Enter any two addresses, finds nearest stops and shows departure options  
⭐ **Favorite Routes** — Star routes to pin them; persists in localStorage  
🏠 **My Commute** — Save home and work stops for one-tap departure checks  
📋 **Routes Browser** — Searchable list of all 143+ routes grouped by type  
🚨 **Service Status** — Live alerts and closed-stop notices across major Twin Cities stops  
⚠️ **Alerts Banner** — Auto-rotating banner for active system-wide alerts  
🌓 **Dark / Light Mode** — Theme toggle with smooth transition and localStorage persistence  
📱 **Mobile Optimized** — Bottom nav, bottom-sheet panels, floating route search, 44px tap targets  

## Built With

React · Vite · Leaflet.js · React-Leaflet · Workbox · Metro Transit NexTrip API · OpenStreetMap Nominatim · Vercel

## Run Locally

```bash
git clone https://github.com/sf7293gv/Metro-Transit-Dashboard.git
cd Metro-Transit-Dashboard
npm install && npm run dev
```

## PWA — Install on iPhone or Android

Metro Transit Dashboard is a Progressive Web App. On **iPhone**, open the site in Safari, tap the Share button, and choose "Add to Home Screen." On **Android**, open it in Chrome and tap "Install app" from the browser menu. Once installed it launches full-screen, loads offline, and prompts you to refresh when a new version is deployed.
