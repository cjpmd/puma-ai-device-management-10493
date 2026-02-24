import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, XCircle, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface VideoUploadCardProps {
  matchId: string;
  cameraSide: 'left' | 'right';
  existingVideo?: {
    upload_status: string;
    wasabi_path: string | null;
    file_size: number | null;
  };
  onUploadComplete: () => void;
}

const MAX_SIZE = 150 * 1024 * 1024 * 1024; // 150GB
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime'];

export function VideoUploadCard({ matchId, cameraSide, existingVideo, onUploadComplete }: VideoUploadCardProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isUploaded = existingVideo?.upload_status === 'uploaded';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only MP4 and MOV files are allowed.', variant: 'destructive' });
      return;
    }

    if (file.size > MAX_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 150GB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Get presigned URL
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('generate-upload-url', {
        body: { match_id: matchId, camera_side: cameraSide, filename: file.name, content_type: file.type },
      });

      if (response.error || !response.data?.presigned_url) {
        throw new Error(response.error?.message || 'Failed to get upload URL');
      }

      // Upload via XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('PUT', response.data.presigned_url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Mark as uploaded via service role (through edge function update)
      // For now, update via client — RLS allows it since user owns the match
      const { error: updateErr } = await supabase
        .from('match_videos')
        .update({ upload_status: 'uploaded', file_size: file.size })
        .eq('match_id', matchId)
        .eq('camera_side', cameraSide);

      if (updateErr) throw updateErr;

      toast({ title: 'Upload complete', description: `${cameraSide} camera video uploaded successfully.` });
      onUploadComplete();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {cameraSide === 'left' ? 'Left' : 'Right'} Camera
          </span>
          {isUploaded && <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Uploaded</Badge>}
          {existingVideo?.upload_status === 'failed' && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uploading ? (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">{progress}%</p>
          </div>
        ) : (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".mp4,.mov"
              onChange={handleFileSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant={isUploaded ? 'outline' : 'default'}
              className="w-full"
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploaded ? 'Re-upload' : 'Upload Video'}
            </Button>
            {existingVideo?.file_size && (
              <p className="text-xs text-muted-foreground mt-2">
                {(existingVideo.file_size / (1024 * 1024 * 1024)).toFixed(2)} GB
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
