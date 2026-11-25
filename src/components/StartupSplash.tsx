import { BrandLogo } from './BrandLogo'

export function StartupSplash() {
  return (
    <main className="startup-screen" aria-label="Mavrix Trading">
      <div className="startup-content">
        <div className="startup-brand">
          <BrandLogo width={174} />
        </div>
        <div className="startup-trading-loader" role="status" aria-label="Loading workspace">
          <svg className="trading-loader-svg" viewBox="0 0 130 52" width="130" height="52" fill="none">
            <defs>
              <linearGradient id="splashAreaFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="splashLineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="55%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            {/* Subtle trading graph grid lines */}
            <line x1="6" y1="14" x2="124" y2="14" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="3 3" />
            <line x1="6" y1="28" x2="124" y2="28" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="3 3" />
            <line x1="6" y1="42" x2="124" y2="42" stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="3 3" />

            {/* Background depth / volume bars (Blue to Green growth) */}
            <rect x="16" y="28" width="3.5" height="14" rx="1.75" className="loader-bar loader-bar-1" />
            <rect x="34" y="22" width="3.5" height="20" rx="1.75" className="loader-bar loader-bar-2" />
            <rect x="52" y="26" width="3.5" height="16" rx="1.75" className="loader-bar loader-bar-3" />
            <rect x="70" y="16" width="3.5" height="26" rx="1.75" className="loader-bar loader-bar-4" />
            <rect x="88" y="12" width="3.5" height="30" rx="1.75" className="loader-bar loader-bar-5" />
            <rect x="106" y="8" width="3.5" height="34" rx="1.75" className="loader-bar loader-bar-6" />

            {/* Glowing gradient area fill under trading curve */}
            <path
              d="M 8 38 C 26 40, 38 24, 54 26 C 70 28, 78 15, 96 17 C 108 19, 116 9, 122 7 L 122 46 L 8 46 Z"
              fill="url(#splashAreaFill)"
              className="loader-area-fill"
            />

            {/* Upward trending trading graph line (Blue to Pure Green) */}
            <path
              d="M 8 38 C 26 40, 38 24, 54 26 C 70 28, 78 15, 96 17 C 108 19, 116 9, 122 7"
              stroke="url(#splashLineStroke)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="loader-curve-line"
            />

            {/* Glowing pure green live beacon price dot & radar ping */}
            <circle cx="122" cy="7" r="3.2" fill="#10b981" className="loader-beacon-core" />
            <circle cx="122" cy="7" r="3.2" fill="none" stroke="#10b981" strokeWidth="1.5" className="loader-beacon-radar" />
          </svg>
        </div>
      </div>
    </main>
  )
}
