import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { X, Loader2 } from 'lucide-react';

/**
 * Native in-app QR scanner.
 *
 * Donor phone flow:
 *   Open app → tap "Scan Camera QR" → point at master phone's QR.
 *   Accepts `playeranalysis://capture/<token>` (current) and
 *   `https://…/capture/<token>` (legacy QRs) and routes to /capture/:token.
 */
export default function ScanQR() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'unsupported'>('idle');
  const handledRef = useRef(false);

  const extractToken = (raw: string): string | null => {
    const value = raw.trim();
    const deepLinkPrefix = 'playeranalysis://capture/';
    if (value.startsWith(deepLinkPrefix)) {
      return value.slice(deepLinkPrefix.length).split(/[?#]/)[0] || null;
    }
    // Back-compat with any older https QR codes.
    const httpsMatch = value.match(/\/capture\/([^/?#]+)/i);
    if (httpsMatch) return httpsMatch[1];
    return null;
  };

  const stopScan = async () => {
    try {
      await BarcodeScanner.stopScan();
    } catch {
      /* no-op */
    }
    document.querySelector('body')?.classList.remove('barcode-scanner-active');
  };

  const cancel = async () => {
    await stopScan();
    navigate(-1);
  };

  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const start = async () => {
      if (!Capacitor.isNativePlatform()) {
        setStatus('unsupported');
        return;
      }
      setStatus('starting');
      try {
        const { supported } = await BarcodeScanner.isSupported();
        if (!supported) {
          setStatus('unsupported');
          return;
        }

        const perm = await BarcodeScanner.checkPermissions();
        if (perm.camera !== 'granted') {
          const req = await BarcodeScanner.requestPermissions();
          if (req.camera !== 'granted') {
            toast({
              title: 'Camera permission required',
              description: 'Enable camera access in Settings to scan QR codes.',
              variant: 'destructive',
            });
            navigate(-1);
            return;
          }
        }

        // Make webview transparent so the native camera feed shows through.
        document.querySelector('body')?.classList.add('barcode-scanner-active');

        listenerHandle = await BarcodeScanner.addListener('barcodeScanned', async (event) => {
          if (handledRef.current) return;
          const value = event.barcode?.rawValue ?? '';
          const token = extractToken(value);
          if (!token) {
            // Not our QR — keep scanning, but flash a quick hint once.
            return;
          }
          handledRef.current = true;
          await stopScan();
          if (listenerHandle) {
            await listenerHandle.remove();
            listenerHandle = null;
          }
          navigate(`/capture/${token}`);
        });

        await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode] });
        setStatus('scanning');
      } catch (err: any) {
        toast({
          title: 'Scanner error',
          description: err?.message ?? 'Could not start the camera.',
          variant: 'destructive',
        });
        navigate(-1);
      }
    };

    start();

    return () => {
      handledRef.current = true;
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'unsupported') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-background">
        <h1 className="text-xl font-semibold">QR scanning needs the native app</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The in-app scanner only runs on the installed iOS app. Open Player Analysis on
          your phone, then tap <strong>Scan Camera QR</strong> from the home screen.
        </p>
        <Button onClick={() => navigate(-1)} variant="outline">Go back</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Reticle overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-64 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
        </div>
      </div>

      {/* Helper text */}
      <div className="absolute top-24 left-0 right-0 flex justify-center px-6 pointer-events-none">
        <p className="text-white text-center text-sm bg-black/50 backdrop-blur px-4 py-2 rounded-full">
          {status === 'scanning' ? 'Point at the master phone\u2019s QR code' : 'Starting camera…'}
        </p>
      </div>

      {/* Cancel button */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-auto">
        <Button
          onClick={cancel}
          size="lg"
          variant="secondary"
          className="rounded-full px-6 shadow-lg"
        >
          {status === 'starting' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
          Cancel
        </Button>
      </div>
    </div>
  );
}