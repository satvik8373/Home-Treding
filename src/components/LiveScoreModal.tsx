import { useState, useEffect } from 'react';
import { Check, PictureInPicture2, Pin, Plus, Sparkles, Square, Tv } from 'lucide-react';
import { Dialog } from './Dialog';
import type { LiveScoreData } from '../lib/liveScore';
import {
  isIOS,
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
  const [iosNotice, setIosNotice] = useState<string | null>(null);
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
        if (isIOS()) {
          setIosNotice('Lock Screen Live Card is now active! Lock your iPhone or check Control Center.');
        }
      }
    } else {
      setLockScreenActive(false);
      setLockScreenOn(false);
      setIosNotice(null);
    }
  };

  const handleToggleFloating = async () => {
    if (!floatingOn) {
      const success = await openFloatingLiveScore(data, onSquareOff);
      setFloatingOn(success);
      if (success && isIOS()) {
        setIosNotice('Pinned! Lock your iPhone to view the live cricket score card on your Lock Screen & Dynamic Island.');
      }
    } else {
      await closeFloatingLiveScore();
      setFloatingOn(false);
      setIosNotice(null);
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
            <PictureInPicture2 size={13} strokeWidth={2.5} />
            <span>GOOGLE LIVE SCORE PIN</span>
          </div>
          <h2 id="shortcut-modal-title">Pin Live Score</h2>
          <p className="dialog-description">
            Official lock screen match widget & floating score like Google cricket score.
          </p>
        </div>

        {/* Lock Screen Live Score Widget (Image 2 Reference) */}
        <div className="lockscreen-preview-wrapper" role="region" aria-label="Lock Screen Live Score Widget">
          <div className="lockscreen-clock-header">
            <span className="lockscreen-date">Tuesday, Nov 17</span>
            <span className="lockscreen-time">09:39</span>
          </div>

          <div className="lockscreen-cricket-card">
            <div className="lockscreen-card-main">
              {/* Left Side: CALL (CE) Team */}
              <div className="lockscreen-team left">
                <div className="lockscreen-flag call-flag">
                  <span className="flag-icon">CE</span>
                  <span className="flag-sub">▲</span>
                </div>
                <div className="lockscreen-score-group">
                  <strong className="lockscreen-score">
                    {data.cePrice != null ? `₹${data.cePrice.toFixed(1)}` : 'Watch'}
                  </strong>
                  <span className="lockscreen-overs">({data.ceStrike ?? 'ATM'})</span>
                </div>
              </div>

              {/* Center: Brand + Status Pill + Net P&L */}
              <div className="lockscreen-center">
                <div className="lockscreen-brand-icon">
                  <span className="brand-monogram">M</span>
                </div>
                <div className={`lockscreen-status-pill ${data.running ? 'live' : 'stumps'}`}>
                  {data.running ? '● LIVE' : 'Stumps'}
                </div>
                <div className={`lockscreen-center-pnl ${isPos ? 'pos' : isNeg ? 'neg' : ''}`}>
                  {pnlFormatted}
                </div>
              </div>

              {/* Right Side: PUT (PE) Team */}
              <div className="lockscreen-team right">
                <div className="lockscreen-score-group right">
                  <strong className="lockscreen-score">
                    {data.pePrice != null ? `₹${data.pePrice.toFixed(1)}` : 'Watch'}
                  </strong>
                  <span className="lockscreen-overs">({data.peStrike ?? 'ATM'})</span>
                </div>
                <div className="lockscreen-flag put-flag">
                  <span className="flag-icon">PE</span>
                  <span className="flag-sub">▼</span>
                </div>
              </div>
            </div>

            {/* Sub-labels row (SL - ICC - PAK style) */}
            <div className="lockscreen-labels-row">
              <span className="label-team left">CALL</span>
              <span className="label-center">NIFTY 50 · {data.mode.toUpperCase()}</span>
              <span className="label-team right">PUT</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button: Google-style [ ⧉ Pin live score ] (Image 1 Reference) */}
        <button
          type="button"
          className={`pin-live-score-btn ${floatingOn ? 'active' : ''}`}
          disabled={!isFloatingWidgetSupported()}
          onClick={handleToggleFloating}
        >
          <PictureInPicture2 size={18} />
          <span>{floatingOn ? 'Pinned live score ✓' : 'Pin live score'}</span>
        </button>

        {/* iOS Lock Screen Feedback Toast */}
        {iosNotice && (
          <div className="livescore-ios-notice" role="status">
            <span className="ios-notice-icon">📱</span>
            <div className="ios-notice-text">
              <strong>iPhone Lock Screen Live</strong>
              <span>{iosNotice}</span>
            </div>
          </div>
        )}

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
              {isIOS() ? (
                <span className="feature-ios-hint">
                  🍎 <strong>iPhone Safari:</strong> Uses native Lock Screen Live Card. For system push banners, add app to Home Screen.
                </span>
              ) : (
                permState === 'denied' && (
                  <span className="feature-warn">Notifications blocked in browser site permissions.</span>
                )
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
