/*
 * Header.jsx — Top bar shown on every screen.
 * Displays the Metro Transit logo, app title, a live indicator dot,
 * and a button to toggle between dark and light mode.
 * Receives all its state as props from App.jsx — no local state.
 */

// Renders a sun icon used to indicate "switch to light mode"
function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18
               M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06
               M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06" />
    </svg>
  )
}

// Renders a moon icon used to indicate "switch to dark mode"
function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 13.5A7.5 7.5 0 1 1 6.5 3a5.5 5.5 0 0 0 10.5 10.5z" />
    </svg>
  )
}

/*
 * Props:
 *   isLive         — true when bus data is actively being fetched; turns the dot green
 *   theme          — 'dark' | 'light'; controls which toggle icon to show
 *   onToggleTheme  — called when the user clicks the theme button
 */
function Header({ isLive, theme, onToggleTheme }) {
  return (
    <header className="header">
      {/* Metro Transit logo loaded from /public */}
      <img src="/Metro_Transit.png" alt="Metro Transit" className="header-logo" />
      <div className="header-divider" />
      <div className="header-text">
        <div className="header-title">Live Bus Tracker</div>
        <div className="header-subtitle">Twin Cities Metro Area</div>
      </div>

      {/* Pushes the badge and toggle to the right */}
      <div className="header-spacer" />

      {/* Pulsing dot — turns green (active class) when a live fetch is running */}
      <div className={`live-badge${isLive ? ' active' : ''}`}>
        <span className="live-dot" />
        Live
      </div>

      {/* Theme toggle — shows sun in dark mode, moon in light mode */}
      <button
        className="theme-toggle-btn"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  )
}

export default Header
