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
import { clock } from "../lib/format";
import { Dialog } from "./Dialog";
import { BrokerDiagnostics } from './BrokerDiagnostics';

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
    [method, setMethod] = useState<"otp" | "totp">("totp");
  const [refreshLogin, setRefreshLogin] = useState(false);
  const showConnection = broker?.connected && !refreshLogin;
  const [form, setForm] = useState({
    username: "",
    password: "",
    apiKey: "",
    code: "",
  });
  async function login(event: FormEvent) {
    event.preventDefault();
    const result = await action(
      "/api/broker/login",
      { username: form.username, password: form.password, apiKey: form.apiKey },
      "login",
    );
    if (result) {
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
      setRefreshLogin(false);
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
          : flowId
            ? "Verify your connection"
            : refreshLogin ? 'Refresh mStock login' : "Connect mStock"}
      </h2>
      <p className="dialog-description">
        {showConnection
          ? `Connected as ${broker.name}.`
          : flowId
            ? "Enter your current six-digit verification code."
            : refreshLogin ? 'Sign in again to capture the exchange, product and order-type permissions supplied by mStock.' : "Use your mStock account and official API key."}
      </p>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {showConnection ? (
        <>
          <dl className="connection-details">
            <div>
              <dt>Account</dt>
              <dd>{broker.account}</dd>
            </div>
            <div>
              <dt>WebSocket</dt>
              <dd>{broker.feed}</dd>
            </div>
            <div>
              <dt>Session expires</dt>
              <dd>
                {broker.expiresAt ? `${clock(broker.expiresAt)} IST` : "—"}
              </dd>
            </div>
          </dl>
          <BrokerDiagnostics key={broker.account} account={broker.account!} />
          <button className="button secondary full-width" disabled={locked || !online || !!working} onClick={() => { setRefreshLogin(true); setFlowId('') }}>Refresh login metadata</button>
          <p className="form-hint">Requires a fresh login and OTP/TOTP. Stop and flatten the strategy before refreshing.</p>
          <button
            className="button secondary full-width"
            disabled={locked || !!working}
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
      ) : flowId ? (
        <form onSubmit={verify}>
          <div className="auth-method">
            <button
              type="button"
              className={method === "totp" ? "active" : ""}
              onClick={() => setMethod("totp")}
            >
              Authenticator
            </button>
            <button
              type="button"
              className={method === "otp" ? "active" : ""}
              onClick={() => setMethod("otp")}
            >
              SMS OTP
            </button>
          </div>
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
            disabled={!!working || form.code.length !== 6}
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
