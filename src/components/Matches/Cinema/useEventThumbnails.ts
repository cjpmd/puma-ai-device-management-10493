import { useEffect, useRef, useState } from 'react';

/**
 * Generates JPEG thumbnails by seeking an offscreen <video> element to
 * each event's timestamp and drawing the frame to a <canvas>. Results
 * are cached per (videoUrl, time) pair in module-level memory.
 */
const cache = new Map<string, string>();

const cacheKey = (url: string, t: number) => `${url}::${t.toFixed(2)}`;

export function useEventThumbnails(
  videoUrl: string | null,
  times: number[],
  width = 240,
) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!videoUrl || times.length === 0) {
      setThumbs({});
      return;
    }

    // Seed any pre-cached thumbs
    const initial: Record<number, string> = {};
    times.forEach((t) => {
      const k = cacheKey(videoUrl, t);
      const cached = cache.get(k);
      if (cached) initial[t] = cached;
    });
    setThumbs(initial);

    const missing = times.filter((t) => !cache.has(cacheKey(videoUrl, t)));
    if (missing.length === 0) return;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;

    const canvas = document.createElement('canvas');
    let ratio = 16 / 9;

    const onLoaded = async () => {
      ratio = (video.videoWidth || 16) / (video.videoHeight || 9);
      canvas.width = width;
      canvas.height = Math.round(width / ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      for (const t of missing) {
        if (cancelledRef.current) return;
        try {
          await seek(video, t);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          cache.set(cacheKey(videoUrl, t), dataUrl);
          if (!cancelledRef.current) {
            setThumbs((prev) => ({ ...prev, [t]: dataUrl }));
          }
        } catch {
          // ignore individual frame errors
        }
      }
    };

    video.addEventListener('loadedmetadata', onLoaded, { once: true });

    return () => {
      cancelledRef.current = true;
      video.removeAttribute('src');
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, times.join(','), width]);

  return thumbs;
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('seek failed'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = Math.max(0, Math.min(t, video.duration || t));
    } catch (e) {
      onError();
    }
  });
}
