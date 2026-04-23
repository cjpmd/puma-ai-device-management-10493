import { Capacitor } from '@capacitor/core';
import { localRecordings, type LocalRecording } from './localRecordings';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export class UploadCancelled extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelled';
  }
}

export class WifiRequired extends Error {
  constructor() {
    super('Waiting for WiFi');
    this.name = 'WifiRequired';
  }
}

/**
 * Returns true if the device is currently connected via WiFi (or we can't
 * reliably tell, in which case we treat it as WiFi to avoid blocking the
 * web preview/desktop).
 */
export const isOnWifi = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    if (!status.connected) return false;
    return status.connectionType === 'wifi' || status.connectionType === 'unknown';
  } catch (e) {
    console.warn('[uploadRecording] Network plugin missing, assuming WiFi', e);
    return true;
  }
};

const readBlobFromRecording = async (rec: LocalRecording): Promise<Blob> => {
  // iOS native file URI — fetch directly to avoid base64 OOM (project rule)
  if (!rec.filesystemPath) {
    const uri = rec.filePath.startsWith('file://') ? rec.filePath : `file://${rec.filePath}`;
    try {
      const response = await fetch(uri);
      return await response.blob();
    } catch (e) {
      // Capacitor convertFileSrc fallback
      try {
        const { Capacitor: Cap } = await import('@capacitor/core');
        const httpUri = Cap.convertFileSrc(rec.filePath);
        const r2 = await fetch(httpUri);
        return await r2.blob();
      } catch {
        throw e;
      }
    }
  }
  // Filesystem fallback (web/Android) — base64 then to Blob
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const result = await Filesystem.readFile({
    path: rec.filePath,
    directory: Directory.Data,
  });
  const base64 = typeof result.data === 'string' ? result.data : '';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: rec.mimeType });
};

interface UploadOpts {
  signal?: AbortSignal;
  onProgress?: (pct: number) => void;
}

/**
 * Upload a single local recording to Wasabi via the existing donor token
 * edge functions, persisting progress & status into the local registry.
 */
export const uploadLocalRecording = async (
  recordingId: string,
  opts: UploadOpts = {},
): Promise<void> => {
  const rec = localRecordings.get(recordingId);
  if (!rec) throw new Error('Recording not found');
  if (rec.status === 'uploaded') return;

  // WiFi-only gate
  if (localRecordings.getWifiOnly()) {
    const wifi = await isOnWifi();
    if (!wifi) {
      localRecordings.update(rec.id, { status: 'pending', lastError: 'Waiting for WiFi' });
      throw new WifiRequired();
    }
  }

  localRecordings.update(rec.id, { status: 'uploading', progress: 0, lastError: undefined });
  opts.onProgress?.(0);

  const filename = `recording-${rec.id}.${rec.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;

  try {
    // 1. Ask edge function for a presigned PUT URL
    const urlRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({
        match_id: rec.matchId,
        camera_side: rec.cameraSide,
        filename,
        content_type: rec.mimeType,
        upload_token: rec.uploadToken,
      }),
    });
    const urlData = await urlRes.json();
    if (!urlRes.ok) throw new Error(urlData.error || 'Failed to get upload URL');

    // 2. Read file off disk (Blob, not base64) and PUT to Wasabi
    const blob = await readBlobFromRecording(rec);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          localRecordings.update(rec.id, { progress: pct });
          opts.onProgress?.(pct);
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('Upload network error')));
      xhr.addEventListener('abort', () => reject(new UploadCancelled()));
      if (opts.signal) {
        if (opts.signal.aborted) {
          xhr.abort();
          return;
        }
        opts.signal.addEventListener('abort', () => xhr.abort());
      }
      xhr.open('PUT', urlData.presigned_url);
      xhr.setRequestHeader('Content-Type', rec.mimeType);
      xhr.send(blob);
    });

    // 3. Confirm with edge function (marks token used + updates match_videos)
    const confirmRes = await fetch(`${SUPABASE_URL}/functions/v1/confirm-guest-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({
        upload_token: rec.uploadToken,
        match_id: rec.matchId,
        camera_side: rec.cameraSide,
        file_size: rec.sizeBytes,
      }),
    });
    if (!confirmRes.ok) {
      const err = await confirmRes.json().catch(() => ({}));
      throw new Error(err?.error || 'Confirm failed');
    }

    localRecordings.update(rec.id, {
      status: 'uploaded',
      progress: 100,
      uploadedAt: new Date().toISOString(),
      lastError: undefined,
    });
    opts.onProgress?.(100);
  } catch (err: any) {
    if (err instanceof UploadCancelled) {
      localRecordings.update(rec.id, { status: 'pending', lastError: 'Cancelled' });
      throw err;
    }
    if (err instanceof WifiRequired) throw err;
    const msg = err?.message || String(err);
    localRecordings.update(rec.id, { status: 'failed', lastError: msg });
    throw err;
  }
};