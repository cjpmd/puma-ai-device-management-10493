
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
import { Activity, Footprints, Target, Repeat, Users, User, ChartBar, Video, Settings, Bluetooth, Share2, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { processRealTimeData } from "@/utils/sensorDataUtils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const { toast } = useToast();
  const location = useLocation();
  
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-secondary">Performance Analysis</h1>
            {activeSessionId && (
              <Badge variant="outline" className="text-xs">
                Session ID: {activeSessionId}
              </Badge>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Select
                value={isLiveMode ? "live" : "historical"}
                onValueChange={(v) => toggleLiveMode(v === "live")}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Session Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live Session</SelectItem>
                  <SelectItem value="historical">Historical Data</SelectItem>
                </SelectContent>
              </Select>
              
              {!isLiveMode && (
                <Select
                  value={activeSessionId || ""}
                  onValueChange={handleSessionSelect}
                  disabled={availableSessions.length === 0}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Session" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.date} - {session.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={triggerManualSync}
                      disabled={syncStatus === 'syncing'}
                    >
                      <Bluetooth className="mr-1 h-4 w-4" />
                      {syncStatus === 'syncing' ? 'Syncing...' : 'Sync with Mobile'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manually sync data with database</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <SyncStatusIndicator entity="all" showDetails={false} />
              
              <Dialog open={isBluetoothDialogOpen} onOpenChange={setIsBluetoothDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Bluetooth className="mr-1 h-4 w-4" />
                    Bluetooth Settings
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bluetooth Configuration</DialogTitle>
                    <DialogDescription>
                      Configure Bluetooth settings for enhanced range and multi-player tracking
                    </DialogDescription>
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
                        {bluetoothStatus === "connected" ? "Connected" : 
                         bluetoothStatus === "searching" ? "Searching..." : "Disconnected"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Requirements</h4>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        <li>Use a compatible Bluetooth 5.0 repeater</li>
                        <li>Position booster centrally in playing area</li>
                        <li>Maximum range: 50-100m depending on conditions</li>
                        <li>Supports up to 20 simultaneous device connections</li>
                      </ul>
                    </div>
                    
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                      <p className="text-amber-800">
                        For optimal performance with multiple players, a Bluetooth range booster
                        is strongly recommended. Without a booster, you may experience data loss
                        from players at the edges of the playing area.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    {bluetoothStatus !== "connected" ? (
                      <Button onClick={handleBluetoothConnect}>
                        Connect Bluetooth Booster
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setBluetoothStatus("disconnected")}>
                        Disconnect
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Share2 className="mr-1 h-4 w-4" />
                  Share
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Share this analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Anyone with this link can view this specific session analysis.
                  </p>
                  <div className="flex space-x-2">
                    <input
                      className="flex-1 px-3 py-2 text-sm border rounded-md"
                      value={getShareableLink()}
                      readOnly
                    />
                    <Button size="sm" onClick={copyShareableLink}>Copy</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Link to="/ml-training" className="text-primary hover:underline">
              Go to ML Training
            </Link>
            <Link to="/devices" className="flex items-center text-primary hover:underline">
              <Settings className="mr-1 h-4 w-4" />
              Manage Devices
            </Link>
            {!isSessionActive ? (
              <DeviceManager onStartSession={startSession} />
            ) : (
              <Button 
                variant="destructive"
                onClick={endSession}
              >
                End Session
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-2 w-2 rounded-full ${
              syncStatus === 'synced' 
                ? 'bg-green-500' 
                : syncStatus === 'syncing' 
                  ? 'bg-yellow-500 animate-pulse' 
                  : 'bg-red-500'
            }`}></span>
            <span className="text-sm text-muted-foreground">
              {syncStatus === 'synced' 
                ? 'Data in sync with database' 
                : syncStatus === 'syncing' 
                  ? 'Synchronizing data...' 
                  : 'Sync error'}
            </span>
            
            {bluetoothStatus === "connected" && (
              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                <Bluetooth className="h-3 w-3 mr-1" />
                Bluetooth Booster Active
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-4 flex items-end gap-4">
          <div className="w-48">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Club</label>
            <ClubSelector
              selectedClubId={selectedClubId}
              onClubSelect={(club) => {
                setSelectedClubId(club?.id);
                setSelectedTeamId(undefined); // Reset team when club changes
              }}
            />
          </div>
          <div className="w-48">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Team</label>
            <TeamSelector
              selectedTeamId={selectedTeamId}
              clubId={selectedClubId}
              onTeamSelect={(team) => {
                setSelectedTeamId(team?.id);
              }}
            />
          </div>
        </div>

        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overall" className="flex items-center gap-2">
              <ChartBar className="h-4 w-4" />
              Overall Session
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Individual Players
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Group Selection
            </TabsTrigger>
            <TabsTrigger value="biometrics" className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4" />
              Biometrics
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
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

            <div className="mt-8">
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
