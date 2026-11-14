export function StartupSplash() {
  return <main className="startup-screen" aria-label="Mavrix Trading">
    <div className="startup-content">
      <div className="startup-brand"><img src="/mavrix-icon.jpg" alt="" width="44" height="44" /><div><h1>MAVRIX</h1><span>TRADING</span></div></div>
      <p className="startup-message" role="status" aria-live="polite">Checking your session…</p>
    </div>
  </main>
}
