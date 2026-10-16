import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../app/Shell';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Alert, Button } from './ui';

interface CommentItem {
  id: string;
  parentId: string | null;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
}
interface Person {
  id: string;
  name: string;
  roles: string[];
}

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Threaded comments with @mentions. Typing "@" suggests colleagues; mentioned people are notified. */
export default function Comments({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { user } = useSession();
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<Person[]>([]);
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    api
      .get<CommentItem[]>(`/comments?entityType=${entityType}&entityId=${entityId}`)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [entityType, entityId]);
  useEffect(load, [load]);
  useEffect(() => {
    api
      .get<Person[]>('/people/directory')
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return people.filter((p) => p.id !== user?.id && p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, people, user]);

  function onChange(v: string) {
    setBody(v);
    const caret = box.current?.selectionStart ?? v.length;
    const m = /(^|\s)@([\w.]*)$/.exec(v.slice(0, caret));
    setQuery(m ? m[2] : null);
  }

  function pick(p: Person) {
    const caret = box.current?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@([\w.]*)$/, `@${p.name} `);
    setBody(before + body.slice(caret));
    setMentions((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    setQuery(null);
    box.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      pick(suggestions[0]);
    } else if (e.key === 'Escape') setQuery(null);
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      // Only people whose @Name is still in the text are mentioned.
      const ids = mentions.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
      await api.post('/comments', { entityType, entityId, body: body.trim(), parentId: replyTo?.id, mentionUserIds: ids });
      setBody('');
      setMentions([]);
      setReplyTo(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: CommentItem) {
    if (!window.confirm('Delete this comment?')) return;
    await api.del(`/comments/${c.id}`).catch((e: Error) => setError(e.message));
    load();
  }

  const roots = items?.filter((c) => !c.parentId) ?? [];
  const replies = (id: string) => items?.filter((c) => c.parentId === id) ?? [];

  const renderBody = (text: string) =>
    text.split(/(@[A-Z][\w.]*(?: [A-Z][\w.]*)*)/g).map((part, i) =>
      part.startsWith('@') ? (
        <mark key={i} className="mention">
          {part}
        </mark>
      ) : (
        part
      ),
    );

  const renderComment = (c: CommentItem, isReply = false) => (
    <li key={c.id} className={`comment${isReply ? ' reply' : ''}`}>
      <Avatar name={c.authorName} />
      <div className="comment-main">
        <div className="comment-head">
          <span className="comment-author">{c.authorName}</span>
          <span className="comment-time">
            {when(c.createdAt)}
            {c.editedAt ? ' · edited' : ''}
          </span>
        </div>
        <div className="comment-body">{renderBody(c.body)}</div>
        <div className="comment-actions">
          {!isReply && (
            <button
              className="link-btn"
              onClick={() => {
                setReplyTo(c);
                box.current?.focus();
              }}
            >
              Reply
            </button>
          )}
          {c.authorId === user?.id && (
            <button className="link-btn" onClick={() => remove(c)}>
              Delete
            </button>
          )}
        </div>
        {!isReply && replies(c.id).length > 0 && <ul className="comment-list">{replies(c.id).map((r) => renderComment(r, true))}</ul>}
      </div>
    </li>
  );

  return (
    <div className="comments">
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}
      {items?.length === 0 && <div className="widget-empty">No comments yet. Start the conversation below.</div>}
      <ul className="comment-list">{roots.map((c) => renderComment(c))}</ul>
      <form className="comment-form" onSubmit={submit}>
        {replyTo && (
          <div className="replying">
            Replying to {replyTo.authorName}
            <button type="button" className="link-btn" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </div>
        )}
        <div className="composer">
          <textarea
            ref={box}
            value={body}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder="Write a comment… type @ to mention someone"
            rows={2}
            aria-label="Comment"
          />
          {suggestions.length > 0 && (
            <ul className="mention-list" role="listbox" aria-label="Mention someone">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                  >
                    <span>{p.name}</span>
                    <span className="mention-role">{p.roles[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="composer-foot">
          <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
            {replyTo ? 'Reply' : 'Comment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
