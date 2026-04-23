/**
 * Persistent local registry of recordings made on a donor phone.
 *
 * The donor app stores each recording's metadata in localStorage
 * (under `puma.localRecordings`) and the actual MP4 either:
 *  - stays at the native file:// URI returned by CameraPreview on iOS, OR
 *  - is written into Capacitor Filesystem (Directory.Data) as a fallback.
 *
 * This is the donor phone's source of truth for recordings between
 * "Stop" and "Upload confirmed by server".
 */

const STORAGE_KEY = 'puma.localRecordings';
const WIFI_ONLY_KEY = 'puma.uploadWifiOnly';
const GRACE_MS = 24 * 60 * 60 * 1000; // keep uploaded files 24h before delete

export type RecordingStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'failed';

export interface LocalRecording {
  id: string;
  matchId: string;
  matchTitle: string;
  cameraSide: 'left' | 'right';
  uploadToken: string;
  /** Either a native file:// URI (iOS) or a Filesystem-relative path */
  filePath: string;
  /** Whether `filePath` is a Capacitor Filesystem-relative path */
  filesystemPath: boolean;
  sizeBytes: number;
  durationSec: number;
  mimeType: string;
  recordedAt: string; // ISO
  status: RecordingStatus;
  progress: number; // 0-100
  lastError?: string;
  uploadedAt?: string; // ISO once successful
}

const safeRead = (): LocalRecording[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeWrite = (entries: LocalRecording[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('[localRecordings] Persist failed', e);
  }
};

export const localRecordings = {
  list(): LocalRecording[] {
    return safeRead().sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
  },

  get(id: string): LocalRecording | undefined {
    return safeRead().find((r) => r.id === id);
  },

  add(entry: LocalRecording): LocalRecording {
    const all = safeRead();
    const existingIdx = all.findIndex((r) => r.id === entry.id);
    if (existingIdx >= 0) all[existingIdx] = entry;
    else all.push(entry);
    safeWrite(all);
    return entry;
  },

  update(id: string, patch: Partial<LocalRecording>): LocalRecording | undefined {
    const all = safeRead();
    const idx = all.findIndex((r) => r.id === id);
    if (idx < 0) return undefined;
    all[idx] = { ...all[idx], ...patch };
    safeWrite(all);
    return all[idx];
  },

  remove(id: string) {
    const all = safeRead().filter((r) => r.id !== id);
    safeWrite(all);
  },

  /** Generate a uuid for a new recording. */
  newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  },

  // ─── WiFi-only preference ───
  getWifiOnly(): boolean {
    try {
      return localStorage.getItem(WIFI_ONLY_KEY) === '1';
    } catch {
      return false;
    }
  },
  setWifiOnly(v: boolean) {
    try {
      localStorage.setItem(WIFI_ONLY_KEY, v ? '1' : '0');
    } catch {}
  },

  /**
   * Sweep: delete uploaded entries older than 24h and remove their files.
   * Safe to call on app open. Failures are logged but never throw.
   */
  async sweepUploaded() {
    const all = safeRead();
    const now = Date.now();
    const toKeep: LocalRecording[] = [];
    for (const r of all) {
      if (
        r.status === 'uploaded' &&
        r.uploadedAt &&
        now - new Date(r.uploadedAt).getTime() > GRACE_MS
      ) {
        try {
          if (r.filesystemPath) {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            try {
              await Filesystem.deleteFile({
                path: r.filePath,
                directory: Directory.Data,
              });
            } catch (e) {
              console.warn('[localRecordings] sweep deleteFile failed', e);
            }
          }
        } catch {}
        // drop entry
      } else {
        toKeep.push(r);
      }
    }
    if (toKeep.length !== all.length) safeWrite(toKeep);
  },
};

/** Format helpers for UI rows. */
export const formatBytes = (b: number) => {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
};

export const formatDuration = (s: number) => {
  if (!s || s < 0) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};