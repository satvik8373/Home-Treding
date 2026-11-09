import { directionOf, signFor, entryTransaction, exitTransaction, isBeyondEntry } from '../shared/strategy.ts'
import type { StrategyDirection } from '../shared/strategy.ts'
import { randomUUID } from 'node:crypto'
import type { Activity, AppState, BrokerConnection, Candle, Mark, Mode, OrderAudit, OrderIntent, Reason, Side, TradingSession } from '../shared/model.ts'
import { RULES } from '../shared/model.ts'
import { freshMark } from '../shared/market.ts'
import { BrokerError, INDEX_TOKEN, type TradingBroker, type MStock } from './broker.ts'
import { applyFill, candleSignal, levels, observeReentry, orderQuantity, priceExitSignal, validCandle } from './strategy.ts'
import { completedBoundary, isTradingDay, istDate, istTime } from './time.ts'
import type { Store } from './store.ts'
import type { MarketFeed } from './feed.ts'
import { DEFAULT_SETTINGS, SELL_DEFAULT_SETTINGS, sameSettings, settingsFor, validateSettings } from '../shared/settings.ts'
import type { StrategySettings } from '../shared/settings.ts'
import { rejectionSummary } from './orderIdentity.ts'

type Feed = Pick<MarketFeed, 'status' | 'lastTickAt' | 'connect' | 'close' | 'onMark' | 'onChange'>
type Repository = Pick<Store, 'session' | 'loadSession' | 'saveSession' | 'broker' | 'saveBroker'> & Partial<Pick<Store, 'get' | 'put' | 'persist'>>
const SIDES: Side[] = ['CE', 'PE']
const active = (s: TradingSession | null) => !!s && ['armed', 'preparing', 'running', 'stopping'].includes(s.status)
export const hasExposure = (s: TradingSession | null) => !!s && (!!s.pending || SIDES.some(side => !!s.legs[side]?.position))
class PositionReadError extends Error {}

