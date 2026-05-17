/*
 * main.jsx — Entry point for the React app.
 * Mounts the top-level <App> component into the #root div in index.html.
 * Everything in the app flows down from here.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Attach the React app to the <div id="root"> in index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode runs extra checks in development to catch common mistakes
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
