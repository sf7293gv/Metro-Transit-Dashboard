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

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 13.5A7.5 7.5 0 1 1 6.5 3a5.5 5.5 0 0 0 10.5 10.5z" />
    </svg>
  )
}

function Header({ isLive, theme, onToggleTheme }) {
  return (
    <header className="header">
      <img src="/Metro_Transit.png" alt="Metro Transit" className="header-logo" />
      <div className="header-divider" />
      <div className="header-text">
        <div className="header-title">Live Bus Tracker</div>
        <div className="header-subtitle">Twin Cities Metro Area</div>
      </div>
      <div className="header-spacer" />
      <div className={`live-badge${isLive ? ' active' : ''}`}>
        <span className="live-dot" />
        Live
      </div>
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
