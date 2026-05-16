# Metro Transit Dashboard

A real-time transit dashboard for the Twin Cities metro area.

🔗 **Live Demo:** https://metro-transit-dashboard.vercel.app

## What it does

Track any Metro Transit bus route live on an interactive dark map. Click bus markers to see speed, heading, and upcoming stops. Search stops by ID for real-time departures, save your commute stops, and browse all 143+ routes — all powered by the public NexTrip API with no API key required.

## Features

🗺️ **Live Map** — Real-time bus positions with auto-refresh every 30 seconds and a countdown timer  
🚌 **Bus Details** — Click any bus for speed, heading, GPS ping age, and the next 3 upcoming stops with Live/Sched badges  
🛑 **Stop Markers** — Every stop on the active route plotted on the map; click to load departures instantly  
🔍 **Stop Finder** — Look up any stop by ID for live departures, service alerts, and Live/Scheduled badges  
📍 **Nearby Stops** — Uses your GPS to find all stops within ½ mile, sorted by distance with next departures  
⭐ **Favorite Routes** — Star routes to pin them at the top of the list; persists across sessions  
🏠 **My Commute** — Save a home and work stop for one-tap departure checks  
📋 **Routes Browser** — Searchable list of all routes grouped by agency  
🚨 **Service Status** — Live service alerts and closed-stop notices across major Twin Cities stops  
⚠️ **Alerts Banner** — Dismissible top-of-page banner for active alerts with auto-rotating carousel  

## Built With

React · Vite · Leaflet.js · React-Leaflet · Metro Transit NexTrip API

## Run Locally

```bash
git clone https://github.com/mouhamadzabaneh/metro-transit-react.git
cd metro-transit-react
npm install && npm run dev
```
