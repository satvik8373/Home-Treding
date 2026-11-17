// Native Official Live Score & Lock Screen Widget Controller
// Supports:
// 1. Google Cricket-Style Lock Screen Live Card (Image 2 reference)
//    - iOS (iPhone): Universal Lock Screen Live Card via navigator.mediaSession + Artwork Canvas
//    - Android & Desktop: Persistent in-place Service Worker notification
// 2. Pin Floating Live Widget (Image 1 reference)
//    - W3C Document Picture-in-Picture (Chromium Desktop & Android)
//    - iOS WebKit Video Presentation Mode PiP (Safari on iPhone/iPad)
// 3. Home Screen PWA Badging API

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
let silentAudio: HTMLAudioElement | null = null;
let latestArtworkBlobUrl: string | null = null;
let latestData: LiveScoreData | null = null;
let squareOffCallback: (() => void) | null = null;
let lockScreenActive = false;
let lastNotifTitle = '';
let lastNotifBody = '';
let lastNotifTime = 0;
const MIN_NOTIF_INTERVAL_MS = 4000;

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isLockScreenSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // On iOS, Lock Screen Live Card is universally supported via MediaSession API
  if ('mediaSession' in navigator) return true;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function isFloatingWidgetSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if ('documentPictureInPicture' in window) return true;
  if ('pictureInPictureEnabled' in document && document.pictureInPictureEnabled) return true;

  // iOS Safari presentation mode check
  const v = document.createElement('video') as HTMLVideoElement & {
    webkitSupportsPresentationMode?: (mode: string) => boolean;
  };
  if (typeof v.webkitSupportsPresentationMode === 'function' && v.webkitSupportsPresentationMode('picture-in-picture')) {
    return true;
  }

  // Universal fallback: iOS Lock Screen Live Card
  if ('mediaSession' in navigator) return true;

  return false;
}

export async function requestLockScreenAccess(): Promise<boolean> {
  // On iOS, mediaSession needs zero permissions; user gesture starts it
  if (isIOS() && 'mediaSession' in navigator) {
    ensureSilentAudioPlaying();
    return true;
  }
  if (!('Notification' in window)) return true;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function setLockScreenActive(active: boolean) {
  lockScreenActive = active;
  if (!active) {
    void clearLockScreenNotification();
  } else {
    ensureSilentAudioPlaying();
    if (latestData) {
      void updateLockScreenNotification(latestData);
    }
  }
}

export function isLockScreenActive(): boolean {
  return lockScreenActive;
}

export function isFloatingActive(): boolean {
  if (activeDocPiP && !activeDocPiP.closed) return true;
  if (activeVideo) {
    const v = activeVideo as HTMLVideoElement & { webkitPresentationMode?: string };
    if (v.webkitPresentationMode === 'picture-in-picture') return true;
    if (document.pictureInPictureElement === activeVideo) return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// 1. Silent Background Audio for iOS Lock Screen Card Persistence
// --------------------------------------------------------------------------

function ensureSilentAudioPlaying() {
  if (typeof window === 'undefined') return;
  try {
    if (!silentAudio) {
      silentAudio = new Audio();
      silentAudio.src = '/silent.wav';
      silentAudio.loop = true;
      silentAudio.preload = 'auto';
      silentAudio.crossOrigin = 'anonymous';
      silentAudio.volume = 0.05;
      silentAudio.setAttribute('playsinline', '');
      silentAudio.setAttribute('webkit-playsinline', '');
    }
    if (silentAudio.paused) {
      const playPromise = silentAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          // If WAV fails or is blocked, try MP3 fallback
          if (silentAudio) {
            silentAudio.src = '/silent.mp3';
            void silentAudio.play().catch(() => {});
          }
        });
      }
    }
  } catch (err) {
    console.warn('Silent audio init error:', err);
  }
}

function stopSilentAudio() {
  if (silentAudio && !silentAudio.paused) {
    silentAudio.pause();
    silentAudio.currentTime = 0;
  }
}

