import { useState } from 'react'
import { UserRound, LogOut, Link2, Settings2, ShieldCheck } from 'lucide-react'
import { useAccount } from '../lib/account'
import type { BrokerStatus } from '../../shared/model'
import { Dialog } from './Dialog'

export function AccountProfile({ broker, onBroker, onSettings }: { broker?: BrokerStatus; onBroker: () => void; onSettings: () => void }) {
  const account = useAccount(), [open, setOpen] = useState(false), [error, setError] = useState('')
  if (!account) return null
  const user = account.user
  return <><button className="profile-button" aria-label="Open account profile" onClick={() => setOpen(true)}><UserRound size={17} /><span>Profile</span></button>
    {open && <Dialog titleId="profile-title" onClose={() => setOpen(false)}>
      <div className="profile-heading"><div className="profile-avatar"><UserRound size={24} /></div><div><h2 id="profile-title">{user?.name || 'Your account'}</h2><p>{user?.email || 'Private owner workspace'}</p></div></div>
      <dl className="profile-details"><div><dt>Sign-in method</dt><dd>{user?.kind === 'google' ? 'Google' : 'Owner password'}</dd></div><div><dt>Workspace</dt><dd>{user?.kind === 'google' ? 'Personal trading account' : 'Original owner account'}</dd></div><div><dt>mStock connection</dt><dd>{broker?.connected ? 'Connected' : 'Not connected'}</dd></div>{broker?.connected && <><div><dt>Broker account</dt><dd>{broker.account}</dd></div><div><dt>Account holder</dt><dd>{broker.name}</dd></div></>}{user?.expiresAt && <div><dt>Sign-in valid until</dt><dd>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(user.expiresAt)} IST</dd></div>}</dl>
      <div className="profile-actions"><button className="button secondary" onClick={() => { setOpen(false); onBroker() }}><Link2 size={16} />Broker & execution setup</button><button className="button secondary" onClick={() => { setOpen(false); onSettings() }}><Settings2 size={16} />Strategy settings & account audit</button></div>
      <p className="profile-privacy"><ShieldCheck size={15} />Broker credentials stay on the execution server.</p>
      <div className="profile-logout"><p>Logging out ends dashboard access. A running strategy continues on the server.</p><button className="button secondary" disabled={account.busy} onClick={async () => { setError(''); try { await account.logout() } catch { setError('Could not log out. Please try again.') } }}><LogOut size={16} />{account.busy ? 'Logging out…' : 'Log out'}</button></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </Dialog>}
  </>
}
