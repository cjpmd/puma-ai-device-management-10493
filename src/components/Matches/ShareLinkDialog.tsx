import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Copy, Loader2, Share2, Trash2, Link2, MessageCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  matchTitle?: string | null;
  fileType: 'video' | 'highlights';
}

interface ShareRow {
  id: string;
  share_token: string;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

const fileTypeLabel = (t: 'video' | 'highlights') =>
  t === 'video' ? 'Final Follow Cam' : 'Highlights';

export function ShareLinkDialog({ open, onOpenChange, matchId, matchTitle, fileType }: ShareLinkDialogProps) {
  const { toast } = useToast();
  const [expiry, setExpiry] = useState<string>('7');
  const [generating, setGenerating] = useState(false);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);

  const loadShares = async () => {
    setLoadingShares(true);
    const { data, error } = await supabase
      .from('match_shares')
      .select('id, share_token, expires_at, revoked, created_at')
      .eq('match_id', matchId)
      .eq('file_type', fileType)
      .order('created_at', { ascending: false });
    if (!error && data) setShares(data as ShareRow[]);
    setLoadingShares(false);
  };

  useEffect(() => {
    if (open) {
      setLatestUrl(null);
      loadShares();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matchId, fileType]);

  const buildUrl = (token: string) => `${window.location.origin}/share/${token}`;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const expiresInDays = expiry === 'never' ? null : Number(expiry);
      const { data, error } = await supabase.functions.invoke('create-share-link', {
        body: {
          match_id: matchId,
          file_type: fileType,
          expires_in_days: expiresInDays,
          app_origin: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      const url = data?.url || buildUrl(data?.share_token);
      setLatestUrl(url);
      await loadShares();
      toast({ title: 'Share link created' });
    } catch (err: any) {
      toast({ title: 'Could not create share link', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const nativeShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: matchTitle || 'Match video',
          text: `${matchTitle || 'Match video'} — ${fileTypeLabel(fileType)}`,
          url,
        });
      } catch {
        // user cancelled
      }
    } else {
      copy(url);
    }
  };

  const whatsapp = (url: string) => {
    const text = encodeURIComponent(`${matchTitle || 'Match video'} — watch here: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const email = (url: string) => {
    const subject = encodeURIComponent(matchTitle || 'Match video');
    const body = encodeURIComponent(`Watch the ${fileTypeLabel(fileType)} here:\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from('match_shares').update({ revoked: true }).eq('id', id);
    if (error) {
      toast({ title: 'Could not revoke', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Link revoked' });
    loadShares();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {fileTypeLabel(fileType)}
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can watch this video. No login required.
          </DialogDescription>
        </DialogHeader>

        {/* Generator */}
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Link expires after</label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">24 hours</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
              Generate link
            </Button>
          </div>

          {latestUrl && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input readOnly value={latestUrl} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button size="icon" variant="outline" onClick={() => copy(latestUrl)} aria-label="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => nativeShare(latestUrl)}>
                  <Share2 className="h-3 w-3 mr-1" /> Share
                </Button>
                <Button size="sm" variant="outline" onClick={() => whatsapp(latestUrl)}>
                  <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => email(latestUrl)}>
                  <Mail className="h-3 w-3 mr-1" /> Email
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Existing links */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">Existing links</div>
          {loadingShares ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : shares.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No share links yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shares.map((s) => {
                const url = buildUrl(s.share_token);
                const expired = s.expires_at && new Date(s.expires_at) < new Date();
                const status = s.revoked
                  ? { label: 'Revoked', className: 'bg-muted text-muted-foreground' }
                  : expired
                  ? { label: 'Expired', className: 'bg-muted text-muted-foreground' }
                  : { label: 'Active', className: 'bg-emerald-100 text-emerald-800' };
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border p-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={status.className}>{status.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {s.expires_at ? `expires ${new Date(s.expires_at).toLocaleDateString()}` : 'no expiry'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">{url}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copy(url)} aria-label="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!s.revoked && (
                      <Button size="icon" variant="ghost" onClick={() => revoke(s.id)} aria-label="Revoke" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}