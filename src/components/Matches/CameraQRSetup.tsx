import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface CameraQRSetupProps {
  matchId: string;
  cameraSide: 'left' | 'right';
  uploadStatus?: string;
}

export function CameraQRSetup({ matchId, cameraSide, uploadStatus }: CameraQRSetupProps) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const isUploaded = uploadStatus === 'uploaded';
  const captureUrl = token ? `playeranalysis://capture/${token}` : null;

  const generateToken = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke('generate-camera-token', {
        body: { match_id: matchId, camera_side: cameraSide },
      });
      if (res.error) throw new Error(res.error.message);
      setToken(res.data.token);
      setExpiresAt(res.data.expires_at);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = () => {
    if (captureUrl) {
      navigator.clipboard.writeText(captureUrl);
      toast({ title: 'Deep link copied', description: 'Paste on a phone with Player Analysis installed' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{cameraSide === 'left' ? '📷 Left Camera' : '📷 Right Camera'}</span>
          {isUploaded && (
            <Badge className="bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-3 w-3 mr-1" /> Uploaded
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isUploaded ? (
          <p className="text-sm text-muted-foreground text-center">Video received ✓</p>
        ) : !token ? (
          <Button onClick={generateToken} disabled={generating} className="w-full">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Generate QR Code
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center bg-white p-3 sm:p-4 rounded-lg">
              <div className="w-full max-w-[180px] aspect-square">
                <QRCodeSVG value={captureUrl!} size={180} className="w-full h-full" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Open <strong>Player Analysis</strong> on the donor phone → tap{' '}
              <strong>Scan Camera QR</strong> → point at this code.
              <br />
              <span className="opacity-70">(Don\u2019t use the iOS Camera app — it ignores custom links.)</span>
            </p>
            <Button variant="outline" size="sm" className="w-full h-11" onClick={copyLink}>
              <Copy className="h-3 w-3 mr-2" /> Copy deep link
            </Button>
            <Button variant="ghost" size="sm" className="w-full h-11" onClick={generateToken} disabled={generating}>
              <RefreshCw className="h-3 w-3 mr-2" /> Regenerate
            </Button>
            {expiresAt && (
              <p className="text-xs text-muted-foreground text-center">
                Expires {new Date(expiresAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
