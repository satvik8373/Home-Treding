/**
 * StrategyConfigPanel
 *
 * Institutional-grade, fully-editable strategy parameter panel.
 * - Reads live config from the centralized backend API
 * - All fields are inline-editable; values save on-blur or via the Save button
 * - Shows diff vs factory defaults
 * - Compliant with AGENTS.md / GEMINI.md design rules (no gradients, no neon, flat UI)
 */

import React, { useState, useEffect } from 'react';
import { useStrategyConfig, StrategyParameters } from '../hooks/useStrategyConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldDef {
  key: keyof StrategyParameters;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'time' | 'select';
  unit?: string;
  options?: string[];
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}

// ─── Field schema (all editable parameters) ──────────────────────────────────

const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Lot Sizes (NSE 2025 Revision)',
    fields: [
      { key: 'niftyLotSize',      label: 'NIFTY 50',      type: 'number', unit: 'units/lot', min: 1, description: 'NIFTY 50 options contract lot size' },
      { key: 'bankNiftyLotSize',  label: 'BANKNIFTY',     type: 'number', unit: 'units/lot', min: 1 },
      { key: 'finNiftyLotSize',   label: 'FINNIFTY',      type: 'number', unit: 'units/lot', min: 1 },
      { key: 'midcpNiftyLotSize', label: 'MIDCPNIFTY',    type: 'number', unit: 'units/lot', min: 1 },
      { key: 'sensexLotSize',     label: 'SENSEX (BSE)',   type: 'number', unit: 'units/lot', min: 1 },
    ]
  },
  {
    title: 'Entry & Sizing',
    fields: [
      { key: 'entryLots', label: 'Entry Lots', type: 'number', unit: 'lots', min: 1, max: 10, description: 'Number of lots per trade entry (qty = lotSize × entryLots)' },
    ]
  },
  {
    title: 'ATM Breakout Strategy',
    fields: [
      { key: 'breakoutPct',         label: 'Breakout %',           type: 'number', unit: '%', min: 0.0001, max: 0.1, step: 0.0001, description: 'Premium breakout threshold (e.g. 0.0009 = 0.09%)' },
      { key: 'referenceCandleStart',label: 'Ref Candle Open',      type: 'time',   description: 'Start of reference candle (IST HH:MM)' },
      { key: 'referenceCandleEnd',  label: 'Ref Candle Close',     type: 'time',   description: 'End of reference candle — levels locked here (IST HH:MM)' },
      { key: 'tradingStartTime',    label: 'Trading Start',        type: 'time',   description: 'Strategy starts watching for breakout (IST HH:MM)' },
      { key: 'forceSquareOffTime',  label: 'Force Square-Off',     type: 'time',   description: 'All positions squared off at or after this time (IST HH:MM)' },
    ]
  },
  {
    title: 'Risk Management',
    fields: [
      { key: 'maxDailyLoss',    label: 'Max Daily Loss',     type: 'number', unit: '₹', min: 1000, description: 'Strategy halts if total loss exceeds this (₹)' },
      { key: 'maxDailyProfit',  label: 'Max Daily Profit',   type: 'number', unit: '₹', min: 0,    description: 'Optional profit target (₹). Set 0 for unlimited.' },
      { key: 'maxTradesPerDay', label: 'Max Trades / Day',   type: 'number', unit: 'trades', min: 0, description: 'Max entries per leg. Set 0 for unlimited.' },
      { key: 'enableReEntry',   label: 'Allow Re-Entry',     type: 'boolean', description: 'Allow re-entry after an exit within the same session' },
    ]
  },
  {
    title: 'Order Settings',
    fields: [
      { key: 'orderType',   label: 'Order Type',    type: 'select', options: ['MIS', 'CNC', 'NRML'] },
      { key: 'productType', label: 'Product Type',  type: 'select', options: ['INTRADAY', 'DELIVERY'] },
    ]
  }
];

// ─── Component ────────────────────────────────────────────────────────────────

interface StrategyConfigPanelProps {
  onClose?: () => void;
}

