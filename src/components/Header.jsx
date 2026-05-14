function Header({ isLive }) {
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
    </header>
  )
}

export default Header
