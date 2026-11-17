import { useState, useEffect } from 'react';
import { Check, Pin, Plus, Sparkles, Square, Tv } from 'lucide-react';
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

        {/* Live Cricket-Style Trading Match Bar */}
        <div className="trading-match-bar" role="region" aria-label="Live Trading Match Score">
          <div className="match-bar-top">
            <div className="match-brand">
              <span className={`match-dot ${data.running ? 'running' : 'stopped'}`} />
              <span>NIFTY 50 · 009 BREAKOUT</span>
            </div>
            <span className="match-time-tag">
              {data.running ? 'IN PLAY' : 'CUTOFF 15:10 IST'}
            </span>
          </div>

          <div className="match-bar-body">
            {/* Team 1: CALL (CE) */}
            <div className="match-team call-team">
              <div className="team-badge call-badge">
                <span className="badge-type">CE</span>
                <span className="badge-arrow">▲</span>
              </div>
              <div className="team-text">
                <span className="team-strike">{data.ceStrike ? `C${data.ceStrike}` : 'CALL ATM'}</span>
                <strong className="team-price">
                  {data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : 'Watch'}
                </strong>
                <span className="team-status">{data.ceStatus || 'Watching'}</span>
              </div>
            </div>

            {/* Center: Live Indicator & Net P&L Score */}
            <div className="match-center">
              <div className={`match-live-pill ${data.running ? 'live' : 'pre'}`}>
                <span className="live-pulse-dot" />
                <span>{data.running ? 'LIVE' : 'PRE'}</span>
              </div>
              <div className={`match-pnl ${isPos ? 'positive' : isNeg ? 'negative' : ''}`}>
                {pnlFormatted}
              </div>
              <div className="match-context-tag">
                {data.spotPrice != null ? `₹${data.spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'NIFTY'} · {data.atm ? `${data.atm}` : 'ATM'}
              </div>
            </div>

            {/* Team 2: PUT (PE) */}
            <div className="match-team put-team">
              <div className="team-text">
                <span className="team-strike">{data.peStrike ? `P${data.peStrike}` : 'PUT ATM'}</span>
                <strong className="team-price">
                  {data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : 'Watch'}
                </strong>
                <span className="team-status">{data.peStatus || 'Watching'}</span>
              </div>
              <div className="team-badge put-badge">
                <span className="badge-type">PE</span>
                <span className="badge-arrow">▼</span>
              </div>
            </div>
          </div>

          <div className="match-bar-footer">
            <span className="footer-stat">Open: {data.openPnl != null ? `₹${data.openPnl.toFixed(0)}` : '₹0'}</span>
            <span className="footer-dot">•</span>
            <span className="footer-stat">Realized: {data.realized != null ? `₹${data.realized.toFixed(0)}` : '₹0'}</span>
            <span className="footer-dot">•</span>
            <span className="footer-stat">{data.mode.toUpperCase()}</span>
          </div>
        </div>

        {/* Shortcut & Widget Options */}
        <div className="livescore-features-list">
          {/* Feature 1: Pinned Live Notification */}
          <div className="livescore-feature-row">
            <div className="feature-icon-wrap">
              <Pin size={20} />
            </div>
            <div className="feature-info">
              <strong>Pinned Live Notification</strong>
              <p>Silent pinned card in your phone/desktop notification drawer. Updates quietly in-place without popup banners or buzzing.</p>
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
                  <span>Pinned</span>
                </>
              ) : (
                <>
                  <Pin size={14} />
                  <span>Pin Notification</span>
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
              <p>Always-on-top mini live card floating over WhatsApp, TradingView, or home screen (Picture-in-Picture).</p>
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
                  <Tv size={14} />
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
