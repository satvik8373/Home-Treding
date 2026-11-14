import './BrandLogo.css'

export function BrandLogo({ width = 160 }: { width?: number }) {
  const height = width * 96 / 300
  return <img className="brand-lockup" src="/brand/mavrix-logo.svg" alt="Mavrix Trading" width={width} height={height} style={{ display: 'block', width, height, maxWidth: '100%', objectFit: 'contain', borderRadius: 0 }} />
}
