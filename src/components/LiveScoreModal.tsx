import { useState, useEffect } from 'react';
import { Check, Pin, Plus, Smartphone, Sparkles, Square, Tv } from 'lucide-react';
import { Dialog } from './Dialog';
import type { LiveScoreData } from '../lib/liveScore';
import {
  isLockScreenSupported,
  isFloatingWidgetSupported,
  isLockScreenActive,
  setLockScreenActive,
  requestLockScreenAccess,
  openFloatingLiveScore,
  closeFloatingLiveScore,
  isFloatingActive,
} from '../lib/liveScore';

type Props = {
  open: boolean;
  onClose: () => void;
  data: LiveScoreData;
  onSquareOff: () => void;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function LiveScoreModal({ open, onClose, data, onSquareOff }: Props) {
  const [lockScreenOn, setLockScreenOn] = useState(isLockScreenActive());
  const [floatingOn, setFloatingOn] = useState(isFloatingActive());
  const [permState, setPermState] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!open) return null;

  const pnlPrefix = data.total != null && data.total >= 0 ? '+₹' : '-₹';
  const pnlFormatted = data.total != null ? `${pnlPrefix}${Math.abs(data.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';
  const isPos = data.total != null && data.total > 0;
  const isNeg = data.total != null && data.total < 0;

  const handleToggleLockScreen = async () => {
    if (!lockScreenOn) {
      const granted = await requestLockScreenAccess();
      setPermState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied');
      if (granted) {
        setLockScreenActive(true);
        setLockScreenOn(true);
      }
    } else {
      setLockScreenActive(false);
      setLockScreenOn(false);
    }
  };

  const handleToggleFloating = async () => {
    if (!floatingOn) {
      const success = await openFloatingLiveScore(data, onSquareOff);
      setFloatingOn(success);
    } else {
      await closeFloatingLiveScore();
      setFloatingOn(false);
    }
  };

  const handleAddHomeScreenShortcut = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setInstallPrompt(null);
    } else {
      alert(
        'To add shortcut to your home screen:\n\n• On iOS Safari: Tap Share (box with arrow) → "Add to Home Screen"\n• On Android Chrome: Tap Menu (⋮) → "Add to Home screen" or "Install App"'
      );
    }
  };

  return (
    <Dialog titleId="shortcut-modal-title" onClose={onClose}>
      <div className="livescore-modal-content">
        <div className="dialog-title-group">
          <div className="livescore-badge">
            <Plus size={13} strokeWidth={2.5} />
            <span>ADD SHORTCUT & WIDGETS</span>
          </div>
          <h2 id="shortcut-modal-title">Add Shortcut & Live Widgets</h2>
          <p className="dialog-description">
            Pin live P&L shortcuts, lock screen ticker, and floating widgets to your device.
          </p>
        </div>

        {/* Live Shortcut Preview Card */}
        <div className="livescore-preview-card">
          <div className="preview-header">
            <div className="preview-brand">
              <span className={`preview-dot ${data.running ? 'running' : 'stopped'}`} />
              <strong>MAVRIX 009 ALGO</strong>
            </div>
            <span className="preview-status-tag">
              {data.mode.toUpperCase()} · {data.running ? 'LIVE SESSION' : 'READY'}
            </span>
          </div>

          <div className="preview-main">
            <span className="preview-label">NET SESSION P&L</span>
            <div className={`preview-pnl ${isPos ? 'positive' : isNeg ? 'negative' : ''}`}>
              {pnlFormatted}
            </div>
            <div className="preview-sub">
              Open: {data.openPnl != null ? `₹${data.openPnl.toFixed(0)}` : '—'} · Realized: {data.realized != null ? `₹${data.realized.toFixed(0)}` : '—'}
            </div>
          </div>

          <div className="preview-grid">
            <div className="preview-cell">
              <span className="cell-label">NIFTY SPOT</span>
              <strong className="cell-val">
                {data.spotPrice != null ? `₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}` : '—'}
              </strong>
            </div>
            <div className="preview-cell">
              <span className="cell-label">LOCKED ATM</span>
              <strong className="cell-val">{data.atm ? `${data.atm}` : 'Auto (09:20)'}</strong>
            </div>
            <div className="preview-cell">
              <span className="cell-label">CALL {data.ceStrike ?? 'ATM'}</span>
              <strong className="cell-val">
                {data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : data.ceStatus || 'Flat'}
              </strong>
            </div>
            <div className="preview-cell">
              <span className="cell-label">PUT {data.peStrike ?? 'ATM'}</span>
              <strong className="cell-val">
                {data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : data.peStatus || 'Flat'}
              </strong>
            </div>
          </div>
        </div>

        {/* Shortcut & Widget Options */}
        <div className="livescore-features-list">
          {/* Feature 1: Lock Screen Live Ticker */}
          <div className="livescore-feature-row">
            <div className="feature-icon-wrap">
              <Smartphone size={20} />
            </div>
            <div className="feature-info">
              <strong>Lock Screen Shortcut & Ticker</strong>
              <p>Silent in-place card on phone & desktop lock screen. Updates live every tick without buzzing.</p>
              {permState === 'denied' && (
                <span className="feature-warn">Notifications blocked in browser site permissions.</span>
              )}
            </div>
            <button
              type="button"
              className={`feature-toggle-btn ${lockScreenOn ? 'active' : ''}`}
              disabled={!isLockScreenSupported()}
              onClick={handleToggleLockScreen}
            >
              {lockScreenOn ? (
                <>
                  <Check size={14} />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add Shortcut</span>
                </>
              )}
            </button>
          </div>

          {/* Feature 2: Floating Live Widget (Picture-in-Picture) */}
          <div className="livescore-feature-row">
            <div className="feature-icon-wrap">
              <Tv size={20} />
            </div>
            <div className="feature-info">
              <strong>Floating Live Widget</strong>
              <p>Always-on-top mini card floating over WhatsApp, TradingView, or home screen (Picture-in-Picture).</p>
            </div>
            <button
              type="button"
              className={`feature-toggle-btn ${floatingOn ? 'active' : ''}`}
              disabled={!isFloatingWidgetSupported()}
              onClick={handleToggleFloating}
            >
              {floatingOn ? (
                <>
                  <Check size={14} />
                  <span>Pinned</span>
                </>
              ) : (
                <>
                  <Pin size={14} />
                  <span>Pin Widget</span>
                </>
              )}
            </button>
          </div>

          {/* Feature 3: Home Screen Shortcut */}
          <div className="livescore-feature-row">
            <div className="feature-icon-wrap">
              <Sparkles size={20} />
            </div>
            <div className="feature-info">
              <strong>Home Screen App Shortcut</strong>
              <p>1-tap shortcut on mobile home screen with live notification badge and standalone launch.</p>
            </div>
            <button
              type="button"
              className={`feature-toggle-btn ${installed ? 'active' : ''}`}
              onClick={handleAddHomeScreenShortcut}
            >
              {installed ? (
                <>
                  <Check size={14} />
                  <span>Installed</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Install Shortcut</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Emergency Stop Button if Running */}
        {data.running && (
          <div className="livescore-emergency-bar">
            <button type="button" className="emergency-stop-btn" onClick={onSquareOff}>
              <Square size={14} fill="currentColor" />
              <span>Square Off & Stop Session</span>
            </button>
          </div>
        )}

        <div className="dialog-footer">
          <span className="footer-hint">
            Official W3C Document PiP & Service Worker notification channel.
          </span>
          <button type="button" className="button secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
