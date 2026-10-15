import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '../components/ui';
import { useViewport } from '../hooks/useMediaQuery';
import { api } from '../lib/api';
import { relativeDays } from '../lib/format';
import { Icons } from './icons';

interface Notification {
  id: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
}

const POLL_MS = 60_000;

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return relativeDays(iso);
}

/**
 * Unread badge + list. Polls the count every minute and when the tab regains focus; opens as a
 * popover on desktop/tablet and a bottom sheet on phones.
 */
export default function NotificationBell({ withLabel = false }: { withLabel?: boolean }) {
  const viewport = useViewport();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    api
      .get<{ count: number }>('/notifications/unread-count')
      .then((r) => setCount(r.count))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    const onFocus = () => refreshCount();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ data: Notification[] }>('/notifications?pageSize=30')
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [open]);

  // Close the desktop popover on outside click / Escape.
  useEffect(() => {
    if (!open || viewport === 'phone') return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, viewport]);

  async function markRead(n: Notification) {
    if (n.readAt) return;
    setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
    setCount((c) => Math.max(0, c - 1));
    await api.post(`/notifications/${n.id}/read`, {}).catch(() => undefined);
  }

  async function markAll() {
    setItems((list) => list?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
    setCount(0);
    await api.post('/notifications/read-all', {}).catch(() => undefined);
  }

  const list = (
    <>
      <div className="notif-head">
        <span className="notif-title">Notifications</span>
        {count > 0 && (
          <button className="btn ghost sm" onClick={markAll}>
            Mark all read
          </button>
        )}
      </div>
      <div className="notif-list">
        {items === null && <div className="notif-empty">Loading…</div>}
        {items?.length === 0 && <div className="notif-empty">You're all caught up.</div>}
        {items?.map((n) => (
          <button key={n.id} className={`notif-item${n.readAt ? '' : ' unread'}`} onClick={() => markRead(n)}>
            <span className="notif-dot" aria-hidden />
            <span className="notif-text">
              <span className="notif-item-title">{n.title}</span>
              {n.body && <span className="notif-body">{n.body}</span>}
              <span className="notif-time">{timeAgo(n.createdAt)}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );

  const label = count > 0 ? `Notifications, ${count} unread` : 'Notifications';
  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className={withLabel ? 'nav-item' : 'icon-btn'} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="bell">
          <Icons.bell />
          {count > 0 && <span className="badge">{count > 99 ? '99+' : count}</span>}
        </span>
        {withLabel && <span className="nav-label">Notifications</span>}
      </button>
      {open && viewport === 'phone' && (
        <Dialog
          title="Notifications"
          onClose={() => setOpen(false)}
          footer={
            count > 0 ? (
              <button className="btn secondary" onClick={markAll}>
                Mark all read
              </button>
            ) : undefined
          }
        >
          {list}
        </Dialog>
      )}
      {open && viewport !== 'phone' && (
        <div className="notif-popover" role="dialog" aria-label="Notifications">
          {list}
        </div>
      )}
    </div>
  );
}
