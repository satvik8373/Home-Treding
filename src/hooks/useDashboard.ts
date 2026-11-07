import { useEffect, useRef, useState } from "react";
import type { AppState } from "../../shared/model";
import { useDeployment } from '../lib/deployment';

export function useDashboard() {
  const { available } = useDeployment();
  const [data, setData] = useState<AppState | null>(null),
    [online, setOnline] = useState(false);
  const [now, setNow] = useState(() => Date.now()),
    [error, setError] = useState(""),
    [working, setWorking] = useState("");
  const csrf = useRef(""),
    offset = useRef(0);
  const refreshState = useRef<() => Promise<void>>(async () => {});
  const actionPending = useRef(false);
  useEffect(() => {
    if (!available) {
      const tick = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(tick);
    }
    let alive = true,
      inFlight = false,
      lastAccepted = 0,
      latestServerTime = 0;
    const accept = (value: AppState) => {
      if (!alive) return;
      if (value.serverTime < latestServerTime) return;
      if (value.csrf) csrf.current = value.csrf;
      latestServerTime = value.serverTime;
      lastAccepted = Date.now();
      offset.current = value.serverTime - Date.now();
      setData(value);
      setOnline(true);
    };
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/state", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (response.status === 401 && alive) window.dispatchEvent(new Event('n009:session-expired'));
        if (!response.ok) throw new Error();
        accept(await response.json());
      } catch {
        if (alive && Date.now() - lastAccepted > 12_000) setOnline(false);
      } finally {
        inFlight = false;
      }
    }
    refreshState.current = refresh;
    void refresh();
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      try {
        accept(JSON.parse(event.data));
      } catch {
        /* Polling recovers. */
      }
    };
    events.onerror = () => {
      void refresh();
    };
    const poll = setInterval(() => void refresh(), 4000),
      tick = setInterval(() => {
        setNow(Date.now() + offset.current);
        if (Date.now() - lastAccepted > 12_000) setOnline(false);
      }, 1000);
    return () => {
      alive = false;
      events.close();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [available]);
  async function action(path: string, body: object, name: string) {
    if (!available) { setError('The execution engine is not connected. Broker and trading actions are unavailable.'); return null; }
    if (actionPending.current) return null;
    actionPending.current = true;
    setError("");
    setWorking(name);
    try {
      if (!csrf.current) await refreshState.current();
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-009-CSRF": csrf.current,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });
      const result = await response.json();
      if (response.status === 401) window.dispatchEvent(new Event('n009:session-expired'));
      if (!response.ok)
        throw new Error(result.error || "The request could not be completed.");
      return result;
    } catch (e) {
      const uncertain = e instanceof Error && ['TimeoutError', 'AbortError', 'TypeError'].includes(e.name);
      setError(uncertain ? "The request outcome is not confirmed. Refreshing engine state; check its status before repeating this action." : e instanceof Error ? e.message : "Could not reach the engine.");
      return null;
    } finally {
      actionPending.current = false;
      setWorking("");
      void refreshState.current();
    }
  }
  return { data, online, now, error, setError, working, action };
}
