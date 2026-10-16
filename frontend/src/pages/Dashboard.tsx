import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, PageHeader } from '../components/ui';
import WidgetCard from '../dashboard/WidgetCard';
import { DashboardLayout, WidgetMeta } from '../dashboard/types';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

/**
 * Role-based home dashboard. The server decides which widgets a user gets (their roles' layouts,
 * filtered by permission) and the data inside each one (filtered by data scope); users can
 * reorder and hide widgets for themselves.
 */
export default function Dashboard() {
  const { user } = useSession();
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [draft, setDraft] = useState<WidgetMeta[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<DashboardLayout>('/dashboard')
      .then(setLayout)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      setLayout(await api.put<DashboardLayout>('/dashboard/layout', { widgets: draft.map((w) => ({ key: w.key, hidden: w.hidden })) }));
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      setLayout(await api.del<DashboardLayout>('/dashboard/layout'));
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function move(i: number, dir: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const next = [...d];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  }

  const firstName = user?.fullName.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const editing = draft !== null;
  const widgets = editing ? draft : (layout?.widgets.filter((w) => !w.hidden) ?? []);

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle={user?.roles.join(' · ')}
        actions={
          layout &&
          (editing ? (
            <>
              {layout.customised && (
                <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
                  Reset to role default
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setDraft(null)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} loading={saving}>
                Save layout
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setDraft(layout.widgets.map((w) => ({ ...w })))}>
              Customise
            </Button>
          ))
        }
      />
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}
      {editing && <p className="muted dash-edit-hint">Reorder or hide widgets. This only changes your own dashboard.</p>}

      {!layout && !error && (
        <div className="dash-grid">
          <div className="widget size-full">
            <div className="skeleton sk-kpis" />
          </div>
          <div className="widget size-half">
            <div className="skeleton sk-table" />
          </div>
          <div className="widget size-half">
            <div className="skeleton sk-table" />
          </div>
        </div>
      )}

      <div className={`dash-grid${editing ? ' editing' : ''}`}>
        {widgets.map((w, i) => (
          <WidgetCard
            key={w.key}
            widget={w}
            edit={
              editing
                ? {
                    onUp: i > 0 ? () => move(i, -1) : undefined,
                    onDown: i < widgets.length - 1 ? () => move(i, 1) : undefined,
                    onToggle: () => setDraft((d) => d && d.map((x) => (x.key === w.key ? { ...x, hidden: !x.hidden } : x))),
                  }
                : undefined
            }
          />
        ))}
      </div>

      {layout && layout.upcoming.length > 0 && !editing && (
        <aside className="dash-upcoming" aria-label="Coming to your dashboard">
          <span className="upcoming-label">Coming to your dashboard</span>
          <span className="upcoming-items">
            {layout.upcoming.map((u) => (
              <span key={u.key} className="upcoming-chip" title={`Arrives with the ${u.module} module`}>
                {u.title}
              </span>
            ))}
          </span>
        </aside>
      )}
    </>
  );
}
