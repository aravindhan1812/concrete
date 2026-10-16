import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { visibleNav } from '../app/nav';
import { Icons } from '../app/icons';
import { useSession } from '../lib/session';
import { formatValue, niceTicks } from './format';
import { AlertsData, FunnelData, KpisData, Severity, TableData, TrendData } from './types';

/* ---------- KPI tiles ---------- */

export function KpisBody({ data }: { data: KpisData }) {
  const navigate = useNavigate();
  return (
    <div className="dash-kpis">
      {data.items.map((k) => (
        <div
          key={k.label}
          className={`kpi ${k.tone ?? 'neutral'}${k.link ? ' clickable' : ''}`}
          onClick={k.link ? () => navigate(k.link!) : undefined}
          onKeyDown={k.link ? (e) => e.key === 'Enter' && navigate(k.link!) : undefined}
          role={k.link ? 'link' : undefined}
          tabIndex={k.link ? 0 : undefined}
        >
          <div className="kpi-head">
            <span className="kpi-label">{k.label}</span>
          </div>
          <div className="kpi-value" title={formatValue(k.value, k.format)}>
            {formatValue(k.value, k.format, { compact: true })}
          </div>
          {k.hint && <div className="kpi-delta">{k.hint}</div>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Trend: single-series columns, hover/focus tooltip, table view ---------- */

const CHART_H = 180;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

export function TrendBody({ data }: { data: TrendData }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(0, ...data.points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const n = data.points.length;

  return (
    <div className="dash-trend">
      <div className="trend-head">
        <div>
          <div className="trend-total">{formatValue(data.total, data.format, { compact: true })}</div>
          <div className="trend-total-label">{data.totalLabel}</div>
        </div>
        <button className="btn ghost sm" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {asTable ? (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td style={{ textAlign: 'right' }}>{formatValue(p.value, data.format)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="trend-plot" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 600 ${CHART_H}`} preserveAspectRatio="none" role="img" aria-label={`${data.totalLabel}: monthly values`} className="trend-svg">
            {ticks.map((t) => {
              const y = PAD.top + (1 - t / top) * (CHART_H - PAD.top - PAD.bottom);
              return <line key={t} x1={PAD.left} x2={600 - PAD.right} y1={y} y2={y} className="grid" />;
            })}
            {data.points.map((p, i) => {
              const band = (600 - PAD.left - PAD.right) / n;
              const w = Math.min(24, band * 0.6);
              const x = PAD.left + band * i + (band - w) / 2;
              const h = (p.value / top) * (CHART_H - PAD.top - PAD.bottom);
              const y = CHART_H - PAD.bottom - h;
              const r = Math.min(4, h / 2, w / 2);
              // Rounded data-end, square at the baseline.
              const path = h > 0 ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z` : '';
              return (
                <g key={p.label}>
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={CHART_H - PAD.top - PAD.bottom}
                    className="hit"
                    tabIndex={0}
                    aria-label={`${p.label}: ${formatValue(p.value, data.format)}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  />
                  {path && <path d={path} className={`bar${hover === i ? ' active' : ''}`} />}
                </g>
              );
            })}
            <line x1={PAD.left} x2={600 - PAD.right} y1={CHART_H - PAD.bottom} y2={CHART_H - PAD.bottom} className="axis" />
          </svg>
          {/* HTML labels so text stays crisp and does not stretch with the SVG */}
          <div className="trend-yaxis" style={{ top: PAD.top, height: CHART_H - PAD.top - PAD.bottom }}>
            {ticks.map((t) => (
              <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>
                {formatValue(t, data.format, { compact: true })}
              </span>
            ))}
          </div>
          <div className="trend-xaxis" style={{ left: `${(PAD.left / 600) * 100}%`, right: `${(PAD.right / 600) * 100}%` }}>
            {data.points.map((p) => (
              <span key={p.label}>{p.label}</span>
            ))}
          </div>
          {hover !== null && (
            <div className="chart-tip" style={{ left: `${((PAD.left + ((600 - PAD.left - PAD.right) / n) * (hover + 0.5)) / 600) * 100}%` }} role="status">
              <span className="tip-label">{data.points[hover].label}</span>
              <span className="tip-value">{formatValue(data.points[hover].value, data.format)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Funnel: horizontal bars, value at the tip ---------- */

export function FunnelBody({ data }: { data: FunnelData }) {
  const max = Math.max(1, ...data.rows.map((r) => r.value));
  return (
    <div className="dash-funnel">
      {data.rows.map((r) => (
        <div className="funnel-row" key={r.label} title={`${r.label}: ${r.value}`}>
          <span className="funnel-label">{r.label}</span>
          <span className="funnel-track">
            {r.value > 0 && <span className="funnel-fill" style={{ width: `${(r.value / max) * 100}%` }} />}
          </span>
          <span className="funnel-count">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Table ---------- */

export function TableBody({ data }: { data: TableData }) {
  if (data.rows.length === 0) return <div className="widget-empty">{data.emptyText}</div>;
  return (
    <table className="mini-table">
      <thead>
        <tr>
          {data.columns.map((c) => (
            <th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i}>
            {data.columns.map((c) => (
              <td key={c.key} style={{ textAlign: c.align ?? 'left' }} className={c.align === 'right' ? 'num' : ''}>
                {c.format ? formatValue(row[c.key], c.format) : String(row[c.key] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- Alerts: status colour always paired with icon + label ---------- */

const SEVERITY: Record<Severity, { label: string; icon: string }> = {
  critical: { label: 'Critical', icon: '!' },
  serious: { label: 'High', icon: '▲' },
  warning: { label: 'Medium', icon: '●' },
  good: { label: 'Low', icon: '○' },
};

export function AlertsBody({ data }: { data: AlertsData }) {
  if (data.items.length === 0) return <div className="widget-empty">{data.emptyText}</div>;
  return (
    <ul className="alert-list">
      {data.items.map((a, i) => (
        <li key={i} className={`alert-item sev-${a.severity}`}>
          <span className="sev-badge">
            <span className="sev-icon" aria-hidden>
              {SEVERITY[a.severity].icon}
            </span>
            {SEVERITY[a.severity].label}
          </span>
          <span className="alert-text">
            <span className="alert-title">{a.title}</span>
            {a.detail && <span className="alert-detail">{a.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Shortcuts (client-side: the modules this user can open) ---------- */

export function ShortcutsBody() {
  const { can } = useSession();
  const navigate = useNavigate();
  const modules = visibleNav(can).filter((m) => m.key !== 'home');
  return (
    <div className="shortcut-grid">
      {modules.map((m) => {
        const Icon = Icons[m.icon];
        return (
          <button key={m.key} className="shortcut" onClick={() => navigate(m.path)}>
            <span className="shortcut-icon">
              <Icon />
            </span>
            <span className="shortcut-label">{m.label}</span>
            {!m.ready && <span className="shortcut-soon">Soon</span>}
          </button>
        );
      })}
    </div>
  );
}
