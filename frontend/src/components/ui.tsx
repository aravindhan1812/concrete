import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useId } from 'react';
import { Icons, IconName } from '../app/icons';

/* ---------- Buttons ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
};
export function Button({ variant = 'primary', size = 'md', icon, loading, children, className = '', disabled, ...rest }: ButtonProps) {
  const Icon = icon ? Icons[icon] : null;
  return (
    <button className={`btn ${variant} ${size} ${className}`} disabled={disabled || loading} {...rest}>
      {Icon && <Icon width={18} height={18} />}
      {loading ? 'Please wait…' : children}
    </button>
  );
}

export function IconButton({ icon, label, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  const Icon = Icons[icon];
  return (
    <button className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon />
    </button>
  );
}

/** Floating primary action on phones; renders as a normal button on larger screens. */
export function Fab({ label, icon = 'plus', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon?: IconName }) {
  const Icon = Icons[icon];
  return (
    <button className="fab" {...rest}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

/* ---------- Form fields ---------- */

interface FieldBase {
  label: string;
  hint?: string;
  error?: string;
}
export function TextField({ label, hint, error, id, ...rest }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <input id={fid} aria-invalid={!!error} {...rest} />
      {error ? <span className="field-msg error">{error}</span> : hint ? <span className="field-msg">{hint}</span> : null}
    </div>
  );
}
export function SelectField({ label, hint, error, id, children, ...rest }: FieldBase & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <select id={fid} aria-invalid={!!error} {...rest}>
        {children}
      </select>
      {error ? <span className="field-msg error">{error}</span> : hint ? <span className="field-msg">{hint}</span> : null}
    </div>
  );
}
export function TextArea({ label, hint, error, id, ...rest }: FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      <textarea id={fid} rows={3} aria-invalid={!!error} {...rest} />
      {error ? <span className="field-msg error">{error}</span> : hint ? <span className="field-msg">{hint}</span> : null}
    </div>
  );
}

/* ---------- Status & display ---------- */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Card({ children, className = '', onClick, accent }: { children: ReactNode; className?: string; onClick?: () => void; accent?: boolean }) {
  return (
    <div className={`surface-card${accent ? ' accent' : ''}${onClick ? ' clickable' : ''} ${className}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  );
}

export function KpiTile({ label, value, delta, tone = 'neutral', icon, onClick }: { label: string; value: ReactNode; delta?: ReactNode; tone?: Tone; icon?: IconName; onClick?: () => void }) {
  const Icon = icon ? Icons[icon] : null;
  return (
    <div className={`kpi ${tone}${onClick ? ' clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {Icon && <Icon width={18} height={18} />}
      </div>
      <div className="kpi-value">{value}</div>
      {delta && <div className="kpi-delta">{delta}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  const Icon = Icons[icon];
  return (
    <div className="empty">
      <Icon width={36} height={36} />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone = 'danger', children, onDismiss }: { tone?: Tone; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`alert ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && <IconButton icon="close" label="Dismiss" onClick={onDismiss} />}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ---------- Data table that becomes cards on phones ---------- */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Hide this column on phones (the card shows the primary columns only). */
  hideOnPhone?: boolean;
  align?: 'left' | 'right';
  width?: string;
}
export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void; empty?: ReactNode }) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align ?? 'left', width: c.width }} className={c.hideOnPhone ? 'hide-phone' : ''}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? 'clickable' : ''}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} style={{ textAlign: c.align ?? 'left' }} className={c.hideOnPhone ? 'hide-phone' : ''}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Dialog: centred on desktop, bottom sheet on phones ---------- */

export function Dialog({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div className="sheet-handle" />
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Layout helpers ---------- */

export function Grid({ children, min = 220 }: { children: ReactNode; min?: number }) {
  return (
    <div className="auto-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}>
      {children}
    </div>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
