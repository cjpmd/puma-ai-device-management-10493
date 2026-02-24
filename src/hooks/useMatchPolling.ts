import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Match {
  id: string;
  title: string;
  match_date: string | null;
  location: string | null;
  status: string;
  created_at: string;
  club_id: string | null;
  team_id: string | null;
}

interface ProcessingJob {
  id: string;
  match_id: string;
  runpod_job_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  gpu_type: string | null;
  processing_logs: string | null;
  output_video_path: string | null;
  output_highlights_path: string | null;
  output_metadata_path: string | null;
}

interface MatchVideo {
  id: string;
  match_id: string;
  camera_side: string;
  wasabi_path: string | null;
  upload_status: string;
  file_size: number | null;
}

export function useMatchPolling(matchId?: string) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setMatches(data as Match[]);
    setLoading(false);
  }, []);

  const fetchMatchDetail = useCallback(async () => {
    if (!matchId) return;
    const [matchRes, videosRes, jobsRes] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).single(),
      supabase.from('match_videos').select('*').eq('match_id', matchId),
      supabase.from('processing_jobs').select('*').eq('match_id', matchId).order('created_at', { ascending: false }),
    ]);
    if (matchRes.data) setMatch(matchRes.data as Match);
    if (videosRes.data) setVideos(videosRes.data as MatchVideo[]);
    if (jobsRes.data) setJobs(jobsRes.data as ProcessingJob[]);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    if (matchId) {
      fetchMatchDetail();
    } else {
      fetchMatches();
    }

    // Poll every 15s for active states
    const interval = setInterval(() => {
      if (matchId) fetchMatchDetail();
      else fetchMatches();
    }, 15000);

    return () => clearInterval(interval);
  }, [matchId, fetchMatches, fetchMatchDetail]);

  // Realtime for matches
  useEffect(() => {
    const channel = supabase
      .channel('match-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        if (matchId) fetchMatchDetail();
        else fetchMatches();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processing_jobs' }, () => {
        if (matchId) fetchMatchDetail();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, fetchMatches, fetchMatchDetail]);

  return { matches, match, videos, jobs, loading, refetch: matchId ? fetchMatchDetail : fetchMatches };
}
