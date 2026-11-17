// Native Official Live Score & Lock Screen Widget Controller
// Supports:
// 1. Lock Screen Live Score (Persistent in-place updating notifications like Google sports match score)
// 2. Pin Floating Live Widget (W3C Document Picture-in-Picture & Canvas Stream PiP for all mobile/desktop browsers)
// 3. Home Screen App Badging API

export type LiveScoreData = {
  running: boolean;
  status: string;
  mode: 'paper' | 'live';
  total: number | null;
  openPnl: number | null;
  realized: number | null;
  spotPrice: number | null;
  atm: number | null;
  ceStrike?: number | null;
  cePrice?: number | null;
  ceStatus?: string;
  peStrike?: number | null;
  pePrice?: number | null;
  peStatus?: string;
  updatedAt: number;
};

let activeDocPiP: Window | null = null;
let activeCanvas: HTMLCanvasElement | null = null;
let activeVideo: HTMLVideoElement | null = null;
let latestData: LiveScoreData | null = null;
let squareOffCallback: (() => void) | null = null;
let lockScreenActive = false;
let lastNotifTitle = '';
let lastNotifBody = '';
let lastNotifTime = 0;
const MIN_NOTIF_INTERVAL_MS = 4000;

export function isLockScreenSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function isFloatingWidgetSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // Official Document PiP (Chrome 116+) or Canvas Video PiP fallback
  return 'documentPictureInPicture' in window || 'pictureInPictureEnabled' in document;
}

