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
    const reg = await navigator.serviceWorker.ready;
    const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
    const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
    const spotText = data.spotPrice != null ? `₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}` : '—';
    const statusEmoji = data.running ? '🟢' : '⚪';

    const ceText = data.ceStrike ? `CE ${data.ceStrike}: ${data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : data.ceStatus || 'Flat'}` : 'CE: Flat';
    const peText = data.peStrike ? `PE ${data.peStrike}: ${data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : data.peStatus || 'Flat'}` : 'PE: Flat';

    const title = `${statusEmoji} MAVRIX · P&L: ${pnlFormatted} (${data.mode.toUpperCase()})`;
    const body = `NIFTY: ${spotText} | ATM: ${data.atm ?? 'Auto'}\n${ceText} · ${peText}`;

    // tag: 'mavrix-live-score' ensures OS updates in-place like a sports score
    // renotify: false ensures silent update without vibrating on every tick
    const notifOptions: NotificationOptions & { renotify?: boolean; actions?: Array<{ action: string; title: string }> } = {
      body,
      tag: 'mavrix-live-score',
      renotify: false,
      silent: true,
      icon: '/mavrix-icon.jpg',
      badge: '/mavrix-icon.jpg',
      requireInteraction: data.running,
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

      pipWin.document.title = 'Mavrix Live Score';
      const style = pipWin.document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; user-select: none; }
        body { background: #0B0F17; color: #FFFFFF; padding: 12px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
        .pip-header { display: flex; align-items: center; justify-content: space-between; }
        .pip-brand { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #94A3B8; }
        .pip-dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981; animation: pulse 1.5s infinite; }
        .pip-dot.stopped { background: #64748B; animation: none; }
        .pip-mode { font-size: 9px; font-weight: 700; background: #1E293B; padding: 2px 6px; border-radius: 4px; color: #94A3B8; }
        .pip-balance { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; margin: 4px 0; }
        .pip-balance.positive { color: #10B981; }
        .pip-balance.negative { color: #EF4444; }
        .pip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #151D2A; padding: 6px 8px; border-radius: 6px; font-size: 10px; }
        .pip-cell { display: flex; flex-direction: column; }
        .pip-cell span { color: #64748B; font-size: 9px; }
        .pip-cell strong { color: #F1F5F9; font-weight: 600; }
        .pip-btn { width: 100%; margin-top: 6px; background: #EF4444; color: #FFFFFF; border: 0; border-radius: 6px; padding: 6px; font-size: 11px; font-weight: 700; cursor: pointer; }
        .pip-btn:active { opacity: 0.8; }
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
  const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const isPos = data.total != null && data.total > 0;
  const isNeg = data.total != null && data.total < 0;

  win.document.body.innerHTML = `
    <div class="pip-header">
      <div class="pip-brand">
        <div class="pip-dot ${data.running ? '' : 'stopped'}"></div>
        <span>MAVRIX 009</span>
      </div>
      <span class="pip-mode">${data.mode.toUpperCase()} · ${data.running ? 'RUNNING' : 'IDLE'}</span>
    </div>

    <div class="pip-balance ${isPos ? 'positive' : isNeg ? 'negative' : ''}">
      ${pnlFormatted}
    </div>

    <div class="pip-grid">
      <div class="pip-cell">
        <span>NIFTY SPOT</span>
        <strong>${data.spotPrice != null ? `₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}` : '—'}</strong>
      </div>
      <div class="pip-cell">
        <span>LOCKED ATM</span>
        <strong>${data.atm ? `${data.atm}` : 'Auto (09:20)'}</strong>
      </div>
      <div class="pip-cell">
        <span>CALL ${data.ceStrike ?? 'ATM'}</span>
        <strong>${data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : data.ceStatus || 'Flat'}</strong>
      </div>
      <div class="pip-cell">
        <span>PUT ${data.peStrike ?? 'ATM'}</span>
        <strong>${data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : data.peStatus || 'Flat'}</strong>
      </div>
    </div>

    ${data.running ? '<button id="pip-stop-btn" class="pip-btn">Square Off & Stop</button>' : ''}
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
  ctx.fillStyle = '#0B0F17';
  ctx.fillRect(0, 0, w, h);

  // Card outline
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Top Bar
  ctx.fillStyle = data.running ? '#10B981' : '#64748B';
  ctx.beginPath();
  ctx.arc(28, 36, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('MAVRIX 009 ALGO', 46, 44);

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  const modeStr = `${data.mode.toUpperCase()} · ${data.running ? 'RUNNING' : 'IDLE'}`;
  ctx.fillText(modeStr, w - ctx.measureText(modeStr).width - 24, 44);

  // Big P&L Value
  const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
  const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';
  ctx.fillStyle = data.total != null && data.total > 0 ? '#10B981' : data.total != null && data.total < 0 ? '#EF4444' : '#F8FAFC';
  ctx.font = '800 58px system-ui, -apple-system, sans-serif';
  ctx.fillText(pnlFormatted, 24, 125);

  // Subtitle
  ctx.fillStyle = '#64748B';
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Net Session P&L · Open: ${data.openPnl != null ? `₹${data.openPnl.toFixed(0)}` : '—'} · Realized: ${data.realized != null ? `₹${data.realized.toFixed(0)}` : '—'}`, 24, 155);

  // 4 Boxes container
  ctx.fillStyle = '#151D2A';
  ctx.beginPath();
  ctx.roundRect(20, 180, w - 40, 155, 12);
  ctx.fill();

  const drawCell = (label: string, val: string, x: number, y: number) => {
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(val, x, y + 30);
  };

  const spotText = data.spotPrice != null ? `₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}` : '—';
  const atmText = data.atm ? `${data.atm}` : 'Auto';
  const ceVal = data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : data.ceStatus || 'Flat';
  const peVal = data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : data.peStatus || 'Flat';

  drawCell('NIFTY SPOT', spotText, 40, 215);
  drawCell('LOCKED ATM', atmText, 320, 215);
  drawCell(`CALL ${data.ceStrike ?? 'ATM'}`, ceVal, 40, 285);
  drawCell(`PUT ${data.peStrike ?? 'ATM'}`, peVal, 320, 285);
}
