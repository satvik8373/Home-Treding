import { BrandLogo } from './BrandLogo'
export function StartupSplash() {
  return <main className="startup-screen" aria-label="Mavrix Trading">
    <div className="startup-content">
      <div className="startup-brand"><BrandLogo width={174} /></div>
      <p className="startup-message" role="status" aria-live="polite">Checking your session…</p>
    </div>
  </main>
}