// --------------------------------------------------------------------------
// 2. High-Res Artwork Generator for iPhone Lock Screen (Image 2 & 3 Reference)
// --------------------------------------------------------------------------

function generateMatchBarArtwork(data: LiveScoreData): void {
  if (typeof document === 'undefined') return;
  try {
    const artCanvas = document.createElement('canvas');
    artCanvas.width = 512;
    artCanvas.height = 512;
    const ctx = artCanvas.getContext('2d');
    if (!ctx) return;

    // Background - OLED Pitch Black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);

    // Outer Lock Screen Capsule (matching iPhone 13 OLED card in Image 3)
    ctx.fillStyle = '#0A0F1D';
    ctx.beginPath();
    ctx.roundRect(16, 120, 480, 272, 32);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top Center Brand Badge (Google-style logo / Monogram)
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(256, 150, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 16px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('M', 256, 156);

    // Status Pill: ● LIVE or Stumps
    ctx.beginPath();
    ctx.roundRect(206, 172, 100, 26, 13);
    ctx.fillStyle = data.running ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)';
    ctx.fill();
    ctx.strokeStyle = data.running ? '#10B981' : '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = data.running ? '#10B981' : '#F59E0B';
    ctx.font = 'bold 13px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.running ? '● LIVE' : 'Stumps', 256, 189);

    // Center Main Net P&L
    ctx.textAlign = 'center';
    const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
    const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';
    ctx.fillStyle = data.total != null && data.total > 0 ? '#10B981' : data.total != null && data.total < 0 ? '#EF4444' : '#F8FAFC';
    ctx.font = '800 48px -apple-system, system-ui, sans-serif';
    ctx.fillText(pnlFormatted, 256, 260);

    // Center Index / Subtitle (matching ICC in Image 3)
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 17px -apple-system, system-ui, sans-serif';
    const spotText = `${data.spotPrice != null ? `SPOT ₹${data.spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'NIFTY 50'} · ${data.mode.toUpperCase()}`;
    ctx.fillText(spotText, 256, 292);

    // Left Side: CALL (CE) Team
    ctx.textAlign = 'left';
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.roundRect(36, 195, 50, 50, 12);
    ctx.fill();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#34D399';
    ctx.font = '800 20px -apple-system, system-ui, sans-serif';
    ctx.fillText('CE', 48, 227);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 24px -apple-system, system-ui, sans-serif';
    const cePrice = data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : 'Watch';
    ctx.fillText(cePrice, 36, 280);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 15px -apple-system, system-ui, sans-serif';
    ctx.fillText(data.ceStrike ? `(${data.ceStrike})` : '(ATM)', 36, 305);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
    ctx.fillText('CALL', 36, 350);

    // Right Side: PUT (PE) Team
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.roundRect(426, 195, 50, 50, 12);
    ctx.fill();
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F87171';
    ctx.font = '800 20px -apple-system, system-ui, sans-serif';
    ctx.fillText('PE', 464, 227);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 24px -apple-system, system-ui, sans-serif';
    const pePrice = data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : 'Watch';
    ctx.fillText(pePrice, 476, 280);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 15px -apple-system, system-ui, sans-serif';
    ctx.fillText(data.peStrike ? `(${data.peStrike})` : '(ATM)', 476, 305);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
    ctx.fillText('PUT', 476, 350);

    // Bottom Center Tournament / Engine Label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
    ctx.fillText('MAVRIX 009 BREAKOUT', 256, 350);

    // Convert to ObjectURL blob
    artCanvas.toBlob(blob => {
      if (blob) {
        if (latestArtworkBlobUrl) {
          try {
            URL.revokeObjectURL(latestArtworkBlobUrl);
          } catch {
            // ignore
          }
        }
        latestArtworkBlobUrl = URL.createObjectURL(blob);
      }
    }, 'image/png');
  } catch (err) {
    console.warn('Failed to generate match bar artwork:', err);
  }
}

// --------------------------------------------------------------------------
// 3. Lock Screen Live Score (Universal iOS & Android Flow)
// --------------------------------------------------------------------------

export async function updateLockScreenNotification(data: LiveScoreData): Promise<void> {
  latestData = data;
  if (!lockScreenActive) return;

  const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
  const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const spotText = data.spotPrice != null ? `₹${data.spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
  const ceText = data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : 'Watch';
  const peText = data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : 'Watch';

  // Branch A: iOS Lock Screen Live Card via navigator.mediaSession (Image 3 reference)
  if ('mediaSession' in navigator) {
    try {
      ensureSilentAudioPlaying();
      generateMatchBarArtwork(data);

      if (navigator.mediaSession) {
        navigator.mediaSession.playbackState = data.running ? 'playing' : 'paused';

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const artworkItems: MediaImage[] = [
          { src: `${origin}/brand/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${origin}/brand/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${origin}/brand/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' },
          { src: `${origin}/mavrix-icon.jpg`, sizes: '512x512', type: 'image/jpeg' }
        ];

        if (latestArtworkBlobUrl) {
          artworkItems.unshift({ src: latestArtworkBlobUrl, sizes: '512x512', type: 'image/png' });
        }

        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${data.running ? '● LIVE' : 'Stumps'} · P&L: ${pnlFormatted}`,
          artist: `CE ${ceText} (${data.ceStrike ?? 'ATM'}) vs PE ${peText} (${data.peStrike ?? 'ATM'})`,
          album: `NIFTY SPOT ${spotText} · ${data.mode.toUpperCase()}`,
          artwork: artworkItems
        });

        // Required iOS MediaSession handlers to maintain lock screen card
        navigator.mediaSession.setActionHandler('play', () => {
          ensureSilentAudioPlaying();
          if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (silentAudio) silentAudio.pause();
          if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused';
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          if (squareOffCallback) squareOffCallback();
          void clearLockScreenNotification();
        });
      }
    } catch (err) {
      console.warn('iOS MediaSession update failed:', err);
    }
  }

  // Branch B: Android & Desktop Service Worker Notification
  if ('Notification' in window && 'serviceWorker' in navigator && Notification.permission === 'granted') {
    try {
      const statusEmoji = data.running ? '🟢' : '⚪';
      const title = `${statusEmoji} MAVRIX · P&L: ${pnlFormatted} (${data.mode.toUpperCase()})`;
      const body = `NIFTY: ${spotText} | ATM: ${data.atm ?? 'Auto'}\nCALL: ${ceText} · PUT: ${peText}`;

      // Deduplicate: If notification text is unchanged, do not re-show
      if (title === lastNotifTitle && body === lastNotifBody) {
        return;
      }

      const now = Date.now();
      if (lastNotifTime > 0 && now - lastNotifTime < MIN_NOTIF_INTERVAL_MS) {
        return;
      }

      lastNotifTitle = title;
      lastNotifBody = body;
      lastNotifTime = now;

      const reg = await navigator.serviceWorker.ready;
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

      if ('setAppBadge' in navigator && data.total != null) {
        const badgeUnits = Math.round(Math.abs(data.total) / 100);
        void navigator.setAppBadge(badgeUnits || 1).catch(() => {});
      }
    } catch (err) {
      console.warn('Failed to update lock screen notification:', err);
    }
  }
}

export async function clearLockScreenNotification(): Promise<void> {
  lastNotifTitle = '';
  lastNotifBody = '';
  lastNotifTime = 0;
  stopSilentAudio();

  if (latestArtworkBlobUrl) {
    try {
      URL.revokeObjectURL(latestArtworkBlobUrl);
    } catch {
      // ignore
    }
    latestArtworkBlobUrl = null;
  }

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
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
}

// --------------------------------------------------------------------------
// 4. Pin Floating Live Widget (Picture-in-Picture & Universal Video PiP)
// --------------------------------------------------------------------------

export async function openFloatingLiveScore(data: LiveScoreData, onSquareOff?: () => void): Promise<boolean> {
  latestData = data;
  if (onSquareOff) squareOffCallback = onSquareOff;

  // Always activate Lock Screen Card alongside Floating Widget
  setLockScreenActive(true);

  // Method A: Official W3C Document Picture-in-Picture (Chromium Desktop & Android)
  if ('documentPictureInPicture' in window) {
    try {
      const pip = (window as unknown as { documentPictureInPicture: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      const pipWin = await pip.requestWindow({ width: 340, height: 160 });
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
      `;
      pipWin.document.head.appendChild(style);

      renderDocPiP(pipWin, data);

      pipWin.addEventListener('pagehide', () => {
        activeDocPiP = null;
      });

      return true;
    } catch (err) {
      console.warn('Document PiP request failed, falling back:', err);
    }
  }

  // Method B: Universal Video PiP (Supports iOS Safari & Desktop Video PiP)
  try {
    if (!activeCanvas) {
      activeCanvas = document.createElement('canvas');
      activeCanvas.width = 640;
      activeCanvas.height = 360;
    }
    if (!activeVideo) {
      activeVideo = document.createElement('video');
      activeVideo.muted = true;
      activeVideo.autoplay = true;
      activeVideo.playsInline = true;
      activeVideo.setAttribute('playsinline', '');
      activeVideo.setAttribute('webkit-playsinline', '');
    }

    // Attach video to DOM with layout dimensions (WebKit requires visible non-zero dimensions)
    if (!document.body.contains(activeVideo)) {
      activeVideo.style.position = 'fixed';
      activeVideo.style.bottom = '12px';
      activeVideo.style.right = '12px';
      activeVideo.style.width = '140px';
      activeVideo.style.height = '80px';
      activeVideo.style.borderRadius = '10px';
      activeVideo.style.zIndex = '999999';
      activeVideo.style.background = '#000000';
      activeVideo.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5)';
      activeVideo.style.pointerEvents = 'auto';
      document.body.appendChild(activeVideo);
    }

    drawCanvasPiP(activeCanvas, data);

    const canvasWithCapture = activeCanvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream };
    if (typeof canvasWithCapture.captureStream === 'function') {
      const stream = canvasWithCapture.captureStream(15);
      activeVideo.srcObject = stream;

      const v = activeVideo as HTMLVideoElement & {
        webkitSupportsPresentationMode?: (mode: string) => boolean;
        webkitSetPresentationMode?: (mode: string) => void;
      };

      // iOS WebKit PiP method (trigger synchronously inside user gesture)
      if (typeof v.webkitSetPresentationMode === 'function') {
        v.webkitSetPresentationMode('picture-in-picture');
        void activeVideo.play().catch(() => {});
        return true;
      }

      // Standard HTML5 PiP method
      if ('requestPictureInPicture' in activeVideo) {
        await activeVideo.play().catch(() => {});
        await activeVideo.requestPictureInPicture();
        return true;
      }
    }
  } catch (err) {
    console.warn('Video PiP failed:', err);
  }

  // Universal iOS fallback: Lock Screen Live Card is already activated!
  if (isIOS() || 'mediaSession' in navigator) {
    return true;
  }

  return false;
}

export function updateFloatingLiveScore(data: LiveScoreData): void {
  latestData = data;

  if (activeDocPiP && !activeDocPiP.closed) {
    renderDocPiP(activeDocPiP, data);
  }

  if (activeCanvas && activeVideo) {
    const v = activeVideo as HTMLVideoElement & { webkitPresentationMode?: string };
    if (v.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === activeVideo) {
      drawCanvasPiP(activeCanvas, data);
    }
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
    const v = activeVideo as HTMLVideoElement & { webkitSetPresentationMode?: (mode: string) => void };
    if (typeof v.webkitSetPresentationMode === 'function') {
      v.webkitSetPresentationMode('inline');
    }
    activeVideo.srcObject = null;
    if (document.body.contains(activeVideo)) {
      document.body.removeChild(activeVideo);
    }
    activeVideo = null;
  }
  setLockScreenActive(false);
}

// --------------------------------------------------------------------------
// 5. Internal Renderers
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
