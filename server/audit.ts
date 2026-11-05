import type { AccountDiagnostics } from './diagnostics.ts'
import type { AppState } from '../shared/model.ts'
import type { BrokerDiagnostics } from '../shared/diagnostics.ts'
import { explainLeg, sessionMoney } from '../shared/transparency.ts'
import { settingsFor } from '../shared/settings.ts'

/** Auditing receives snapshots and read-only diagnostics, never order/control APIs. */
export class AccountAudit {
  constructor(private diagnostics: Pick<AccountDiagnostics, 'read'>, private context: () => AppState) {}
  async read() {
    let broker: BrokerDiagnostics | null = null, brokerError: string | null = null
    if (this.context().broker.connected) {
      try { broker = await this.diagnostics.read() } catch { brokerError = 'Broker reads are unavailable. Refresh to verify cash and order status.' }
    }
    const state = this.context()
    if (broker && broker.account !== state.broker.account) { broker = null; brokerError = 'Account changed during the audit. Refresh again.' }
    return { account: state.broker.account, checkedAt: state.serverTime, broker, brokerError, session: state.session, savedSettings: state.savedSettings,
      effectiveSettings: settingsFor(state.session), money: sessionMoney(state.session, state.marks, state.serverTime),
      legs: (['CE', 'PE'] as const).map(side => explainLeg(state.session, side, state.marks, state.serverTime)) }
  }
}
export type AuditReport = Awaited<ReturnType<AccountAudit['read']>>
