import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  ExternalLink,
  Link2,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import type { BrokerStatus } from "../../shared/model";
import type { useDashboard } from "../hooks/useDashboard";
import { clock, dateTime } from "../lib/format";
import { Dialog } from "./Dialog";
import { BrokerDiagnostics } from './BrokerDiagnostics';
import { BrokerSetup } from './BrokerSetup';

type Props = {
  broker?: BrokerStatus;
  locked: boolean;
  online: boolean;
  working: string;
  error: string;
  action: ReturnType<typeof useDashboard>["action"];
  onClose: () => void;
};
export function BrokerDialog({
  broker,
  locked,
  online,
  working,
  error,
  action,
  onClose,
}: Props) {
  const [flowId, setFlowId] = useState(""),
    [methodChoice, setMethod] = useState<"otp" | "totp" | null>(null);
  const [awaitingConnection, setAwaitingConnection] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [refreshLogin, setRefreshLogin] = useState(false);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const showConnection = broker?.connected && !refreshLogin;
  const [form, setForm] = useState({
    username: "",
    password: "",
    apiKey: "",
    code: "",
  });
  const method = methodChoice ?? broker?.verificationMethod ?? 'totp';
  const phase = broker?.connection?.phase;
  const showRecovery = !showConnection && !flowId && !refreshLogin && (phase === 'checking' || phase === 'retrying' || awaitingConnection && phase !== 'expired' && phase !== 'rejected');
  function verificationMethod() {
    return <label className="field">Verification method<select className="broker-method-select" value={method} disabled={!online || !!working} onChange={event => { setMethod(event.target.value as 'otp' | 'totp'); setForm({ ...form, code: '' }) }}><option value="otp">SMS OTP</option><option value="totp">Authenticator (TOTP enabled)</option></select><small className="form-hint">{method === 'otp' ? 'Use SMS OTP if TOTP is not enabled for your mStock API.' : 'Use your authenticator app. mStock does not send SMS OTP when TOTP is enabled.'}</small></label>
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    const result = await action(
      "/api/broker/login",
      { username: form.username, password: form.password, apiKey: form.apiKey },
      "login",
    );
    if (result) {
      setAwaitingConnection(false);
      setFlowId(result.flowId);
      setForm({ username: "", password: "", apiKey: "", code: "" });
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (
      await action(
        "/api/broker/verify",
        { flowId, code: form.code, method },
        "verify",
      )
    ) {
      setFlowId('');
      setAwaitingConnection(true);
      setRefreshLogin(false);
      setConnectionRevision(value => value + 1);
      setForm({ username: '', password: '', apiKey: '', code: '' });
    }
  }
  return (
    <Dialog titleId="broker-title" onClose={onClose}>
      <span className="dialog-icon">
        <Link2 size={24} />
      </span>
      <span className="eyebrow">BROKER</span>
      <h2 id="broker-title">
        {showConnection
          ? "mStock connected"
          : showRecovery ? "Checking broker connection" : flowId
            ? "Verify your connection"
            : refreshLogin ? 'Refresh mStock login' : "Connect mStock"}
      </h2>
      <p className="dialog-description">
        {showConnection
          ? `Connected as ${broker.name}.`
          : showRecovery ? "Your saved token is retained while the read-only account check retries." : flowId
            ? (method === 'otp' ? "Enter the six-digit code sent by mStock." : "Enter the current six-digit code from your authenticator app.")
            : refreshLogin ? 'Sign in again to capture the exchange, product and order-type permissions supplied by mStock.' : "Use your mStock account and official API key."}
      </p>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {!showConnection && !showRecovery && !flowId && broker?.connection && ['expired', 'rejected'].includes(broker.connection.phase) && <p className="form-hint" role="status">{broker.connection.message}</p>}

      {showConnection ? (
        <>
          <dl className="connection-details">
            <div>
              <dt>Account</dt>
              <dd>{broker.account}</dd>
            </div>
            <div>
              <dt>Market stream</dt>
              <dd>{broker.feed === 'connecting' ? 'Reconnecting automatically' : broker.feed}</dd>
            </div>
            <div>
              <dt>Session expires</dt>
              <dd>
                {broker.expiresAt ? `${dateTime(broker.expiresAt)} IST` : "—"}
              </dd>
            </div>
          </dl>
          <BrokerDiagnostics key={broker.account} account={broker.account!} />
          <button className="button secondary full-width" disabled={locked || !online || !!working} onClick={() => { setRefreshLogin(true); setFlowId('') }}>Refresh login metadata</button>
          <p className="form-hint">Requires a fresh login and OTP/TOTP. Stop and flatten the strategy before refreshing.</p>
          <button
            className="button secondary full-width"
            disabled={locked || !online || !!working}
            onClick={() =>
              void action("/api/broker/disconnect", {}, "disconnect")
            }
          >
            <Unplug size={15} />
            Disconnect
          </button>
          {locked && (
            <p className="form-hint">
              Stop and flatten the strategy before disconnecting.
            </p>
          )}
        </>
      ) : showRecovery ? <div className="broker-recovery" role="status"><p>{broker?.connection?.message || 'Verification code accepted. Checking your broker session.'}</p>{broker?.connection?.nextRetryAt && <p>Next check: {clock(broker.connection.nextRetryAt, true)} IST</p>}<button className="button secondary full-width" disabled={!online || !!working || phase === 'checking'} onClick={() => void action('/api/broker/recheck', {}, 'recheck-broker')}>{working === 'recheck-broker' ? 'Checking…' : 'Retry account check'}</button><button type="button" className="text-button restart-auth" disabled={!!working} onClick={() => { setRefreshLogin(true); setAwaitingConnection(false) }}>Sign in again</button></div> : flowId ? (
        <form onSubmit={verify}>
          {verificationMethod()}
          <label className="field">
            {method === "totp" ? "Authenticator code" : "SMS OTP"}
            <input
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.replace(/\D/g, "") })
              }
              placeholder="6-digit code"
            />
          </label>
          <button
            className="button primary full-width"
            disabled={!online || !!working || form.code.length !== 6}
          >
            {working === "verify" ? "Verifying…" : "Verify & connect"}
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            className="text-button restart-auth"
            disabled={!!working}
            onClick={() => setFlowId("")}
          >
            Start login again
          </button>
        </form>
      ) : (
        <form onSubmit={login}>
          {verificationMethod()}
          {(["username", "apiKey", "password"] as const).map((key) => (
            <label className="field" key={key}>
              {key === "username"
                ? "Client code"
                : key === "apiKey"
                  ? "API key"
                  : "Password"}
              <input
                required
                type={key === "username" ? "text" : "password"}
                autoComplete={
                  key === "username"
                    ? "username"
                    : key === "password"
                      ? "current-password"
                      : "off"
                }
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <button
            className="button primary full-width"
            disabled={!online || !!working}
          >
            {working === "login" ? "Connecting…" : "Continue"}
            <ArrowRight size={15} />
          </button>
        </form>
      )}
      {refreshLogin && broker?.connected && <button className="text-button restart-auth" disabled={!!working} onClick={() => { setRefreshLogin(false); setFlowId(''); setForm({ username: '', password: '', apiKey: '', code: '' }) }}>Return to current connection</button>}
      <details className="broker-setup-details" onToggle={event => setSetupOpen(event.currentTarget.open)}><summary>API key & execution IP setup</summary>{setupOpen && <BrokerSetup key={`${broker?.connected ? broker.account : 'disconnected'}:${connectionRevision}`} account={broker?.connected ? broker.account : null} action={action} working={working} />}</details>
      {!showConnection && <p className="form-hint">A verified connection can move from another stopped, flat workspace. Its history stays in that workspace.</p>}
      <p className="form-hint">Sessions expire within 12 hours or at midnight IST, whichever comes first. A stream reconnect does not require a new OTP.</p>
      <div className="dialog-security">
        <ShieldCheck size={15} />
        <span>
          Tokens stay on the backend. Passwords and OTPs are never saved.
        </span>
      </div>
      <a
        className="broker-doc-link"
        href="https://tradingapi.mstock.com/docs/v1/typeA/User/"
        target="_blank"
        rel="noreferrer"
      >
        Official connection guide <ExternalLink size={12} />
      </a>
    </Dialog>
  );
}
