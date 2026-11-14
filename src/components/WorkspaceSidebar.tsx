import { BrandLogo } from './BrandLogo'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChartNoAxesCombined, ChevronRight, FlaskConical, LayoutDashboard, Link2, Settings2, ShieldCheck, UserRound, X } from 'lucide-react'

import { workspacePages, type WorkspaceView } from '../lib/workspace'
const icons = { market: LayoutDashboard, analytics: ChartNoAxesCombined, backtest: FlaskConical, settings: Settings2, audit: ShieldCheck }

export function WorkspaceSidebar({ view, open, onClose, onNavigate, onBroker, onRules, onProfile, accountName }: {
  view: WorkspaceView; open: boolean; onClose: () => void; onNavigate: (view: WorkspaceView) => void;
  onBroker: () => void; onRules: () => void; onProfile?: () => void; accountName?: string;
}) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 960px)').matches)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mobile || !open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const background = [...document.querySelectorAll<HTMLElement>('.workspace-shell > .topbar, #workspace-content')]
    background.forEach(node => { node.inert = true })
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') ?? [])]
      const first = nodes[0], last = nodes.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { background.forEach(node => { node.inert = false }); document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previous?.focus() }
  }, [mobile, open, onClose])
  const select = (callback: () => void) => { onClose(); callback() }
  return <>
    {mobile && open && <button className="sidebar-dismiss" tabIndex={-1} aria-label="Close navigation" onClick={onClose} />}
    <aside id="workspace-sidebar" ref={ref} className="workspace-sidebar" hidden={mobile && !open} role={mobile ? 'dialog' : 'complementary'} aria-modal={mobile ? true : undefined} aria-label="Workspace navigation">
      <div className="sidebar-brand"><a className="wordmark" href="#market" onClick={() => select(() => onNavigate('market'))}><BrandLogo width={160} /></a>{mobile && <button className="icon-button" aria-label="Close navigation" onClick={onClose}><X size={19} /></button>}</div>
      <span className="sidebar-label">WORKSPACE</span>
      <nav aria-label="Main navigation">{(Object.keys(workspacePages) as WorkspaceView[]).map(key => {
        const Icon = icons[key]
        return <button key={key} className={`sidebar-item ${view === key ? 'selected' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={() => select(() => onNavigate(key))}><Icon size={18} /><span>{workspacePages[key].title}</span></button>
      })}</nav>
      <div className="sidebar-utilities"><span className="sidebar-label">ACCOUNT & HELP</span><button className="sidebar-item" onClick={() => select(onBroker)}><Link2 size={18} />Broker connection</button><button className="sidebar-item" onClick={() => select(onRules)}><BookOpen size={18} />Strategy rules</button></div>
      {onProfile && <button className="sidebar-account" onClick={() => select(onProfile)}><span className="account-avatar"><UserRound size={19} /></span><span><strong>{accountName || 'Your account'}</strong><small>Profile & sign out</small></span><ChevronRight size={16} /></button>}
    </aside>
  </>
}
