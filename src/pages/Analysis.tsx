
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MetricCard from "@/components/MetricCard";
import PerformanceChart from "@/components/PerformanceChart";
import PlayerMovementMap from "@/components/PlayerMovementMap";
import DeviceManager from "@/components/DeviceManager";
import VideoAnalysisTab from "@/components/VideoAnalysis/VideoAnalysisTab";
import IndividualPlayerTab from "@/components/Analysis/IndividualPlayerTab";
import GroupSelectionTab from "@/components/Analysis/GroupSelectionTab";
import BiometricsTab from "@/components/Analysis/BiometricsTab";
import SyncStatusIndicator from "@/components/Analysis/SyncStatusIndicator";
import ClubSelector from "@/components/Analysis/ClubSelector";
import TeamSelector from "@/components/Analysis/TeamSelector";
import { Activity, Footprints, Target, Repeat, Users, User, ChartBar, Video, Settings, Bluetooth, Share2, HeartPulse, MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { processRealTimeData } from "@/utils/sensorDataUtils";
import { Badge } from "@/components/ui/badge";
import { useActiveTeam } from "@/hooks/useActiveTeam";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define an adapter type to bridge the gap between Supabase data and our application types
interface SensorRecordingFromDB {
  id: string;
  training_session_id: string;
  x: number;
  y: number;
  z: number;
  timestamp: string;
  created_at: string;
  sensor_type: string;
}

// Function to adapt database records to the format expected by our application
const adaptSensorRecordings = (dbRecords: SensorRecordingFromDB[]): any[] => {
  return dbRecords.map(record => ({
    x: record.x.toString(),
    y: record.y.toString(),
    z: record.z.toString(),
    seconds_elapsed: record.timestamp.toString(),
    sensor: record.sensor_type,
    time: record.created_at,
  }));
};

const Analysis = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced', 'error'
  const [metrics, setMetrics] = useState({
    totalSteps: 0,
    ballTouches: 0,
    successfulPasses: 0,
    shotsOnTarget: 0
  });
  const [performanceData, setPerformanceData] = useState([]);
  const [shotData, setShotData] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [availableSessions, setAvailableSessions] = useState<{id: string, date: string, type: string}[]>([]);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [isBluetoothDialogOpen, setIsBluetoothDialogOpen] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<"connected" | "disconnected" | "searching">("disconnected");
  const [selectedClubId, setSelectedClubId] = useState<string | undefined>();
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const { activeTeam } = useActiveTeam();
  const { toast } = useToast();
  const location = useLocation();

  // Auto-select team from Home/Profile choice
  useEffect(() => {
    if (activeTeam && !selectedTeamId) {
      setSelectedTeamId(activeTeam.id);
      if (activeTeam.club_id) setSelectedClubId(activeTeam.club_id);
    }
  }, [activeTeam, selectedTeamId]);

  // Extract session ID from URL query parameters if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('sessionId');
    if (sessionId) {
      setActiveSessionId(sessionId);
      setIsLiveMode(false);
    }
  }, [location]);

  useEffect(() => {
    // Initial data fetch
    fetchAnalysisData();
    fetchAvailableSessions();

    // Set up real-time subscription for sessions table
    const sessionsChannel = supabase
      .channel('sessions-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sessions' },
        handleRealTimeUpdate
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        handleRealTimeUpdate
      )
      .subscribe();

    // Set up subscription for sensor_recordings
    const sensorRecordingsChannel = supabase
      .channel('sensor-recordings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_recordings' },
        handleSensorDataUpdate
      )
      .subscribe();

    // Additional channels for other related tables
    const objectDetectionsChannel = supabase
      .channel('object-detections')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'object_detections' },
        () => fetchAnalysisData()
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(sensorRecordingsChannel);
      supabase.removeChannel(objectDetectionsChannel);
    };
  }, [activeSessionId, isLiveMode]);

  const fetchAvailableSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, start_time, end_time, session_type')
        .order('start_time', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      if (data) {
        const formattedSessions = data.map(session => ({
          id: session.id.toString(),
          date: new Date(session.start_time).toLocaleDateString(),
          type: session.session_type || 'Training'
        }));
        
        setAvailableSessions(formattedSessions);
      }
    } catch (error) {
      console.error('Error fetching available sessions:', error);
    }
  };

  const fetchAnalysisData = async () => {
    try {
      setSyncStatus('syncing');
      
      // Fetch active session data - either the specific one from URL or the latest active session
      const query = supabase.from('sessions').select('*');
      
      if (activeSessionId) {
        query.eq('id', activeSessionId);
      } else if (isLiveMode) {
        query.is('end_time', null);
      } else {
        query.order('start_time', { ascending: false }).limit(1);
      }
      
      const { data: sessionData, error: sessionError } = await query;
      
      if (sessionError) throw sessionError;
      
      // Set session state based on if there are any active sessions
      setIsSessionActive(sessionData && sessionData.length > 0);
      
      if (sessionData && sessionData.length > 0) {
        // Set active session ID if we found one
        if (!activeSessionId && sessionData[0].id) {
          setActiveSessionId(sessionData[0].id.toString());
        }
        
        // Fetch sensor data for active sessions
        const activeSessionIds = sessionData.map(session => session.id.toString());
        const { data: sensorData, error: sensorError } = await supabase
          .from('sensor_recordings')
          .select('*')
          .in('training_session_id', activeSessionIds);
          
        if (sensorError) throw sensorError;
        
        // Process the sensor data to extract metrics
        if (sensorData && sensorData.length > 0) {
          // Adapt the data to match expected format
          const adaptedData = adaptSensorRecordings(sensorData);
          const processed = processRealTimeData(adaptedData);
          setMetrics(processed.metrics);
          setPerformanceData(processed.timeSeriesData);
        }
      }
      
      // Fetch shot analytics data
      const { data: shotAnalytics, error: shotError } = await supabase
        .from('shot_analysis')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (shotError) throw shotError;
      
      if (shotAnalytics) {
        setShotData(shotAnalytics.map(shot => ({
          time: new Date(shot.timestamp as unknown as string).toLocaleTimeString(),
          value: shot.is_goal ? 100 : Math.floor(Math.random() * 70) + 10
        })));
      }
      
      setSyncStatus('synced');
      toast({
        title: "Data synchronized",
        description: "Analysis data has been synchronized with the server",
        variant: "default",
      });
    } catch (error) {
      console.error('Error fetching analysis data:', error);
      setSyncStatus('error');
      toast({
        title: "Sync Failed",
        description: "There was an error syncing performance data",
        variant: "destructive",
      });
    }
  };

  const handleRealTimeUpdate = (payload: any) => {
    console.log('Real-time update received:', payload);
    fetchAnalysisData();
  };

  const handleSensorDataUpdate = (payload: any) => {
    console.log('Sensor data update received:', payload);
    if (payload.new && payload.eventType === 'INSERT') {
      // Update metrics incrementally with new sensor data
      setPerformanceData(currentData => {
        const newData = [...currentData];
        if (newData.length > 20) newData.shift(); // Keep last 20 data points
        
        // Convert string values to numbers before using in math operations
        const xValue = Number(payload.new?.x || 0);
        const yValue = Number(payload.new?.y || 0);
        const zValue = Number(payload.new?.z || 0);
        
        newData.push({
          time: new Date().toLocaleTimeString(),
          value: Math.sqrt(
            Math.pow(xValue, 2) + 
            Math.pow(yValue, 2) + 
            Math.pow(zValue, 2)
          )
        });
        return newData;
      });
    }
  };

  const startSession = async (deviceAssignments: { playerId: string, deviceId: number }[]) => {
    try {
      const timestamp = new Date().toISOString();
      
      const promises = deviceAssignments.map(assignment => {
        return supabase.from('sessions').insert({
          player_id: assignment.playerId,
          device_id: assignment.deviceId,
          session_type: 'training',
          start_time: timestamp
        });
      });

      await Promise.all(promises);
      
      setIsSessionActive(true);
      toast({
        title: "Session Started",
        description: "Successfully started tracking session",
      });
      fetchAnalysisData(); // Refresh data after starting session
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: "Error",
        description: "Failed to start session",
        variant: "destructive",
      });
    }
  };

  const endSession = async () => {
    try {
      const timestamp = new Date().toISOString();
      
      const { error } = await supabase
        .from('sessions')
        .update({ end_time: timestamp })
        .is('end_time', null);

      if (error) throw error;
      
      setIsSessionActive(false);
      setActiveSessionId(null);
      toast({
        title: "Session Ended",
        description: "Successfully ended tracking session",
      });
      fetchAnalysisData(); // Refresh data after ending session
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "Failed to end session",
        variant: "destructive",
      });
    }
  };

  const triggerManualSync = () => {
    fetchAnalysisData();
  };
  
  // Generate a shareable link to this analysis page with the current session
  const getShareableLink = () => {
    if (!activeSessionId) return window.location.href;
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/analysis?sessionId=${activeSessionId}`;
  };
  
  // Copy the shareable link to clipboard
  const copyShareableLink = () => {
    const link = getShareableLink();
    navigator.clipboard.writeText(link);
    
    toast({
      title: "Link Copied",
      description: "Shareable link has been copied to clipboard",
    });
  };

  const toggleLiveMode = (value: boolean) => {
    setIsLiveMode(value);
    if (value) {
      // When switching to live mode, clear active session ID to get latest active session
      setActiveSessionId(null);
    }
    // When switching to historical mode, we'll keep the current session ID if there is one
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsLiveMode(false);
  };
  
  const handleBluetoothConnect = () => {
    setBluetoothStatus("searching");
    
    toast({
      title: "Searching for Bluetooth devices",
      description: "Looking for compatible sensors and Bluetooth boosters...",
    });
    
    // Simulate connection process
    setTimeout(() => {
      setBluetoothStatus("connected");
      setIsBluetoothDialogOpen(false);
      
      toast({
        title: "Bluetooth Connected",
        description: "Successfully connected to biometric sensors and Bluetooth range booster",
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen wallpaper-aurora">
      <div className="max-w-7xl mx-auto px-6 py-6 text-white">
        {/* Consolidated header */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-white leading-tight">Ultra Analysis</h1>
            <div className="text-sm text-white/70 mt-1 flex items-center gap-2 flex-wrap">
              <span>{activeTeam?.name || 'No team selected'}</span>
              <span className="opacity-50">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`inline-flex h-2 w-2 rounded-full ${
                  syncStatus === 'synced' ? 'bg-emerald-400'
                    : syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-400'
                }`} />
                {syncStatus === 'synced' ? 'In sync' : syncStatus === 'syncing' ? 'Syncing…' : 'Sync error'}
              </span>
              {activeSessionId && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="text-xs text-white/60">Session {activeSessionId.slice(0, 6)}</span>
                </>
              )}
            </div>
          </div>

          {/* Primary control + overflow */}
          <div className="flex items-center gap-2">
            <Select value={isLiveMode ? "live" : "historical"} onValueChange={(v) => toggleLiveMode(v === "live")}>
              <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Session Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Live Session</SelectItem>
                <SelectItem value="historical">Historical Data</SelectItem>
              </SelectContent>
            </Select>

            {!isLiveMode && (
              <Select value={activeSessionId || ""} onValueChange={handleSessionSelect} disabled={availableSessions.length === 0}>
                <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select Session" />
                </SelectTrigger>
                <SelectContent>
                  {availableSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.date} – {s.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={triggerManualSync} disabled={syncStatus === 'syncing'}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {syncStatus === 'syncing' ? 'Syncing…' : 'Sync now'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsBluetoothDialogOpen(true)}>
                  <Bluetooth className="mr-2 h-4 w-4" /> Bluetooth settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyShareableLink}>
                  <Share2 className="mr-2 h-4 w-4" /> Copy share link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/devices"><Settings className="mr-2 h-4 w-4" /> Manage devices</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ml-training"><ChartBar className="mr-2 h-4 w-4" /> ML Training</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!isSessionActive ? (
                  <DropdownMenuItem onClick={() => { /* DeviceManager handles its own UI; opens below */ }}>
                    Start session…
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={endSession} className="text-rose-600">
                    End session
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Optional team override */}
        {(!activeTeam || showTeamPicker) && (
          <div className="mb-5 flex items-end gap-3 flex-wrap glass rounded-xl p-3 border border-white/10">
            <div className="w-48">
              <label className="text-xs font-medium text-white/60 mb-1 block">Club</label>
              <ClubSelector
                selectedClubId={selectedClubId}
                onClubSelect={(club) => { setSelectedClubId(club?.id); setSelectedTeamId(undefined); }}
              />
            </div>
            <div className="w-48">
              <label className="text-xs font-medium text-white/60 mb-1 block">Team</label>
              <TeamSelector
                selectedTeamId={selectedTeamId}
                clubId={selectedClubId}
                onTeamSelect={(team) => setSelectedTeamId(team?.id)}
              />
            </div>
            {activeTeam && (
              <Button variant="ghost" size="sm" className="text-white/70" onClick={() => setShowTeamPicker(false)}>Done</Button>
            )}
          </div>
        )}
        {activeTeam && !showTeamPicker && (
          <div className="mb-5">
            <button onClick={() => setShowTeamPicker(true)} className="text-xs text-white/60 hover:text-white underline underline-offset-2">
              Change team
            </button>
          </div>
        )}

        {/* Bluetooth dialog (kept, not in header) */}
        <Dialog open={isBluetoothDialogOpen} onOpenChange={setIsBluetoothDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bluetooth Configuration</DialogTitle>
              <DialogDescription>Configure Bluetooth settings for enhanced range and multi-player tracking</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Bluetooth Range Booster</h3>
                  <p className="text-sm text-muted-foreground">Connect a range booster for multi-player tracking</p>
                </div>
                <Badge
                  variant={bluetoothStatus === "connected" ? "default" : "outline"}
                  className={bluetoothStatus === "searching" ? "animate-pulse" : ""}
                >
                  {bluetoothStatus === "connected" ? "Connected" : bluetoothStatus === "searching" ? "Searching…" : "Disconnected"}
                </Badge>
              </div>
            </div>
            <DialogFooter>
              {bluetoothStatus !== "connected" ? (
                <Button onClick={handleBluetoothConnect}>Connect Bluetooth Booster</Button>
              ) : (
                <Button variant="outline" onClick={() => setBluetoothStatus("disconnected")}>Disconnect</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inline DeviceManager trigger */}
        {!isSessionActive && (
          <div className="mb-4">
            <DeviceManager onStartSession={startSession} />
          </div>
        )}

        <SyncStatusIndicator entity="all" showDetails={false} />

        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/5 border border-white/10 text-white/70 h-auto p-1 backdrop-blur-md">
            <TabsTrigger value="overall" className="flex items-center gap-2 data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              <ChartBar className="h-4 w-4" />
              Overall Session
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center gap-2 data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              <User className="h-4 w-4" />
              Individual Players
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-2 data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              <Users className="h-4 w-4" />
              Group Selection
            </TabsTrigger>
            <TabsTrigger value="biometrics" className="flex items-center gap-2 data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              <HeartPulse className="h-4 w-4" />
              Biometrics
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2 data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              <Video className="h-4 w-4" />
              Video Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overall" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Total Steps"
                value={metrics.totalSteps || 0}
                unit="steps"
                icon={<Footprints className="h-4 w-4" />}
              />
              <MetricCard
                title="Ball Touches"
                value={metrics.ballTouches || 0}
                unit="touches"
                icon={<Activity className="h-4 w-4" />}
              />
              <MetricCard
                title="Successful Passes"
                value={metrics.successfulPasses || 0}
                unit="passes"
                icon={<Repeat className="h-4 w-4" />}
                subtitle="92% confidence"
              />
              <MetricCard
                title="Shots on Target"
                value={metrics.shotsOnTarget || 0}
                unit="shots"
                icon={<Target className="h-4 w-4" />}
                subtitle="95% confidence"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <PerformanceChart
                title="Movement Intensity"
                data={performanceData}
                dataKey="value"
                color="#0F766E"
              />
              <PerformanceChart
                title="Shot Power Analysis"
                data={shotData}
                dataKey="value"
                color="#EAB308"
              />
            </div>

            <div className="mt-8 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md p-4">
              <PlayerMovementMap />
            </div>
          </TabsContent>

          <TabsContent value="individual" className="mt-6">
            <IndividualPlayerTab 
              sessionId={activeSessionId}
              isLiveMode={isLiveMode}
              clubId={selectedClubId}
              teamId={selectedTeamId}
            />
          </TabsContent>

          <TabsContent value="group" className="mt-6">
            <GroupSelectionTab 
              sessionId={activeSessionId}
              isLiveMode={isLiveMode}
              clubId={selectedClubId}
              teamId={selectedTeamId}
            />
          </TabsContent>

          <TabsContent value="biometrics" className="mt-6">
            <BiometricsTab />
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            <VideoAnalysisTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analysis;
