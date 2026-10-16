import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from '../app/icons';
import { useViewport } from '../hooks/useMediaQuery';
import { api } from '../lib/api';
import { date } from '../lib/format';
import { Alert, IconButton } from './ui';

interface FileItem {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

interface Upload {
  name: string;
  progress: number;
  error?: string;
}

function humanSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** PUT with upload progress (fetch has no upload progress events). */
function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(file);
  });
}

/**
 * Files attached to a record. Uploads go straight to object storage via a presigned URL; on
 * phones a "Take photo" button opens the camera, and GPS is attached when the browser allows.
 */
export default function Attachments({
  entityType,
  entityId,
  canUpload = true,
}: {
  entityType: string;
  entityId: string;
  canUpload?: boolean;
}) {
  const viewport = useViewport();
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api
      .get<FileItem[]>(`/files?entityType=${entityType}&entityId=${entityId}`)
      .then(setFiles)
      .catch((e: Error) => setError(e.message));
  }, [entityType, entityId]);
  useEffect(load, [load]);

  async function position(): Promise<{ gpsLat?: number; gpsLng?: number }> {
    if (!('geolocation' in navigator)) return {};
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ gpsLat: Number(p.coords.latitude.toFixed(7)), gpsLng: Number(p.coords.longitude.toFixed(7)) }),
        () => resolve({}),
        { timeout: 4000, maximumAge: 60_000 },
      );
    });
  }

  async function uploadOne(file: File, withGps: boolean) {
    const update = (patch: Partial<Upload>) => setUploads((list) => list.map((u) => (u.name === file.name ? { ...u, ...patch } : u)));
    try {
      const gps = withGps ? await position() : {};
      const res = await api.post<{ file: FileItem; upload: { url: string; headers: Record<string, string> } }>('/files/uploads', {
        entityType,
        entityId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        capturedAt: withGps ? new Date().toISOString() : undefined,
        ...gps,
      });
      await putWithProgress(res.upload.url, file, res.upload.headers, (progress) => update({ progress }));
      await api.post(`/files/${res.file.id}/complete`, {});
      setUploads((list) => list.filter((u) => u.name !== file.name));
      load();
    } catch (e) {
      update({ error: (e as Error).message });
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>, withGps = false) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    setUploads((list) => [...list, ...picked.map((f) => ({ name: f.name, progress: 0 }))]);
    picked.forEach((f) => void uploadOne(f, withGps));
  }

  async function open(f: FileItem) {
    try {
      const inline = !!f.mimeType && (f.mimeType.startsWith('image/') || f.mimeType === 'application/pdf');
      const { url } = await api.get<{ url: string }>(`/files/${f.id}/url?inline=${inline}`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(f: FileItem) {
    if (!window.confirm(`Delete ${f.fileName}?`)) return;
    try {
      await api.del(`/files/${f.id}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="attachments">
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}
      {canUpload && (
        <div className="attach-actions">
          <button className="btn secondary sm" onClick={() => fileInput.current?.click()}>
            <Icons.plus width={16} height={16} /> Upload files
          </button>
          {viewport === 'phone' && (
            <button className="btn secondary sm" onClick={() => cameraInput.current?.click()}>
              <Icons.camera width={16} height={16} /> Take photo
            </button>
          )}
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => onPick(e)} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPick(e, true)} />
        </div>
      )}
      {uploads.map((u) => (
        <div key={u.name} className="upload-row">
          <span className="file-name">{u.name}</span>
          {u.error ? (
            <span className="error">{u.error}</span>
          ) : (
            <progress max={100} value={u.progress} aria-label={`Uploading ${u.name}`} />
          )}
        </div>
      ))}
      {files?.length === 0 && uploads.length === 0 && <div className="widget-empty">No files yet.</div>}
      <ul className="file-list">
        {files?.map((f) => (
          <li key={f.id}>
            <button className="file-open" onClick={() => open(f)}>
              <Icons.quotations width={18} height={18} />
              <span className="file-name">{f.fileName}</span>
            </button>
            <span className="file-meta">
              {humanSize(f.sizeBytes)} · {date(f.createdAt)}
            </span>
            {canUpload && <IconButton icon="close" label={`Delete ${f.fileName}`} onClick={() => remove(f)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
