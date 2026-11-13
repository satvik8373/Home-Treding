import { useState } from 'react'
import { UserRound, LogOut, Link2, Settings2, ShieldCheck } from 'lucide-react'
import { useAccount } from '../lib/account'
import type { AppState, BrokerStatus } from '../../shared/model'
import { Dialog } from './Dialog'
import { dateTime } from '../lib/format'

export function AccountProfile({ broker, persistence, onBroker, onSettings, open: controlledOpen, onOpenChange, hideTrigger }: { open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean;  broker?: BrokerStatus; persistence?: AppState['persistence']; onBroker: () => void; onSettings: () => void }) {
  const account = useAccount(), [internalOpen, setInternalOpen] = useState(false), [error, setError] = useState('')
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  if (!account) return null
  const user = account.user
  const linked = broker?.linked ?? (broker?.account ? { account: broker.account, name: broker.name } : null)
  return <>{!hideTrigger && <button className="profile-button" aria-label="Open account profile" onClick={() => setOpen(true)}><UserRound size={17} /><span>Profile</span></button>}
    {open && <Dialog titleId="profile-title" onClose={() => setOpen(false)}>
      <div className="profile-heading"><div className="profile-avatar"><UserRound size={24} /></div><div><h2 id="profile-title">{user?.name || 'Your account'}</h2><p>{user?.email || 'Private owner workspace'}</p></div></div>
      <dl className="profile-details"><div><dt>Sign-in method</dt><dd>{user?.kind === 'google' ? 'Google' : 'Owner password'}</dd></div><div><dt>Workspace</dt><dd>{user?.kind === 'google' ? 'Personal trading account' : 'Original owner account'}</dd></div><div><dt>mStock connection</dt><dd>{broker?.connected ? 'Connected' : broker?.connection?.phase === 'expired' ? 'Session expired — verify again' : broker?.connection?.phase === 'retrying' || broker?.connection?.phase === 'checking' ? 'Restoring saved connection' : 'Not connected'}</dd></div>{linked && <><div><dt>Linked broker account</dt><dd>{linked.account}</dd></div><div><dt>Account holder</dt><dd>{linked.name}</dd></div></>}{user?.kind === 'google' && user.rememberedUntil && <div><dt>Google sign-in remembered until</dt><dd>{dateTime(user.rememberedUntil)} IST</dd></div>}{persistence && <div><dt>Firestore data sync</dt><dd>{persistence.firestore === 'synced' ? 'Saved' : persistence.firestore === 'pending' ? 'Saving latest changes' : persistence.firestore === 'unavailable' ? 'Retrying · engine data retained' : 'Not configured'}</dd></div>}{broker?.expiresAt && <div><dt>mStock session expires</dt><dd>{dateTime(broker.expiresAt)} IST</dd></div>}{user?.expiresAt && <div><dt>{user.kind === 'google' ? 'Access token auto-refresh' : 'Sign-in valid until'}</dt><dd>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(user.expiresAt)} IST</dd></div>}</dl>
      <div className="profile-actions"><button className="button secondary" onClick={() => { setOpen(false); onBroker() }}><Link2 size={16} />Broker & execution setup</button><button className="button secondary" onClick={() => { setOpen(false); onSettings() }}><Settings2 size={16} />Strategy settings</button></div>
      <p className="profile-privacy"><ShieldCheck size={15} />Broker credentials stay on the execution server.</p>
      <div className="profile-logout"><p>Logging out ends dashboard access. A running strategy continues on the server.</p><button className="button secondary" disabled={account.busy} onClick={async () => { setError(''); try { await account.logout() } catch { setError('Could not log out. Please try again.') } }}><LogOut size={16} />{account.busy ? 'Logging out…' : 'Log out'}</button></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </Dialog>}
  </>
}
