import { directionOf } from '../shared/strategy.ts'
import express from "express";
import { tradesReport, ordersReport, backtestTradesReport, backtestDaysReport } from "./reports.ts";
import type { ErrorRequestHandler } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Controller } from "./controller.ts";
import { MarketCharts } from "./charts.ts";
import type { MStock } from "./broker.ts";
import { Backtests, MemoryRepository } from "./backtest/service.ts";
import { HistoricalData, CONTRACT_SCHEMA } from './backtest/historical.ts';
import type { BacktestRepository } from "./backtest/service.ts";
import { DATASET_SCHEMA } from "./backtest/schema.ts";
import { AccountDiagnostics } from "./diagnostics.ts";
import { AccountAudit } from './audit.ts';
import { DEFAULT_SETTINGS } from '../shared/settings.ts';
import { ExecutionNetwork, observeExecutionIPv4 } from './setup.ts';
import { createEgressAgent, createProxyFetcher } from './proxy.ts';

export interface AppNetworkOptions {
  conflictCheck?: (observedIp: string | null, routeUrl: string | null) => boolean;
  applyEgress?: (routeUrl: string | null) => void;
  allowPrivateProxy?: boolean;
  onSetupReady?: (controls: { setEgressRoute: (routeUrl: string | null, ipv4?: string) => void }) => void;
}

