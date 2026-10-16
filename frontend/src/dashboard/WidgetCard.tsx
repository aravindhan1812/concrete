import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '../components/ui';
import { api } from '../lib/api';
import { AlertsData, FunnelData, KpisData, TableData, TrendData, WidgetMeta } from './types';
import { AlertsBody, FunnelBody, KpisBody, ShortcutsBody, TableBody, TrendBody } from './WidgetBodies';

interface EditControls {
  onUp?: () => void;
  onDown?: () => void;
  onToggle: () => void;
}

/** A dashboard card that loads its own data, so one slow or failing widget never blocks the rest. */
export default function WidgetCard({ widget, edit }: { widget: WidgetMeta; edit?: EditControls }) {
  const navigate = useNavigate();
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(widget.type !== 'shortcuts');

  const load = useCallback(() => {
    if (widget.type === 'shortcuts') return;
    setLoading(true);
    setError('');
    api
      .get<{ data: unknown }>(`/dashboard/widgets/${encodeURIComponent(widget.key)}`)
      .then((r) => setData(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [widget.key, widget.type]);

  useEffect(() => {
    if (!edit) load();
  }, [load, edit]);

  const link = (data as { link?: string } | null)?.link;
  let body: ReactNode = null;
  if (edit) body = <div className="widget-edit-note">{widget.description}</div>;
  else if (loading) body = <div className={`skeleton sk-${widget.type}`} aria-label="Loading" />;
  else if (error)
    body = (
      <div className="widget-error">
        Couldn't load this widget. <button className="btn ghost sm" onClick={load}>Retry</button>
      </div>
    );
  else if (widget.type === 'shortcuts') body = <ShortcutsBody />;
  else if (data) {
    if (widget.type === 'kpis') body = <KpisBody data={data as KpisData} />;
    if (widget.type === 'trend') body = <TrendBody data={data as TrendData} />;
    if (widget.type === 'funnel') body = <FunnelBody data={data as FunnelData} />;
    if (widget.type === 'table') body = <TableBody data={data as TableData} />;
    if (widget.type === 'alerts') body = <AlertsBody data={data as AlertsData} />;
  }

  // KPI groups and shortcuts read as part of the page, not boxed cards.
  const bare = (widget.type === 'kpis' || widget.type === 'shortcuts') && !edit;
  return (
    <section className={`widget size-${widget.size}${bare ? ' bare' : ''}${widget.hidden ? ' is-hidden' : ''}`} aria-label={widget.title}>
      <header className="widget-head">
        <h2>{widget.title}</h2>
        {edit ? (
          <div className="widget-edit-actions">
            <IconButton icon="arrowUp" label="Move up" onClick={edit.onUp} disabled={!edit.onUp} />
            <IconButton icon="arrowDown" label="Move down" onClick={edit.onDown} disabled={!edit.onDown} />
            <button className={`btn sm ${widget.hidden ? 'secondary' : 'ghost'}`} onClick={edit.onToggle} aria-pressed={!widget.hidden}>
              {widget.hidden ? 'Show' : 'Hide'}
            </button>
          </div>
        ) : (
          link && (
            <button className="btn ghost sm" onClick={() => navigate(link)}>
              View all
            </button>
          )
        )}
      </header>
      <div className="widget-body">{body}</div>
    </section>
  );
}