export class Controller {
  authorizeBroker?: (account: string, freshlyVerified?: boolean) => void
  execution?: { kind: 'hosted-paper'; liveExecution: false; reason: string }
  session: TradingSession | null
  marks: Record<string, Mark> = {}
  busy = false
  onChange: () => void = () => {}
  private connection: BrokerConnection = { phase: 'idle', message: 'Connect your mStock account.', checkedAt: null, nextRetryAt: null }
  private connectionAttempt = 0
  private connectionGeneration = 0
  private restoring = false
  private verified = false
  private stopRequested = false
  private queue: Promise<unknown> = Promise.resolve()
  private auth: { id: string; apiKey: string; username: string; expires: number; attempts: number; method?: 'totp'; expectedAccount?: string; verifiedCredentials?: import('./store.ts').SavedBroker } | null = null
  private lastQuotes = 0
  private quotesInFlight = false
  private lastPositionCheck = 0
  private lastHistoryAttempt = 0
  private historyInFlight = false
  private lastPendingAttempt = 0
  private backoff: Partial<Record<Side, number>> = {}
  private retryAt = 0
  private pumpTask: Promise<void> | null = null
  private savedSession = ''
  private suspended = false
  private sellPreferences: StrategySettings = structuredClone(SELL_DEFAULT_SETTINGS)
  private preferences: StrategySettings = structuredClone(DEFAULT_SETTINGS)
  constructor(public broker: TradingBroker & Partial<Pick<MStock, 'login' | 'verify' | 'verifyAccount' | 'logout' | 'onAuthFailure'>>,
    private store: Repository, public feed: Feed, private now = Date.now) {
    broker.onAuthFailure = () => {
      this.verified = false; this.feed.close()
      this.connection = { phase: 'rejected', message: 'mStock rejected the saved session or API key. Sign in again.', checkedAt: this.now(), nextRetryAt: null }
      this.onChange()
    }
    this.session = store.session()
    const savedSettings = store.get?.('strategy:settings')
    if (savedSettings) this.preferences = validateSettings(savedSettings)
    const savedSell = store.get?.('strategy:settings:sell')
    if (savedSell) this.sellPreferences = validateSettings({ ...(savedSell as object), direction: 'sell' })
    else { this.sellPreferences = { ...structuredClone(this.preferences), direction: 'sell' }; store.put?.('strategy:settings:sell', this.sellPreferences) }
    feed.onMark = mark => {
      if (this.suspended) return
      if (!freshMark(mark, this.now())) return
      const previous = this.marks[mark.token]
      if (previous && (mark.receivedAt < previous.receivedAt
        || mark.exchangeAt != null && previous.exchangeAt != null && mark.exchangeAt < previous.exchangeAt)) return
      this.marks[mark.token] = mark
      // Preserve a protective stop or target touch even if the next price arrives while another
      // broker request is in flight. Entry decisions still require candles.
      if (this.session?.status === 'running' || this.session?.status === 'blocked' && hasExposure(this.session)) {
        for (const side of SIDES) {
          const leg = this.session.legs[side]
          if (leg?.contract.token === mark.token) {
            const exit = priceExitSignal(leg, mark.price, settingsFor(this.session), this.now())
            if (exit && (!leg.exitReason || exit === 'STOP_LOSS' && ['TARGET_1', 'TARGET_2'].includes(leg.exitReason))) {
              leg.exitReason = exit; this.save()
            }
          }
        }
      }
      this.onChange(); void this.pump()
    }
    feed.onChange = () => this.onChange()
  }
  connected(): boolean { return this.verified && !!this.broker.credentials && this.broker.credentials.expiresAt > this.now() }
  strategySettings(direction: StrategyDirection = 'buy'): StrategySettings { return structuredClone(direction === 'sell' ? this.sellPreferences : this.preferences) }
  saveStrategySettings(input: unknown): StrategySettings {
    const settings = validateSettings(input)
    if (!this.store.put) throw new Error('Persistent settings storage is unavailable.')
    this.store.put(directionOf(settings) === 'sell' ? 'strategy:settings:sell' : 'strategy:settings', settings)
    if (directionOf(settings) === 'sell') this.sellPreferences = settings; else this.preferences = settings
    this.onChange(); return structuredClone(settings)
  }
  private connectionSnapshot(): BrokerConnection {
    if (this.broker.credentials && this.broker.credentials.expiresAt <= this.now()) return { phase: 'expired', message: 'Your mStock session has expired. Sign in again with a fresh OTP or authenticator code.', checkedAt: this.connection.checkedAt, nextRetryAt: null }
    return { ...this.connection }
  }
  private retryBrokerCheck() {
    this.verified = false
    const delay = Math.min(60_000, 5000 * 2 ** Math.min(this.connectionAttempt++, 4))
    this.connection = { phase: 'retrying', message: 'Broker verification is temporarily unavailable. Your saved token is retained; retrying automatically.', checkedAt: this.now(), nextRetryAt: this.now() + delay }
    this.onChange()
  }
  snapshot(csrf = ''): AppState {
    const credentials = this.broker.credentials
    return { csrf, runtime: this.execution, strategyProfiles: { buy: this.strategySettings('buy'), sell: this.strategySettings('sell') }, savedSettings: this.strategySettings(), serverTime: this.now(), busy: this.busy, broker: { linked: credentials ? { account: credentials.account, name: credentials.name, totpRenewal: credentials.authMethod === 'totp' } : null, verificationMethod: credentials?.authMethod ?? null, connection: this.connectionSnapshot(), connected: this.connected(),
      account: this.connected() ? credentials!.account : null, name: this.connected() ? credentials!.name : null,
      expiresAt: credentials?.expiresAt ?? null, feed: this.feed.status, lastTickAt: this.feed.lastTickAt },
      session: this.session, marks: this.marks }
  }
  private save(): void {
    if (this.session) {
      const serialized = JSON.stringify(this.session)
      // Quotes are transient. Avoid a synchronous FULL SQLite transaction for
      // every tick when no durable trading state has changed.
      if (serialized !== this.savedSession) {
        this.store.saveSession(this.session)
        this.savedSession = serialized // only suppress writes after a successful commit
      }
    }
    this.onChange()
  }
  private note(message: string, level: Activity['level'] = 'info'): void {
    if (!this.session) return
    this.session.message = message
    if (this.session.activity.at(-1)?.message !== message) this.session.activity.push({ at: this.now(), level, message })
    this.session.activity = this.session.activity.slice(-150)
    this.save()
  }
  private audit(intent: OrderIntent, change: Partial<OrderAudit>): void {
    if (!this.session) return
    this.session.orderAudit ??= []
    let entry = this.session.orderAudit.find(item => item.id === intent.id)
    if (!entry) {
      entry = { id: intent.id, tag: intent.tag, orderId: intent.orderId, side: intent.side, symbol: intent.symbol, transaction: intent.transaction, quantity: intent.quantity,
        reason: intent.reason, submittedAt: intent.submittedAt, updatedAt: this.now(), mode: this.session.mode, status: 'unknown', filled: null, average: null, detail: '' }
      this.session.orderAudit.push(entry)
    }
    Object.assign(entry, change, { updatedAt: this.now(), orderId: intent.orderId ?? change.orderId ?? entry.orderId })
    entry.events ??= []
    if (entry.events.at(-1)?.status !== entry.status || entry.events.at(-1)?.detail !== entry.detail) entry.events.push({ at: this.now(), status: entry.status, detail: entry.detail })
    this.save()
  }
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.catch(() => {}).then(async () => {
      this.busy = true; this.onChange()
      try { return await work() } finally {
        try { await this.store.persist?.() } finally { this.busy = false; this.onChange() }
      }
    })
    this.queue = result
    return result
  }
  async restore(): Promise<void> {
    if (this.restoring) return
    const saved = this.broker.credentials ?? this.store.broker(), generation = this.connectionGeneration
    if (saved) this.broker.credentials = saved
    if (!saved || saved.expiresAt <= this.now()) {
      this.verified = false
      this.connection = saved ? { phase: 'expired', message: 'Your mStock session has expired. Sign in again.', checkedAt: null, nextRetryAt: null } : { phase: 'idle', message: 'Connect your mStock account.', checkedAt: null, nextRetryAt: null }
      if (hasExposure(this.session)) { this.session!.status = 'blocked'; this.note('Reconnect the same mStock account to reconcile the saved position or order.', 'error') }
      this.onChange(); return
    }
    this.restoring = true
    this.connection = { phase: 'checking', message: 'Checking the saved mStock session.', checkedAt: this.connection.checkedAt, nextRetryAt: null }; this.onChange()
    try {
      this.authorizeBroker?.(saved.account)
      try { await this.broker.verifyAccount?.() }
      catch (error) {
        if (generation !== this.connectionGeneration || this.broker.credentials !== saved) return
        if (error instanceof BrokerError && error.definitive) {
          this.verified = false; this.feed.close()
          this.connection = { phase: 'rejected', message: `mStock account check failed: ${error.message}`, checkedAt: this.now(), nextRetryAt: null }
          this.onChange()
        } else this.retryBrokerCheck()
        return
      }
      if (generation !== this.connectionGeneration || this.broker.credentials !== saved) return
      this.verified = true; this.connectionAttempt = 0
      this.connection = { phase: 'connected', message: 'Broker session verified. Market stream status is separate.', checkedAt: this.now(), nextRetryAt: null }
      this.subscribe()
      if (this.session && ['armed', 'preparing', 'running'].includes(this.session.status) && this.session.date === istDate(this.now())
        && this.now() < istTime(this.session.date, settingsFor(this.session).cutoff)) {
        if (this.session.mode === 'live' && !this.session.pending) {
          await this.checkPositions()
          if (!this.session.pnlVerified) { this.session.status = 'blocked'; this.note('Saved broker quantities do not match. Reconcile this same day-session before resuming.', 'error'); return }
        }
        this.session.status = this.session.legs.CE && this.session.legs.PE ? 'running' : 'armed'
        this.note('Same day-session restored: original references, rules, trades, positions, entry counts and reset state retained. Unresolved orders reconcile before new actions.')
        return
      }
      if (hasExposure(this.session)) await this.reconcile()
      else if (active(this.session)) { this.session!.status = 'stopped'; this.note('Previous flat session restored. Start when ready.') }
    } catch (error) {
      // A position-read/ownership failure is not a broker logout.
      if (this.verified && this.session) {
        if (!(error instanceof PositionReadError)) this.session.status = 'blocked'
        this.note(error instanceof Error ? error.message : 'Session recovery needs reconciliation.', 'error')
      } else {
        this.connection = { phase: 'rejected', message: 'This broker account cannot be restored in this workspace. Use the workspace where it was connected.', checkedAt: this.now(), nextRetryAt: null }
        this.onChange()
      }
    } finally { this.restoring = false; this.onChange() }
  }
  async recheckConnection(): Promise<void> {
    if (this.connected()) return
    if (!this.broker.credentials || this.broker.credentials.expiresAt <= this.now()) throw new Error('Sign in with a fresh verification code to reconnect mStock.')
    if (this.busy || this.auth) throw new Error('Complete the current login or wait for the broker request to finish.')
    await this.restore()
  }
  private subscribe(): void {
    if (!this.broker.credentials) return
    this.marks = {}
    this.feed.connect(this.broker.credentials, [INDEX_TOKEN, ...SIDES.flatMap(side => this.session?.legs[side]?.contract.token ? [this.session.legs[side]!.contract.token] : [])])
  }
  async beginLogin(username: string, password: string, apiKey: string): Promise<string> {
    return this.exclusive(async () => {
      if (active(this.session) && this.connected()) throw new Error('Stop the strategy before changing the broker connection.')
      if (!this.broker.login) throw new Error('Broker login is unavailable.')
      this.connectionGeneration++
      this.auth = null
      await this.broker.login(username, password)
      const id = randomUUID()
      this.auth = { id, username, apiKey, expires: this.now() + 600_000, attempts: 0 }
      return id
    })
  }
  async beginTotp(apiKey?: string): Promise<string> {
    return this.exclusive(async () => {
      if (active(this.session) && this.connected()) throw new Error('Stop the strategy before changing the broker connection.')
      const saved = this.broker.credentials ?? this.store.broker(), reuse = apiKey === undefined
      if (reuse && (!saved || saved.authMethod !== 'totp')) throw new Error('No saved Authenticator connection is available. Connect mStock first.')
      if (reuse && this.connected()) throw new Error('Your saved mStock connection is already active.')
      const key = reuse ? saved!.apiKey : apiKey.trim()
      if (!key || key.length > 1024) throw new Error('Enter a valid mStock Type A API key.')
      if (!this.broker.verify) throw new Error('Broker verification is unavailable.')
      this.connectionGeneration++
      const id = randomUUID()
      this.auth = { id, apiKey: key, username: reuse ? saved!.account : '', expires: this.now() + 600_000, attempts: 0, method: 'totp', ...(reuse ? { expectedAccount: saved!.account } : {}) }
      return id
    })
  }
  async verifyLogin(id: string, code: string, method: 'otp' | 'totp'): Promise<void> {
    return this.exclusive(async () => {
      const auth = this.auth
      if (!auth || auth.id !== id || auth.expires < this.now()) throw new Error('Login expired. Start the connection again.')
      if (auth.attempts++ >= 5) { this.auth = null; throw new Error('Too many verification attempts. Start login again.') }
      if (auth.method && method !== auth.method) throw new Error('Use the Authenticator code for this connection.')
      if (!this.broker.verify) throw new Error('Broker verification is unavailable.')
      const credentials = auth.verifiedCredentials ?? { ...await this.broker.verify(auth.apiKey, code, method, auth.username), authMethod: method }
      auth.verifiedCredentials = credentials
      if (auth.expectedAccount && credentials.account !== auth.expectedAccount) { this.auth = null; throw new Error('The verified broker account does not match your saved connection. Use connection setup to change accounts.') }
      if (hasExposure(this.session) && this.session!.account !== credentials.account) throw new Error('Reconnect the same account that owns the saved strategy position.')
      const previous = this.broker.credentials
      this.authorizeBroker?.(credentials.account, true)
      // The code has already created a token. Retain it securely if the read-only
      // funds check encounters a transient outage instead of consuming the code again.
      try { this.store.saveBroker(credentials) } catch (error) { this.broker.credentials = previous; throw error }
      this.connectionGeneration++; this.feed.close(); this.marks = {}; this.broker.credentials = credentials; this.verified = false; this.auth = null
      try { await this.broker.verifyAccount?.() }
      catch (error) {
        if (error instanceof BrokerError && error.definitive) {
          this.connection = { phase: 'rejected', message: `mStock account check failed: ${error.message}`, checkedAt: this.now(), nextRetryAt: null }; this.onChange(); throw error
        }
        this.retryBrokerCheck(); return
      }
      this.verified = true; this.connectionAttempt = 0
      this.connection = { phase: 'connected', message: 'Broker session verified. Market stream status is separate.', checkedAt: this.now(), nextRetryAt: null }
      this.subscribe(); this.onChange()
    })
  }
  releaseBrokerForTransfer(account: string): void {
    if (active(this.session) || hasExposure(this.session) || this.busy) throw new Error('The original workspace is running or has a position/pending order. Stop and flatten it before moving the broker connection.')
    if (this.broker.credentials && this.broker.credentials.account !== account) return
    this.connectionGeneration++; this.auth = null; this.verified = false
    this.feed.close(); this.marks = {}; this.broker.credentials = null; this.store.saveBroker(null)
    this.connection = { phase: 'idle', message: 'Broker connection moved after verification in another workspace. Trading history remains here.', checkedAt: this.now(), nextRetryAt: null }
    this.onChange()
  }
  async disconnect(): Promise<void> {
    return this.exclusive(async () => {
      if (active(this.session) || hasExposure(this.session)) throw new Error('Stop and flatten the strategy before disconnecting.')
      this.connectionGeneration++
      if (this.connected()) await this.broker.logout?.()
      this.feed.close(); this.verified = false; this.broker.credentials = null; this.store.saveBroker(null); this.marks = {}; this.connection = { phase: 'idle', message: 'Connect your mStock account.', checkedAt: null, nextRetryAt: null }; this.onChange()
    })
  }
  async start(mode: Mode, direction: StrategyDirection = 'buy'): Promise<void> {
    await this.exclusive(async () => {
      if (mode === 'live' && this.execution?.liveExecution === false) throw new Error(this.execution.reason)
      const now = this.now(), date = istDate(now)
      if (!this.connected()) throw new Error('Connect and verify your mStock account first.')
      const permissions = this.broker.credentials?.permissions
      if (mode === 'live' && permissions && (!permissions.exchanges.includes('NFO') || !permissions.products.includes('MIS') || !permissions.orderTypes.includes('MARKET'))) {
        if (!permissions.exchanges.includes('NFO')) throw new Error('This broker login does not advertise NSE F&O (NFO). Check the activated segments in mStock, then use Refresh login metadata. Required: NFO, MIS and MARKET.')
        throw new Error('This broker login does not advertise NFO, MIS and MARKET access required by the strategy. Verify account trading permissions with mStock before using Live mode.')
      }
      if (active(this.session)) throw new Error('The strategy is already running.')
      if (hasExposure(this.session)) throw new Error('Reconcile the saved position or order before starting.')
      const preferences = this.strategySettings(direction)
      if (!isTradingDay(now) || now < istTime(date, '09:00') || now >= istTime(date, preferences.cutoff)) throw new Error(`Start on a trading weekday between 09:00 and ${preferences.cutoff} IST.`)
      const previous = this.session
      if (!previous || previous.date !== date || previous.account !== this.broker.credentials!.account || previous.mode !== mode || directionOf(previous.settings) !== direction) {
        this.session = this.store.loadSession(this.broker.credentials!.account, date, mode, direction) ?? { id: randomUUID(), date, mode, account: this.broker.credentials!.account, status: 'armed',
          message: '', atm: null, expiry: null, legs: {}, pending: null, pnlVerified: true, trades: [], activity: [], settings: structuredClone(preferences) }
      }
      if (directionOf(this.session?.settings) !== direction) throw new Error('Saved strategy direction mismatch. Reconcile before starting.')
      if (hasExposure(this.session)) throw new Error('This mode has saved exposure that needs reconciliation before starting.')
      this.session!.settings ??= structuredClone(settingsFor(this.session))
      this.stopRequested = false
      this.session!.status = 'armed'
      // A restart never backfills entry signals from earlier candles.
      for (const side of SIDES) if (this.session!.legs[side]) this.session!.legs[side]!.lastCandleEnd = completedBoundary(now)
      this.note(now < istTime(date, RULES.referenceEnd) ? 'Armed. Waiting for the 09:15–09:20 reference candle to complete.' : 'Loading official NIFTY opening candle and ATM contracts.')
      if (!sameSettings(settingsFor(this.session), preferences)) this.note('Resuming today\'s existing day-session and locked rules. Saved setting changes apply on the next trading day.')
    })
    void this.pump()
  }
  async checkpointForRestart(): Promise<void> {
    this.suspended = true
    try { await this.exclusive(async () => { this.save() }) }
    catch (error) { this.suspended = false; throw error }
  }
  resumeAfterAbortedRestart(): void { this.suspended = false }
  async stop(): Promise<void> {
    // Set outside the serial queue so a slow order request cannot allow a second BUY.
    this.stopRequested = true
    await this.exclusive(async () => {
      if (!this.session) throw new Error('There is no strategy session to stop.')
      this.session.status = 'stopping'; this.note('Stop requested. Closing confirmed strategy positions.')
    })
    void this.pump()
  }
  async reconcile(): Promise<void> {
    await this.exclusive(async () => {
      if (!this.connected()) throw new Error('Reconnect your broker to reconcile saved orders and positions.')
      if (!this.session) return
      if (hasExposure(this.session)) this.stopRequested = true
      if (this.session.account !== this.broker.credentials!.account) throw new Error('The saved strategy belongs to a different broker account.')
      await this.resolvePending()
      if (this.session.pending) return
      await this.checkPositions()
      this.session.status = hasExposure(this.session) ? 'stopping' : 'stopped'
      this.stopRequested = hasExposure(this.session)
      this.note(hasExposure(this.session) ? 'Positions reconciled. Closing the recovered exposure.' : 'Broker and saved state reconciled. Start when ready.')
    })
    void this.pump()
  }
  private async prepare(): Promise<void> {
    const session = this.session!, now = this.now()
    session.status = 'preparing'; this.note('Checking the completed 09:15–09:20 NIFTY spot candle.')
    const spotBars = await this.broker.history(INDEX_TOKEN, 'NSE', session.date, now)
    const opening = spotBars.find(c => c.start === istTime(session.date, RULES.referenceStart))
    if (!opening) throw new Error('The official NIFTY opening candle is unavailable. Retry when broker history is ready.')
    const contracts = await this.broker.contracts(session.date, opening.close)
    const legs: TradingSession['legs'] = {}
    for (const contract of contracts) {
      const bars = await this.broker.history(contract.token, 'NFO', session.date, this.now())
      const reference = bars.find(c => c.start === opening.start)
      if (!reference) throw new Error(`The 09:15–09:20 ${contract.side} reference candle is unavailable. No levels were guessed.`)
      legs[contract.side] = { contract, reference, ...levels(reference.close, settingsFor(session)), position: null, realized: 0,
        entries: 0, lastCandleEnd: completedBoundary(this.now()), exitReason: null }
      const leg = legs[contract.side]!
      const past = bars.filter(bar => validCandle(bar) && bar.start >= istTime(session.date, RULES.referenceEnd) && bar.end <= leg.lastCandleEnd).sort((a, b) => a.end - b.end)
      leg.firstSignalConsumed = past.some(bar => isBeyondEntry(bar.close, leg, settingsFor(session), true))
      leg.reentryReady = leg.firstSignalConsumed && !!past.length && signFor(settingsFor(session)) * (past.at(-1)!.close - (directionOf(settingsFor(session)) === 'sell' ? leg.lower : leg.upper)) < 0
    }
    if (session.mode === 'live') await this.requireNoExistingNifty()
    session.legs = legs; session.atm = contracts[0].strike; session.expiry = contracts[0].expiry
    session.status = this.stopRequested ? 'stopping' : 'running'; this.save(); this.subscribe()
    this.note('Reference closes locked. Waiting for the next completed five-minute candle.')
  }
  private async requireNoExistingNifty(): Promise<void> {
    const positions = await this.broker.positions()
    if (positions.some(p => p.exchange === 'NFO' && p.symbol.startsWith('NIFTY') && p.quantity !== 0)) throw new Error('Existing NIFTY broker exposure must be closed or reconciled before a new session.')
  }
  private fresh(side: Side): Mark | null {
    const leg = this.session?.legs[side], mark = leg ? this.marks[leg.contract.token] : null
    return freshMark(mark, this.now()) ? mark : null
  }
  private async checkPositions(): Promise<void> {
    if (!this.session || this.session.mode === 'paper') return
    // An unavailable read pauses this cycle, without turning a transient outage
    // into a permanent stop. Verified quantity mismatches remain hard errors.
    let positions
    try { positions = await this.broker.positions() }
    catch { throw new PositionReadError('Broker position verification is delayed. Orders are paused; retrying automatically.') }
    for (const side of SIDES) {
      const leg = this.session.legs[side]
      if (!leg) continue
      const relevant = positions.filter(p => p.symbol === leg.contract.symbol && p.exchange === 'NFO' && ['MIS', 'INTRADAY', 'INTRA'].includes(p.product))
      const actual = signFor(settingsFor(this.session)) * relevant.reduce((total, p) => total + p.quantity, 0), expected = leg.position?.quantity ?? 0
      if (actual < 0 || actual > expected) throw new Error(`Unexpected ${side} broker exposure. Automatic orders are blocked until reconciled.`)
      if (actual !== expected) {
        this.session.pnlVerified = false
        if (leg.position && actual) leg.position.quantity = actual
        else leg.position = null
        this.note(`${side} quantity changed outside this engine. New entries are paused; realized P&L needs broker verification.`, 'error')
      }
    }
    this.lastPositionCheck = this.now(); this.save()
  }
  private async submit(side: Side, reason: Reason): Promise<void> {
    const session = this.session!, leg = session.legs[side]!
    if (session.pending || this.now() < (this.backoff[side] ?? 0)) return
    const buy = reason === 'BREAKOUT'
    if (buy && (this.stopRequested || session.status !== 'running' || !session.pnlVerified
      || !settingsFor(session).enabledSides.includes(side) || this.now() >= istTime(session.date, settingsFor(session).cutoff))) return
    const mark = this.fresh(side)
    if (buy && !mark) {
      this.note(`${side} entry skipped: waiting for a fresh official market price.`); return
    }
    if (session.mode === 'live') {
      await this.checkPositions()
      if (buy && !session.pnlVerified) return
    }
    const quantity = orderQuantity(leg, reason, settingsFor(session))
    if (quantity <= 0) return
    // Stop can arrive while broker position verification is in flight.
    if (buy && (this.stopRequested || this.now() >= istTime(session.date, settingsFor(session).cutoff))) return
    if (buy && !this.fresh(side)) {
      this.note(`${side} entry skipped: the live price became stale during broker verification.`); return
    }
    const intent: OrderIntent = { id: randomUUID(), tag: `n009${randomUUID().replaceAll('-', '').slice(0, 14)}`,
      side, symbol: leg.contract.symbol, instrumentToken: leg.contract.token, expiry: leg.contract.expiry, transaction: buy ? entryTransaction(settingsFor(session)) : exitTransaction(settingsFor(session)), quantity, reason, submittedAt: this.now() }
    if (session.mode === 'paper') {
      if (!mark) { this.note(`${side} paper exit is waiting for a verified market price.`); return }
      applyFill(session, intent, { orderId: `PAPER-${intent.id}`, quantity, average: mark.price, status: 'COMPLETE' }, this.now())
      this.audit(intent, { orderId: `PAPER-${intent.id}`, status: 'simulated', filled: quantity, average: mark.price, detail: 'Simulated fill from a fresh market price. No broker order or cash debit.' })
      this.note(`${side} ${intent.transaction}: ${quantity} units at ₹${mark.price.toFixed(2)} · ${reason}`); return
    }
    session.pending = intent; this.audit(intent, { status: 'submitting', detail: 'Intent saved before submission. Waiting for a broker acknowledgement.' })
    try {
      intent.orderId = await this.broker.place(intent); this.audit(intent, { status: 'acknowledged', detail: 'Broker order ID received. Acknowledgement is not a fill.' })
    } catch (error) {
      if (error instanceof BrokerError && error.definitive) {
        session.pending = null; this.backoff[side] = this.now() + 3000
        this.audit(intent, { status: 'rejected', filled: 0, average: 0, detail: rejectionSummary(error.message) })
        this.note(`${side} order rejected: ${error.message}`, 'error'); return
      }
      this.audit(intent, { status: 'unknown', detail: 'Submission outcome unknown. Do not assume rejected or filled. No automatic resend.' })
      session.status = 'blocked'; this.note('Order submission outcome is unknown. Reconciling by its saved tag; it will never be resent automatically.', 'error'); return
    }
    await this.resolvePending()
  }
  private async resolvePending(): Promise<void> {
    const session = this.session!, intent = session.pending
    if (!intent) return
    const contract = session.legs[intent.side]?.contract
    const expected = { ...intent, instrumentToken: intent.instrumentToken ?? contract?.token, expiry: intent.expiry ?? contract?.expiry }
    this.lastPendingAttempt = this.now()
    if (!intent.orderId) {
      intent.orderId = (await this.broker.findOrder(expected)) ?? undefined; this.save()
      if (!intent.orderId) { session.status = 'blocked'; this.note('The broker has not identified the submitted order. Verify its status in mStock before trading again.', 'error'); return }
      this.audit(intent, { status: 'acknowledged', detail: 'Order ID recovered by its exact saved tag and contract identity.' })
    }
    const fill = await this.broker.order({ ...expected, orderId: intent.orderId })
    if (fill) {
      applyFill(session, intent, fill, this.now())
      this.audit(intent, { status: fill.quantity === intent.quantity ? 'filled' : fill.quantity > 0 ? 'partial-terminal' : String(fill.status).toUpperCase() === 'REJECTED' ? 'rejected' : 'cancelled',
        filled: fill.quantity, average: fill.average, detail: fill.rejectionReason ?? `Broker confirmed terminal status ${fill.status}.` })
      this.backoff[intent.side] = this.now() + (fill.quantity ? 0 : 3000)
      if (session.status === 'blocked') session.status = this.stopRequested ? 'stopping' : 'running'
      this.note(fill.quantity ? `${intent.side} ${intent.transaction} confirmed: ${fill.quantity} units at ₹${fill.average.toFixed(2)} · ${intent.reason}`
        : `${intent.side} order ended ${fill.status}; no fill recorded.${fill.rejectionReason ? ` ${fill.rejectionReason}` : ''}`, fill.quantity ? 'info' : 'error')
    } else if (this.now() - intent.submittedAt >= 12_000 && !intent.cancelRequested) {
      // Save BEFORE cancellation as well; reconcile completion after a timeout.
      intent.cancelRequested = true; this.save()
      this.audit(intent, { status: 'cancel-requested', detail: 'Cancellation requested; terminal broker status is still required.' })
      await this.broker.cancel(intent.orderId)
      this.note('Pending order cancellation requested. Waiting for a terminal broker status.')
    }
  }
  async pump(): Promise<void> {
    if (this.suspended) return
    if (this.auth && this.auth.expires <= this.now()) this.auth = null
    if (!this.verified && this.connection.phase === 'retrying' && !this.auth && !this.busy && this.now() >= (this.connection.nextRetryAt ?? Infinity)) { await this.restore(); return }
    if (this.broker.credentials && this.broker.credentials.expiresAt <= this.now() && this.verified) { this.verified = false; this.feed.close(); this.onChange() }
    if (this.pumpTask) return this.pumpTask
    if (this.busy || !this.session || !active(this.session) && !hasExposure(this.session) || this.now() < this.retryAt) return
    this.pumpTask = this.exclusive(async () => {
      const session = this.session
      if (!session) return
      try {
        if (!this.connected()) throw new Error('Broker session unavailable. Reconnect the same account to continue monitoring.')
        const now = this.now()
        if (istDate(now) !== session.date || now >= istTime(session.date, settingsFor(session).cutoff) || this.stopRequested) session.status = 'stopping'
        if (session.pending) {
          if (now - this.lastPendingAttempt >= 1500) await this.resolvePending()
          return
        }
        if (session.status === 'stopping') {
          this.refreshQuotes()
          for (const side of SIDES) if (session.legs[side]?.position) {
            await this.submit(side, this.stopRequested ? 'MANUAL_STOP' : 'SESSION_END')
            if (session.pending) return
          }
          if (!hasExposure(session)) { session.status = 'stopped'; this.note('Session stopped. Both strategy legs are flat.') }
          return
        }
        if (session.status === 'armed' && now >= istTime(session.date, RULES.referenceEnd)) {
          if (!session.legs.CE || !session.legs.PE) {
            try { await this.prepare() }
            catch (error) {
              session.status = 'armed'; this.retryAt = this.now() + 5000
              this.note(error instanceof Error ? error.message : 'Reference candles are delayed. Retrying.', 'error')
            }
          }
          else { session.status = 'running'; this.subscribe(); this.note('Monitoring resumed with the locked reference candles.') }
          return
        }
        if (session.status === 'blocked' && hasExposure(session)) {
          session.status = 'stopping'; this.stopRequested = true; return
        }
        if (session.status !== 'running') return
        this.refreshQuotes()
        if (now - this.lastPositionCheck >= 15_000) await this.checkPositions()
        // Targets act on fresh prices. Never infer an executable fill from a past candle high.
        for (const side of SIDES) {
          const leg = session.legs[side]!, mark = this.fresh(side)
          const priceReason = mark ? priceExitSignal(leg, mark.price, settingsFor(session), this.now()) : null
          const reason = priceReason === 'STOP_LOSS' && (!leg.exitReason || ['TARGET_1', 'TARGET_2'].includes(leg.exitReason)) ? priceReason : leg.exitReason || priceReason
          if (reason) {
            leg.exitReason = reason; this.save(); await this.submit(side, reason)
            if (session.pending) return
            if (leg.position && reason === 'TARGET_1' && leg.position.target1Remaining === 0 && leg.exitReason === reason) leg.exitReason = null
          }
        }
        this.evaluateCandles()
      } catch (error) {
        if (!(error instanceof PositionReadError)) session.status = 'blocked'
        this.retryAt = this.now() + 5000
        this.note(error instanceof Error ? error.message : 'The broker operation failed. Reconcile before continuing.', 'error')
      } finally { this.save() }
    }).finally(() => { this.pumpTask = null })
    return this.pumpTask
  }
  private refreshQuotes(): void {
    if (this.quotesInFlight || this.now() - this.lastQuotes < 2500) return
    const session = this.session
    const contracts = SIDES.flatMap(side => session?.legs[side] && !this.fresh(side) ? [session.legs[side]!.contract] : [])
    if (!contracts.length) return
    this.lastQuotes = this.now(); this.quotesInFlight = true
    // Official REST snapshots also cover flat legs during a WebSocket outage.
    // Keep this read outside the order queue so Stop remains responsive.
    void this.broker.quotes(contracts).then(marks => {
      if (this.session !== session) return
      for (const mark of marks) this.feed.onMark(mark)
    }).catch(() => { /* No mark means no entry; the next bounded poll retries. */ })
      .finally(() => { this.quotesInFlight = false })
  }
  private evaluateCandles(): void {
    const session = this.session!, now = this.now(), boundary = completedBoundary(now)
    if (this.historyInFlight || now - boundary < 2000 || now - this.lastHistoryAttempt < 5000) return
    if (SIDES.every(side => session.legs[side]!.lastCandleEnd >= boundary)) return
    this.lastHistoryAttempt = now; this.historyInFlight = true
    // Historical downloads run outside the order queue. A slow chart endpoint
    // must never delay targets, Stop, or the exchange-time square-off.
    const read = async () => {
      for (const side of SIDES) {
        const leg = session.legs[side]!
        if (leg.lastCandleEnd >= boundary) continue
        let bars: Candle[]
        try { bars = await this.broker.history(leg.contract.token, 'NFO', session.date, this.now()) }
        catch {
          if (this.session === session && session.status === 'running') this.note(`${side} candle history is delayed. Retrying; protective exits remain monitored.`, 'error')
          continue
        }
        await this.exclusive(async () => {
          if (this.session !== session || session.status !== 'running' || session.pending || this.stopRequested
            || this.now() >= istTime(session.date, settingsFor(session).cutoff)) return
          const unseen = bars.filter(c => c.end <= boundary && c.end > leg.lastCandleEnd).sort((a, b) => a.end - b.end)
          if (!leg.position && (leg.entries > 0 || leg.firstSignalConsumed)) {
            // Older saved sessions have no gate metadata: infer the last full exit while flat and fail closed without one.
            if (leg.entries > 0) leg.lastExitAt ??= session.trades.findLast(trade => trade.side === side && trade.transaction === exitTransaction(settingsFor(session)))?.at ?? this.now()
            for (const bar of unseen) {
              observeReentry(leg, bar, this.now(), settingsFor(session))
              if (bar !== unseen.at(-1) && validCandle(bar) && isBeyondEntry(bar.close, leg, settingsFor(session))) leg.reentryReady = false
            }
          }
          // A delayed history response may contain several closes. Preserve the
          // first protective exit even if a later candle recovered above lower.
          // Flat legs still consider only the latest close, never replay entries.
          const candle = (leg.position ? unseen.find(c => ['LOWER_CLOSE', 'UPPER_CLOSE'].includes(candleSignal(leg, c, this.now(), session.date, settingsFor(session)) ?? '')) : null) ?? unseen.at(-1)
          if (!candle) return
          const signal = candleSignal(leg, candle, this.now(), session.date, settingsFor(session))
          if (!leg.position && validCandle(candle) && isBeyondEntry(candle.close, leg, settingsFor(session))) { leg.firstSignalConsumed = true; leg.reentryReady = false }
          leg.lastDecision = { candle, evaluatedAt: this.now(), signal, explanation: signal === 'BREAKOUT' ? leg.entries > 0 ? directionOf(settingsFor(session)) === 'sell' ? 'A post-exit close above the fixed lower breakout was followed by a later close below it.' : 'A post-exit close below the fixed breakout level was followed by a later close above it.' : 'Completed close reached the breakout level while flat.' : signal === 'UPPER_CLOSE' ? 'Completed close rose above the upper exit while short.' : signal === 'LOWER_CLOSE' ? 'Completed close fell below the lower exit while holding units.' : leg.position ? 'No completed-candle lower exit. Fresh-price targets remain monitored.' : !settingsFor(session).enabledSides.includes(side) ? 'Leg disabled in this session settings.' : settingsFor(session).maxEntriesPerLeg && leg.entries >= settingsFor(session).maxEntriesPerLeg ? 'Configured entry limit reached.' : (leg.entries > 0 || leg.firstSignalConsumed) && !leg.reentryReady ? directionOf(settingsFor(session)) === 'sell' ? 'Fresh-cross gate locked: waiting for a completed close above the original lower breakout, then a later close below it.' : 'Fresh-cross gate locked: waiting for a completed close below the original breakout level, then a later close above it.' : this.now() - candle.end > 90_000 ? 'Candle too old for a new entry.' : 'Completed close did not meet the entry rule.' }
          session.decisionAudit ??= []
          session.decisionAudit.push({ side, ...leg.lastDecision })
          leg.lastCandleEnd = candle.end; this.save()
          if (signal === 'LOWER_CLOSE' || signal === 'UPPER_CLOSE') leg.exitReason = signal
          if (signal) await this.submit(side, signal)
        })
      }
    }
    void read().catch(error => {
      if (this.session === session) {
        if (!(error instanceof PositionReadError)) session.status = 'blocked'
        this.retryAt = this.now() + 5000
        this.note(error instanceof Error ? error.message : 'Candle execution needs reconciliation.', 'error')
      }
    }).finally(() => { this.historyInFlight = false })
  }
}