export function createApp(
  controller: Controller,
  root: string,
  port = 4310,
  backtestRepository?: BacktestRepository,
  gatewaySecret = process.env.N009_GATEWAY_SECRET ?? '',
  networkObserver?: () => Promise<string>,
  appNetwork?: AppNetworkOptions,
) {
  const app = express(),
    csrf = randomBytes(32).toString("hex");
  const subscribers = new Set<express.Response>();
  const repository = backtestRepository ?? new MemoryRepository();
  const baseObserve = networkObserver ?? observeExecutionIPv4;
  const observeForRoute = (routeUrl: string | null) =>
    routeUrl ? () => observeExecutionIPv4(createProxyFetcher(routeUrl)) : baseObserve;
  const applyEgress = appNetwork?.applyEgress ?? ((routeUrl: string | null) => {
    controller.broker.setFetcher?.(routeUrl ? createProxyFetcher(routeUrl) : fetch);
    controller.feed.setAgent?.(routeUrl ? createEgressAgent(routeUrl) : undefined);
  });
  const initialProxy = repository.get<{ url: string; ipv4?: string } | null>('setup:workspace-proxy');
  const setup = new ExecutionNetwork(
    repository,
    () => controller.connected() && controller.broker.credentials ? { account: controller.broker.credentials.account, apiKey: controller.broker.credentials.apiKey } : null,
    undefined,
    observeForRoute(initialProxy?.url ?? null),
    Date.now,
    appNetwork?.conflictCheck,
  );
  if (initialProxy?.url) {
    try { applyEgress(initialProxy.url); } catch { /* retain default routing if saved proxy fails init */ }
  }
  appNetwork?.onSetupReady?.({
    setEgressRoute: (routeUrl, ipv4) => {
      applyEgress(routeUrl);
      setup.setObserve(observeForRoute(routeUrl), ipv4);
    },
  });
  const historical = new HistoricalData(controller.broker as MStock, () => ({ connected: controller.connected(), account: controller.broker.credentials?.account ?? null, session: controller.session }), repository);
  const accountDiagnostics = new AccountDiagnostics(controller.broker as MStock, controller.feed, Date.now, () => controller.session);
  const audit = new AccountAudit(accountDiagnostics, () => controller.snapshot());
  const charts = new MarketCharts(controller.broker as MStock, () => ({
    connected: controller.connected(),
    account: controller.broker.credentials?.account ?? null,
    session: controller.session,
  }));
  const backtests = new Backtests(
    controller.broker as MStock,
    () => ({
      connected: controller.connected(),
      account: controller.broker.credentials?.account ?? null,
      session: controller.session,
    }),
    repository,
    Date.now,
    historical,
  );
  const allowed = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    "127.0.0.1:5173",
    "localhost:5173",
  ]);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const localAllowed = new Set([
      ...allowed,
      `127.0.0.1:${req.socket.localPort}`,
      `localhost:${req.socket.localPort}`,
    ]);
    const provided = Buffer.from(req.get('x-009-gateway-secret') ?? ''), expectedGateway = Buffer.from(gatewaySecret);
    const gatewayAuthenticated = !!gatewaySecret && provided.length === expectedGateway.length && timingSafeEqual(provided, expectedGateway);
    if (gatewaySecret && !gatewayAuthenticated) return res.status(401).json({ error: 'Authenticated gateway required.' });
    if (!gatewayAuthenticated && !localAllowed.has(req.headers.host ?? ""))
      return res.status(403).json({ error: "Invalid local host." });
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    });
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.get("origin");
      if (origin) {
        try {
          if (
            !localAllowed.has(new URL(origin).host) ||
            new URL(origin).protocol !== "http:"
          )
            throw new Error();
        } catch {
          return res
            .status(403)
            .json({ error: "Cross-site requests are blocked." });
        }
      }
      if (req.get("sec-fetch-site") === "cross-site")
        return res
          .status(403)
          .json({ error: "Cross-site requests are blocked." });
      const supplied = Buffer.from(req.get("x-009-csrf") ?? ""),
        expected = Buffer.from(csrf);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        return res
          .status(403)
          .json({ error: "Refresh the app before continuing." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "JSON request required." });
    }
    next();
  });
  const smallJson = express.json({ limit: "8kb" }),
    importJson = express.json({ limit: "2mb" });
  app.use((req, res, next) =>
    (['/api/backtest/import', '/api/history/contracts'].includes(req.path) ? importJson : smallJson)(
      req,
      res,
      next,
    ),
  );
  app.get("/api/state", (_req, res) => res.json(controller.snapshot(csrf)));
  app.get('/api/setup/network', async (_req, res) => res.json(await setup.read()));
  app.post('/api/setup/network', (req, res) => res.json(setup.save(req.body)));
  app.post('/api/setup/proxy', async (req, res) => {
    if (controller.session && ['armed', 'preparing', 'running', 'stopping', 'blocked'].includes(controller.session.status)) {
      return res.status(409).json({ error: 'Stop and flatten the active strategy session before changing outbound IP routing.' });
    }
    if (controller.connected()) {
      return res.status(409).json({ error: 'Disconnect mStock before changing outbound execution IP routing.' });
    }
    try {
      const result = await setup.saveProxy(req.body?.proxyUrl, { allowOperatorRoutes: appNetwork?.allowPrivateProxy });
      applyEgress(result.routeUrl);
      setup.setObserve(observeForRoute(result.routeUrl), result.ipv4 ?? undefined);
      if (!result.routeUrl) {
        const refreshed = await setup.read();
        return res.json({ saved: true, ipv4: refreshed.observed?.ipv4 ?? null });
      }
      res.json({ saved: true, ipv4: result.ipv4 });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid proxy configuration.' });
    }
  });
  app.get('/api/strategy/settings', (req, res) => res.json({ saved: controller.strategySettings(req.query.strategy === 'sell' ? 'sell' : 'buy'), profiles: { buy: controller.strategySettings('buy'), sell: controller.strategySettings('sell') }, effective: controller.session?.settings ?? DEFAULT_SETTINGS, defaults: DEFAULT_SETTINGS }));
  app.post('/api/strategy/settings', (req, res) => { const saved = controller.saveStrategySettings(req.body); repository.put(directionOf(saved) === 'sell' ? 'strategy:settings:sell' : 'strategy:settings', saved); res.json({ saved, appliesTo: 'next trading day; today retains the same saved day-session' }); });
  app.get('/api/audit', async (_req, res) => res.json(await audit.read()));
  app.get('/api/audit/export', async (_req, res) => res.set('Content-Disposition', 'attachment; filename="009-account-audit.json"').json(await audit.read()));
  app.get('/api/broker/diagnostics', async (_req, res) => {
    if (!controller.connected()) return res.status(409).json({ error: 'Connect mStock before running account checks.' });
    res.json(await accountDiagnostics.read());
  });
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, service: "nifty-009" }),
  );
  app.get("/api/backtest/dates", (_req, res) =>
    res.json({ dates: backtests.dates() }),
  );
  app.get('/api/backtest/latest', (_req, res) => res.json({ job: backtests.latest() }));
  app.post('/api/history/fetch', (req, res) => res.status(202).json(historical.start(req.body)));
  app.get('/api/history/latest', (_req, res) => res.json({ job: historical.latest() }));
  app.get('/api/history/jobs/:id', (req, res) => res.json(historical.job(String(req.params.id))));
  app.get('/api/history/jobs/:id/data', (req, res) => {
    const bundle = historical.bundle(String(req.params.id));
    res.set('Content-Disposition', `attachment; filename="009-history-${bundle.job.startDate ?? bundle.job.rows[0]?.date ?? 'saved'}-${bundle.job.endDate ?? bundle.job.rows.at(-1)?.date ?? 'data'}.json"`).json(bundle);
  });
  app.post('/api/history/contracts', (req, res) => res.json(historical.importContracts(req.body)));
  app.get('/api/history/contracts/schema', (_req, res) => res.set('Content-Disposition', 'attachment; filename="009-historical-contracts.schema.json"').json(CONTRACT_SCHEMA));
  app.get('/api/history/spot/:date', (req, res) => {
    const saved = historical.spot(String(req.params.date));
    if (!saved) return res.status(404).json({ error: 'No NIFTY spot history has been downloaded for this date.' });
    res.set('Content-Disposition', `attachment; filename="009-nifty-${saved.date}.json"`).json(saved);
  });
  app.get("/api/backtest/schema", (_req, res) => {
    res
      .set(
        "Content-Disposition",
        'attachment; filename="009-candles.schema.json"',
      )
      .json(DATASET_SCHEMA);
  });
  app.post("/api/backtest/import", (req, res) =>
    res.json(backtests.import(req.body)),
  );
  app.post("/api/backtest/run", (req, res) =>
    res.status(202).json(backtests.start(req.body)),
  );
  app.get("/api/backtest/jobs/:id", (req, res) =>
    res.json(backtests.job(String(req.params.id))),
  );
  app.get("/api/backtest/jobs/:id/data/:date", (req, res) => {
    const saved = backtests.jobDataset(
      String(req.params.id),
      String(req.params.date),
    );
    if (!saved)
      return res
        .status(404)
        .json({ error: "No tested dataset for this run and date." });
    res
      .set(
        "Content-Disposition",
        `attachment; filename="009-candles-${saved.date}.json"`,
      )
      .json(saved);
  });
  for (const kind of ['trades', 'daily'] as const) {
    app.get(`/api/backtest/jobs/:id/${kind}.csv`, (req, res) => {
      const job = backtests.job(String(req.params.id));
      if (!job.result) return res.status(409).json({ error: 'Wait for the backtest to complete.' });
      const report = kind === 'trades' ? backtestTradesReport(job.result, job.id) : backtestDaysReport(job.result);
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${report.filename}"` }).send(report.body);
    });
  }
  app.get("/api/backtest/archive/:date", (req, res) => {
    const saved = backtests.archive(String(req.params.date));
    if (!saved)
      return res.status(404).json({ error: "No saved dataset for this date." });
    res
      .set(
        "Content-Disposition",
        `attachment; filename="009-candles-${saved.date}.json"`,
      )
      .json(saved);
  });
  app.get("/api/market/chart", async (req, res) => {
    const symbol = req.query.symbol ?? "NIFTY";
    if (symbol !== "NIFTY" && symbol !== "CE" && symbol !== "PE")
      return res.status(400).json({ error: "Choose NIFTY, CE or PE." });
    if (!controller.connected())
      return res
        .status(409)
        .json({ error: "Connect mStock to view market data." });
    res.json(await charts.read(symbol));
  });
  app.get("/api/events", (req, res) => {
    res.set({ "Content-Type": "text/event-stream", Connection: "keep-alive" });
    res.flushHeaders();
    res.write(`data: ${JSON.stringify(controller.snapshot())}\n\n`);
    subscribers.add(res);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      subscribers.delete(res);
    });
  });
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  controller.onChange = () => {
    if (sendTimer) return;
    sendTimer = setTimeout(() => {
      sendTimer = null;
      const event = `data: ${JSON.stringify(controller.snapshot())}\n\n`;
      for (const res of subscribers)
        if (!res.write(event)) {
          subscribers.delete(res);
          res.end();
        }
    }, 150);
  };
  let loginAttempts: number[] = [];
  const field = (body: unknown, key: string, max = 256): string => {
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid request body.");
    const value = (body as Record<string, unknown>)[key];
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new Error(`Enter a valid ${key}.`);
    return value;
  };
  const reserveLoginAttempt = () => {
    loginAttempts = loginAttempts.filter((at) => Date.now() - at < 60_000);
    if (loginAttempts.length >= 5) return false;
    loginAttempts.push(Date.now());
    return true;
  };
  app.post('/api/broker/totp', async (req, res) => {
    if (!reserveLoginAttempt()) return res.status(429).json({ error: 'Wait one minute before another login attempt.' });
    if (typeof req.body.useSaved !== 'boolean') throw new Error('Choose saved connection or new API key.');
    const flowId = await controller.beginTotp(req.body.useSaved ? undefined : field(req.body, 'apiKey', 1024).trim());
    res.json({ flowId });
  });
  app.post("/api/broker/login", async (req, res) => {
    if (!reserveLoginAttempt()) return res.status(429).json({ error: 'Wait one minute before another login attempt.' });
    const flowId = await controller.beginLogin(
      field(req.body, "username", 64).trim(),
      field(req.body, "password"),
      field(req.body, "apiKey", 1024).trim(),
    );
    res.json({ flowId });
  });
  app.post("/api/broker/verify", async (req, res) => {
    const method = field(req.body, "method"),
      code = field(req.body, "code", 6);
    if (!["otp", "totp"].includes(method) || !/^\d{6}$/.test(code))
      throw new Error("Enter the current six-digit OTP or authenticator code.");
    await controller.verifyLogin(
      field(req.body, "flowId", 64),
      code,
      method as "otp" | "totp",
    );
    res.json({ ok: true });
  });
  app.post('/api/broker/recheck', async (_req, res) => { await controller.recheckConnection(); res.json({ ok: true }); });
  app.post("/api/broker/disconnect", async (_req, res) => {
    await controller.disconnect();
    res.json({ ok: true });
  });
  app.post("/api/strategy/start", async (req, res) => {
    const mode = field(req.body, "mode");
    if (!["paper", "live"].includes(mode))
      throw new Error("Choose Paper or Live mode.");
    if (mode === "live" && req.body.liveAcknowledged !== true)
      throw new Error("Confirm live orders before starting.");
    const direction = req.body.strategy ?? 'buy';
    if (!['buy', 'sell'].includes(direction)) throw new Error('Choose the Buy or Sell strategy.');
    await controller.start(mode as "paper" | "live", direction);
    res.status(202).json({ ok: true });
  });
  app.post("/api/strategy/stop", async (_req, res) => {
    await controller.stop();
    res.status(202).json({ ok: true });
  });
  app.post("/api/strategy/reconcile", async (_req, res) => {
    await controller.reconcile();
    res.json({ ok: true });
  });
  for (const kind of ['trades', 'orders'] as const) {
    app.get(`/api/${kind}.csv`, (_req, res) => {
      const report = kind === 'trades' ? tradesReport(controller.session) : ordersReport(controller.session);
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${report.filename}"` }).send(report.body);
    });
  }
  const dist = join(root, "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/", (_req, res) => res.sendFile(join(dist, "index.html")));
  } else
    app.get("/", (_req, res) =>
      res.status(503).send("Run npm run build first, or use npm run dev."),
    );
  app.use(((error, _req, res, _next) => {
    const message =
      error instanceof Error
        ? error.message
        : "The request could not be completed.";
    res.status(400).json({ error: message.slice(0, 300) });
  }) as ErrorRequestHandler);
  return app;
}