export async function requestLockScreenAccess(): Promise<boolean> {
  if (!isLockScreenSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function setLockScreenActive(active: boolean) {
  lockScreenActive = active;
  if (!active) {
    void clearLockScreenNotification();
  } else if (latestData) {
    void updateLockScreenNotification(latestData);
  }
}

export function isLockScreenActive(): boolean {
  return lockScreenActive;
}

export function isFloatingActive(): boolean {
  return !!activeDocPiP || (activeVideo != null && document.pictureInPictureElement === activeVideo);
}

// --------------------------------------------------------------------------
// 1. Lock Screen Live Score (Like Google Live Cricket Score)
// --------------------------------------------------------------------------

export async function updateLockScreenNotification(data: LiveScoreData): Promise<void> {
  latestData = data;
  if (!lockScreenActive || !isLockScreenSupported() || Notification.permission !== 'granted') return;

  try {
    const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
    const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
    const spotText = data.spotPrice != null ? `₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}` : '—';
    const statusEmoji = data.running ? '🟢' : '⚪';

    const ceText = data.ceStrike ? `CE ${data.ceStrike}: ${data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : data.ceStatus || 'Flat'}` : 'CE: Flat';
    const peText = data.peStrike ? `PE ${data.peStrike}: ${data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : data.peStatus || 'Flat'}` : 'PE: Flat';

    const title = `${statusEmoji} MAVRIX · P&L: ${pnlFormatted} (${data.mode.toUpperCase()})`;
    const body = `NIFTY: ${spotText} | ATM: ${data.atm ?? 'Auto'}\n${ceText} · ${peText}`;

    // Deduplicate: If notification text is unchanged, do not re-show
    if (title === lastNotifTitle && body === lastNotifBody) {
      return;
    }

    const now = Date.now();
    // Throttle: ensure at least MIN_NOTIF_INTERVAL_MS between updates to prevent rapid popups
    if (lastNotifTime > 0 && now - lastNotifTime < MIN_NOTIF_INTERVAL_MS) {
      return;
    }

    lastNotifTitle = title;
    lastNotifBody = body;
    lastNotifTime = now;

    const reg = await navigator.serviceWorker.ready;

    // tag: 'mavrix-live-score' ensures OS keeps one pinned card in notification tray
    // renotify: false ensures silent update without vibrating or heads-up popups
    // requireInteraction: false ensures it stays pinned silently in tray, not popping up as an alert
    const notifOptions: NotificationOptions & { renotify?: boolean; actions?: Array<{ action: string; title: string }> } = {
      body,
      tag: 'mavrix-live-score',
      renotify: false,
      silent: true,
      requireInteraction: false,
      icon: '/mavrix-icon.jpg',
      badge: '/mavrix-icon.jpg',
      data: { url: '/' },
      actions: data.running
        ? [
            { action: 'stop', title: 'Square Off & Stop' },
            { action: 'open', title: 'Open Dashboard' }
          ]
        : [{ action: 'open', title: 'Open Dashboard' }]
    };
    await reg.showNotification(title, notifOptions);

    // Update app icon badge if supported
    if ('setAppBadge' in navigator && data.total != null) {
      const badgeUnits = Math.round(Math.abs(data.total) / 100);
      void navigator.setAppBadge(badgeUnits || 1).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to update lock screen live score notification:', err);
  }
}

export async function clearLockScreenNotification(): Promise<void> {
  lastNotifTitle = '';
  lastNotifBody = '';
  lastNotifTime = 0;
  if (!isLockScreenSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const notifications = await reg.getNotifications({ tag: 'mavrix-live-score' });
    notifications.forEach(n => n.close());
    if ('clearAppBadge' in navigator) {
      void navigator.clearAppBadge().catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to clear lock screen notification:', err);
  }
}

// --------------------------------------------------------------------------
// 2. Pin Floating Live Widget (Picture-in-Picture)
// --------------------------------------------------------------------------

export async function openFloatingLiveScore(data: LiveScoreData, onSquareOff?: () => void): Promise<boolean> {
  latestData = data;
  if (onSquareOff) squareOffCallback = onSquareOff;

  // Method A: Official W3C Document Picture-in-Picture (Chrome Desktop & Android)
  if ('documentPictureInPicture' in window) {
    try {
      const pip = (window as unknown as { documentPictureInPicture: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      const pipWin = await pip.requestWindow({ width: 320, height: 180 });
      activeDocPiP = pipWin;

      pipWin.document.title = 'Mavrix Match Score';
      const style = pipWin.document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; user-select: none; }
        body { background: #000000; color: #FFFFFF; padding: 10px 12px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
        .pip-topbar { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94A3B8; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 5px; }
        .pip-brand { display: flex; align-items: center; gap: 5px; }
        .pip-dot { width: 6px; height: 6px; border-radius: 50%; background: #64748B; }
        .pip-dot.running { background: #10B981; box-shadow: 0 0 6px #10B981; }
        .pip-pill { background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 6px; border-radius: 12px; font-size: 9px; }
        .pip-pill.pre { background: rgba(16, 185, 129, 0.15); color: #10B981; border-color: rgba(16, 185, 129, 0.3); }
        .pip-match-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin: 6px 0; }
        .pip-team { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .pip-team.put { justify-content: flex-end; text-align: right; }
        .pip-badge { width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center; font-weight: 800; font-size: 10px; flex-shrink: 0; }
        .pip-badge.call { background: #064E3B; color: #34D399; border: 1px solid #059669; }
        .pip-badge.put { background: #7F1D1D; color: #F87171; border: 1px solid #DC2626; }
        .pip-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .pip-meta.right { text-align: right; }
        .pip-strike { font-size: 9.5px; font-weight: 700; color: #94A3B8; white-space: nowrap; }
        .pip-price { font-size: 13px; font-weight: 800; color: #F8FAFC; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .pip-center { display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .pip-pnl { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; }
        .pip-pnl.positive { color: #10B981; }
        .pip-pnl.negative { color: #EF4444; }
        .pip-spot { font-size: 9px; color: #94A3B8; font-weight: 600; white-space: nowrap; }
        .pip-stop-btn { width: 100%; background: #DC2626; color: #FFFFFF; border: 0; border-radius: 6px; padding: 4px; font-size: 10.5px; font-weight: 700; cursor: pointer; }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } 100% { opacity: 1; transform: scale(1); } }
      `;
      pipWin.document.head.appendChild(style);

      renderDocPiP(pipWin, data);

      pipWin.addEventListener('pagehide', () => {
        activeDocPiP = null;
      });

      return true;
    } catch (err) {
      console.warn('Document PiP request failed, falling back to Canvas PiP:', err);
    }
  }

  // Method B: Universal Canvas Stream Picture-in-Picture (Mobile Safari, Android Chrome, Edge)
  if ('pictureInPictureEnabled' in document) {
    try {
      if (!activeCanvas) {
        activeCanvas = document.createElement('canvas');
        activeCanvas.width = 640;
        activeCanvas.height = 360;
      }
      if (!activeVideo) {
        activeVideo = document.createElement('video');
        activeVideo.muted = true;
        activeVideo.playsInline = true;
      }

      drawCanvasPiP(activeCanvas, data);

      const stream = activeCanvas.captureStream(10);
      activeVideo.srcObject = stream;
      await activeVideo.play();
      await activeVideo.requestPictureInPicture();

      activeVideo.addEventListener('leavepictureinpicture', () => {
        if (activeVideo) {
          activeVideo.srcObject = null;
        }
      });

      return true;
    } catch (err) {
      console.warn('Canvas Video PiP failed:', err);
      return false;
    }
  }

  return false;
}

export function updateFloatingLiveScore(data: LiveScoreData): void {
  latestData = data;

  if (activeDocPiP && !activeDocPiP.closed) {
    renderDocPiP(activeDocPiP, data);
  }

  if (activeCanvas && document.pictureInPictureElement === activeVideo) {
    drawCanvasPiP(activeCanvas, data);
  }

  if (lockScreenActive) {
    void updateLockScreenNotification(data);
  }
}

export async function closeFloatingLiveScore(): Promise<void> {
  if (activeDocPiP && !activeDocPiP.closed) {
    activeDocPiP.close();
    activeDocPiP = null;
  }
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture().catch(() => {});
  }
  if (activeVideo) {
    activeVideo.srcObject = null;
  }
}

// --------------------------------------------------------------------------
// Internal Renderers
// --------------------------------------------------------------------------

function renderDocPiP(win: Window, data: LiveScoreData) {
  const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
  const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';
  const isPos = data.total != null && data.total > 0;
  const isNeg = data.total != null && data.total < 0;

  win.document.body.innerHTML = `
    <div class="pip-match-container">
      <div class="pip-topbar">
        <div class="pip-brand">
          <span class="pip-dot ${data.running ? 'running' : ''}"></span>
          <span>NIFTY 50 · 009 BREAKOUT</span>
        </div>
        <span class="pip-pill ${data.running ? 'live' : 'pre'}">${data.running ? 'LIVE' : 'PRE'} · ${data.mode.toUpperCase()}</span>
      </div>

      <div class="pip-match-row">
        <div class="pip-team call">
          <div class="pip-badge call">CE</div>
          <div class="pip-meta">
            <span class="pip-strike">${data.ceStrike ? `CALL ${data.ceStrike}` : 'CALL ATM'}</span>
            <strong class="pip-price">${data.cePrice != null ? `₹${data.cePrice.toFixed(2)}` : 'Watching'}</strong>
          </div>
        </div>

        <div class="pip-center">
          <div class="pip-pnl ${isPos ? 'positive' : isNeg ? 'negative' : ''}">
            ${pnlFormatted}
          </div>
          <span class="pip-spot">${data.spotPrice != null ? `SPOT ₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}` : 'NIFTY'}</span>
        </div>

        <div class="pip-team put">
          <div class="pip-meta right">
            <span class="pip-strike">${data.peStrike ? `PUT ${data.peStrike}` : 'PUT ATM'}</span>
            <strong class="pip-price">${data.pePrice != null ? `₹${data.pePrice.toFixed(2)}` : 'Watching'}</strong>
          </div>
          <div class="pip-badge put">PE</div>
        </div>
      </div>

      ${data.running ? '<button id="pip-stop-btn" class="pip-stop-btn">Square Off & Stop</button>' : ''}
    </div>
  `;

  if (data.running) {
    const btn = win.document.getElementById('pip-stop-btn');
    if (btn) {
      btn.onclick = () => {
        if (squareOffCallback) squareOffCallback();
      };
    }
  }
}

function drawCanvasPiP(canvas: HTMLCanvasElement, data: LiveScoreData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  // Card outline
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Top Bar
  ctx.fillStyle = data.running ? '#10B981' : '#64748B';
  ctx.beginPath();
  ctx.arc(28, 36, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#CBD5E1';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('NIFTY 50 · 009 BREAKOUT', 44, 42);

  const statusTag = `${data.running ? 'LIVE' : 'PRE'} · ${data.mode.toUpperCase()}`;
  ctx.fillStyle = data.running ? '#F59E0B' : '#10B981';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  const tagWidth = ctx.measureText(statusTag).width;
  ctx.fillText(statusTag, w - tagWidth - 28, 42);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 60);
  ctx.lineTo(w - 20, 60);
  ctx.stroke();

  // Center P&L
  const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
  const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';
  ctx.fillStyle = data.total != null && data.total > 0 ? '#10B981' : data.total != null && data.total < 0 ? '#EF4444' : '#F8FAFC';
  ctx.font = '800 52px system-ui, -apple-system, sans-serif';
  const pnlWidth = ctx.measureText(pnlFormatted).width;
  ctx.fillText(pnlFormatted, (w - pnlWidth) / 2, 170);

  // Spot under center
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  const spotText = `${data.spotPrice != null ? `SPOT ₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}` : 'NIFTY'} · ATM ${data.atm ?? '09:20'}`;
  const spotWidth = ctx.measureText(spotText).width;
  ctx.fillText(spotText, (w - spotWidth) / 2, 205);

  // Left Side: CALL (CE) Team
  ctx.fillStyle = '#064E3B';
  ctx.beginPath();
  ctx.roundRect(28, 120, 56, 56, 10);
  ctx.fill();
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#34D399';
  ctx.font = '800 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('CE', 42, 155);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(data.ceStrike ? `CALL ${data.ceStrike}` : 'CALL ATM', 96, 138);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  const cePriceText = data.cePrice != null ? `₹${data.cePrice.toFixed(2)}` : 'Watching';
  ctx.fillText(cePriceText, 96, 168);

  // Right Side: PUT (PE) Team
  ctx.fillStyle = '#7F1D1D';
  ctx.beginPath();
  ctx.roundRect(w - 84, 120, 56, 56, 10);
  ctx.fill();
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#F87171';
  ctx.font = '800 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('PE', w - 70, 155);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  const peLabel = data.peStrike ? `PUT ${data.peStrike}` : 'PUT ATM';
  const peLabelWidth = ctx.measureText(peLabel).width;
  ctx.fillText(peLabel, w - 96 - peLabelWidth, 138);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  const pePriceText = data.pePrice != null ? `₹${data.pePrice.toFixed(2)}` : 'Watching';
  const pePriceWidth = ctx.measureText(pePriceText).width;
  ctx.fillText(pePriceText, w - 96 - pePriceWidth, 168);

  // Footer / Stats
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(20, 240, w - 40, 1);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  const footerText = `Open P&L: ${data.openPnl != null ? `₹${data.openPnl.toFixed(0)}` : '₹0'}  ·  Realized: ${data.realized != null ? `₹${data.realized.toFixed(0)}` : '₹0'}`;
  const footerWidth = ctx.measureText(footerText).width;
  ctx.fillText(footerText, (w - footerWidth) / 2, 275);
}