const StrategyConfigPanel: React.FC<StrategyConfigPanelProps> = ({ onClose }) => {
  const { config, defaults, isLoading, isSaving, error, success, update, reset } = useStrategyConfig();

  // Local form state — mirrors config but tracks unsaved changes
  const [draft, setDraft] = useState<Partial<StrategyParameters>>({});
  const [dirty, setDirty] = useState<Set<keyof StrategyParameters>>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);

  // Sync draft when config loads
  useEffect(() => {
    if (config) {
      setDraft(prev => (Object.keys(prev).length === 0 ? { ...config } : prev));
    }
  }, [config]);

  if (isLoading || !config || !draft) {
    return (
      <div style={styles.loading}>
        <span style={styles.loadingText}>Loading strategy configuration…</span>
      </div>
    );
  }

  const handleChange = (key: keyof StrategyParameters, value: any, fieldType: string) => {
    let parsed: any = value;
    if (fieldType === 'number') parsed = value === '' ? '' : Number(value);
    if (fieldType === 'boolean') parsed = value as boolean;
    setDraft(prev => ({ ...prev, [key]: parsed }));
    setDirty(prev => new Set(prev).add(key));
  };

  const handleSave = async () => {
    const changes: Partial<StrategyParameters> = {};
    dirty.forEach(k => {
      (changes as any)[k] = draft[k];
    });
    const ok = await update(changes);
    if (ok) {
      setDirty(new Set());
    }
  };

  const handleReset = async () => {
    const ok = await reset();
    if (ok) {
      setDraft({});
      setDirty(new Set());
      setConfirmReset(false);
    }
  };

  const isDefaultValue = (key: keyof StrategyParameters): boolean => {
    return defaults ? (defaults[key] as any) === (draft[key] as any) : false;
  };

  const renderField = (field: FieldDef) => {
    const rawValue = draft[field.key];
    const isDirty = dirty.has(field.key);
    const isDefault = isDefaultValue(field.key);

    let displayValue: any = rawValue;
    // For breakoutPct, show as percentage to user
    if (field.key === 'breakoutPct' && typeof rawValue === 'number') {
      displayValue = (rawValue * 100).toFixed(4);
    }

    return (
      <div key={field.key} style={{ ...styles.fieldRow, ...(isDirty ? styles.fieldRowDirty : {}) }}>
        <div style={styles.fieldMeta}>
          <span style={styles.fieldLabel}>{field.label}</span>
          {field.unit && <span style={styles.fieldUnit}>{field.unit}</span>}
          {!isDefault && !isDirty && <span style={styles.modifiedBadge}>modified</span>}
          {isDirty && <span style={styles.dirtyBadge}>unsaved</span>}
          {field.description && <span style={styles.fieldDesc}>{field.description}</span>}
        </div>
        <div style={styles.fieldInput}>
          {field.type === 'boolean' ? (
            <button
              id={`cfg-${field.key}`}
              style={{ ...styles.toggleBtn, ...(rawValue ? styles.toggleOn : styles.toggleOff) }}
              onClick={() => handleChange(field.key, !rawValue, 'boolean')}
              aria-pressed={!!rawValue}
            >
              {rawValue ? 'Enabled' : 'Disabled'}
            </button>
          ) : field.type === 'select' ? (
            <select
              id={`cfg-${field.key}`}
              value={String(rawValue ?? '')}
              onChange={e => handleChange(field.key, e.target.value, 'string')}
              style={styles.select}
            >
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'time' ? (
            <input
              id={`cfg-${field.key}`}
              type="time"
              value={String(rawValue ?? '')}
              onChange={e => handleChange(field.key, e.target.value, 'string')}
              style={styles.input}
              step={60}
            />
          ) : (
            <input
              id={`cfg-${field.key}`}
              type="number"
              value={field.key === 'breakoutPct' ? displayValue : String(rawValue ?? '')}
              min={field.min}
              max={field.max}
              step={field.step ?? (field.key === 'breakoutPct' ? 0.001 : 1)}
              onChange={e => {
                let val: any = e.target.value;
                if (field.key === 'breakoutPct') {
                  val = parseFloat(e.target.value) / 100;
                }
                handleChange(field.key, val, 'number');
              }}
              style={styles.input}
            />
          )}
          {defaults && field.type !== 'boolean' && field.type !== 'select' && (
            <span style={styles.defaultHint}>
              default: {field.key === 'breakoutPct'
                ? `${((defaults[field.key] as number) * 100).toFixed(4)}%`
                : String(defaults[field.key])}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Derived: effective order qty
  const effectiveQty = typeof draft.niftyLotSize === 'number' && typeof draft.entryLots === 'number'
    ? draft.niftyLotSize * draft.entryLots
    : '—';

  return (
    <div style={styles.panel} id="strategy-config-panel">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Strategy Configuration</h2>
          <p style={styles.subtitle}>
            All parameters are live — changes apply to the next strategy session.
          </p>
        </div>
        <div style={styles.headerActions}>
          {dirty.size > 0 && (
            <button
              id="cfg-save-btn"
              onClick={handleSave}
              disabled={isSaving}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              {isSaving ? 'Saving…' : `Save ${dirty.size} change${dirty.size !== 1 ? 's' : ''}`}
            </button>
          )}
          {!confirmReset ? (
            <button
              id="cfg-reset-btn"
              onClick={() => setConfirmReset(true)}
              style={{ ...styles.btn, ...styles.btnSecondary }}
            >
              Reset Defaults
            </button>
          ) : (
            <div style={styles.confirmReset}>
              <span style={styles.confirmText}>Reset all?</span>
              <button onClick={handleReset} style={{ ...styles.btn, ...styles.btnDanger }}>Confirm</button>
              <button onClick={() => setConfirmReset(false)} style={{ ...styles.btn, ...styles.btnSecondary }}>Cancel</button>
            </div>
          )}
          {onClose && (
            <button id="cfg-close-btn" onClick={onClose} style={{ ...styles.btn, ...styles.btnSecondary }}>✕ Close</button>
          )}
        </div>
      </div>

      {/* Status messages */}
      {error && <div style={styles.alertError}>{error}</div>}
      {success && <div style={styles.alertSuccess}>{success}</div>}

      {/* Effective order summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>NIFTY Order Qty</span>
          <span style={styles.summaryValue}>{effectiveQty} units</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Breakout Threshold</span>
          <span style={styles.summaryValue}>
            {typeof draft.breakoutPct === 'number'
              ? `${(draft.breakoutPct * 100).toFixed(4)}%`
              : '—'}
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Force Square-Off</span>
          <span style={styles.summaryValue}>{draft.forceSquareOffTime ?? '—'} IST</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Last Updated</span>
          <span style={styles.summaryValue}>
            {config.lastUpdatedAt
              ? new Date(config.lastUpdatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
              : '—'}
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Updated By</span>
          <span style={styles.summaryValue}>{config.lastUpdatedBy ?? '—'}</span>
        </div>
      </div>

      {/* Field groups */}
      <div style={styles.groups}>
        {FIELD_GROUPS.map(group => (
          <div key={group.title} style={styles.group}>
            <div style={styles.groupTitle}>{group.title}</div>
            {group.fields.map(renderField)}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          Persisted to <code style={styles.code}>backend/data/strategy-config.json</code> · Schema v{config.schemaVersion}
        </span>
        {dirty.size > 0 && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ ...styles.btn, ...styles.btnPrimary }}
          >
            {isSaving ? 'Saving…' : `Save Changes`}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Styles (AGENTS.md compliant — flat, no gradients, no neon) ───────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
    fontSize: 13,
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 16px',
    borderBottom: '1px solid #f1f5f9',
    background: '#f8fafc',
    gap: 16,
    flexWrap: 'wrap' as any,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#64748b',
  },
  headerActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap' as any,
  },
  btn: {
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    letterSpacing: 0,
    transition: 'background 0.15s',
  },
  btnPrimary: {
    background: '#2563eb',
    color: '#ffffff',
    border: '1px solid #2563eb',
  },
  btnSecondary: {
    background: '#f8fafc',
    color: '#374151',
    border: '1px solid #e2e8f0',
  },
  btnDanger: {
    background: '#dc2626',
    color: '#ffffff',
    border: '1px solid #dc2626',
  },
  confirmReset: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  confirmText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 500,
  },
  alertError: {
    margin: '12px 24px 0',
    padding: '8px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    color: '#dc2626',
    fontSize: 12,
  },
  alertSuccess: {
    margin: '12px 24px 0',
    padding: '8px 14px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    color: '#16a34a',
    fontSize: 12,
  },
  summary: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #f1f5f9',
    background: '#f8fafc',
    overflowX: 'auto' as any,
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column' as any,
    padding: '12px 20px',
    borderRight: '1px solid #f1f5f9',
    minWidth: 130,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#0f172a',
    marginTop: 2,
  },
  groups: {
    padding: '0 24px 16px',
  },
  group: {
    marginTop: 20,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.07em',
    paddingBottom: 8,
    borderBottom: '1px solid #f1f5f9',
    marginBottom: 4,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 0',
    borderBottom: '1px solid #f8fafc',
    gap: 16,
  },
  fieldRowDirty: {
    background: '#fef9f0',
    margin: '0 -24px',
    padding: '9px 24px',
  },
  fieldMeta: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as any,
    gap: 2,
  },
  fieldLabel: {
    fontWeight: 500,
    color: '#1e293b',
    fontSize: 13,
  },
  fieldUnit: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
  },
  fieldDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 1.4,
  },
  modifiedBadge: {
    fontSize: 10,
    background: '#eff6ff',
    color: '#2563eb',
    borderRadius: 4,
    padding: '1px 6px',
    fontWeight: 500,
    width: 'fit-content',
  },
  dirtyBadge: {
    fontSize: 10,
    background: '#fef3c7',
    color: '#d97706',
    borderRadius: 4,
    padding: '1px 6px',
    fontWeight: 500,
    width: 'fit-content',
  },
  fieldInput: {
    display: 'flex',
    flexDirection: 'column' as any,
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 160,
  },
  input: {
    width: 160,
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 13,
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
    textAlign: 'right' as any,
    fontFamily: "'Inter', monospace",
  },
  select: {
    width: 160,
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 13,
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
  },
  toggleBtn: {
    padding: '6px 16px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    minWidth: 90,
  },
  toggleOn: {
    background: '#16a34a',
    color: '#ffffff',
    border: '1px solid #16a34a',
  },
  toggleOff: {
    background: '#f1f5f9',
    color: '#64748b',
    border: '1px solid #e2e8f0',
  },
  defaultHint: {
    fontSize: 10,
    color: '#94a3b8',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderTop: '1px solid #f1f5f9',
    background: '#f8fafc',
    gap: 12,
    flexWrap: 'wrap' as any,
  },
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  code: {
    fontFamily: 'monospace',
    background: '#f1f5f9',
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: 10,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
  },
};

export default StrategyConfigPanel;
