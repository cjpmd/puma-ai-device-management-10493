
import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import PlayerSelector from "./PlayerSelector";
import BiometricChart from "./BiometricChart";
import BiometricDetailsCard from "./BiometricDetailsCard";
import PlayerToleranceSettings from "./PlayerToleranceSettings";
import TeamSummary from "./TeamSummary";
import { HeartPulse, Droplet, Thermometer, Wind, Activity, Shield, Clock, Bluetooth } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlayerToleranceSettings as PlayerToleranceSettingsType } from "./PlayerToleranceSettings";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  name: string;
  position?: string;
}

interface BiometricData {
  time: string;
  value: number;
}

interface ToleranceRange {
  min: number;
  max: number;
}

interface ToleranceSettingsMap {
  [playerId: string]: PlayerToleranceSettingsType;
}

const defaultTolerances: PlayerToleranceSettingsType = {
  playerId: "global",
  heartRate: { min: 60, max: 180 },
  hydration: { min: 80, max: 100 },
  lacticAcid: { min: 0, max: 4 },
  vo2Max: { min: 40, max: 60 },
  muscleFatigue: { min: 0, max: 70 }
};

const BiometricsTab = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [timeRange, setTimeRange] = useState<string>("today");
  const [playerMode, setPlayerMode] = useState<"performance" | "recovery">("performance");
  const [sessionType, setSessionType] = useState<"training" | "match">("training");
  const [bluetoothStatus, setBluetoothStatus] = useState<"connected" | "disconnected" | "searching">("disconnected");
  const { toast } = useToast();
  
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  
  // Tolerance settings
  const [globalTolerances, setGlobalTolerances] = useState<PlayerToleranceSettingsType>(defaultTolerances);
  const [playerTolerances, setPlayerTolerances] = useState<ToleranceSettingsMap>({});
  
  // Recovery mode data
  const [injuryDetails, setInjuryDetails] = useState({
    type: "Grade 2 hamstring strain",
    location: "Right leg",
    dateOccurred: "2025-05-10",
    estimatedRecovery: "2-3 weeks",
    currentPhase: "Early Recovery",
    daysElapsed: 4,
    totalDays: 21,
    nextPhase: "Strength Building",
    daysToNextPhase: 3,
    returnToPlayDate: "2025-06-06",
    daysToReturn: 17
  });
  
  // Smart bandage data
  const [smartBandageData, setSmartBandageData] = useState({
    strain: { value: 23.4, change: -12 },
    force: { value: 2.1, change: -0.3 },
    temperature: { value: 37.2, change: -0.4 },
    swelling: { value: 8, change: -3 },
    rangeOfMotion: { value: 72, change: 5 }
  });
  
  // Physiotherapy plan
  const [physioPlan, setPhysioPlan] = useState([
    { step: 1, instruction: "Light stretching exercises 2x daily" },
    { step: 2, instruction: "Ice therapy after exercises" },
    { step: 3, instruction: "Resistance band work starting day 5" },
    { step: 4, instruction: "Gradual weight-bearing from day 7" },
    { step: 5, instruction: "Proprioception exercises from day 10" }
  ]);
  
  useEffect(() => {
    // Fetch actual players from the database
    const fetchPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, name, player_type')
          .order('name');
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          const mappedPlayers = data.map(player => ({
            id: player.id,
            name: player.name,
            position: player.player_type === 'GOALKEEPER' ? 'Goalkeeper' : 'Outfield'
          }));
          setAllPlayers(mappedPlayers);
        } else {
          // Fallback sample data if no players in database
          setAllPlayers([
            { id: "1", name: "Alex Johnson", position: "Forward" },
            { id: "2", name: "Casey Smith", position: "Midfielder" },
            { id: "3", name: "Jamie Wilson", position: "Defender" },
            { id: "4", name: "Taylor Roberts", position: "Goalkeeper" },
          ]);
        }
      } catch (error) {
        console.error('Error fetching players:', error);
        // Fallback to sample data
        setAllPlayers([
          { id: "1", name: "Alex Johnson", position: "Forward" },
          { id: "2", name: "Casey Smith", position: "Midfielder" },
          { id: "3", name: "Jamie Wilson", position: "Defender" },
          { id: "4", name: "Taylor Roberts", position: "Goalkeeper" },
        ]);
      }
    };
    
    fetchPlayers();
    
    // Initialize player tolerances
    const initialPlayerTolerances: ToleranceSettingsMap = {};
    allPlayers.forEach(player => {
      initialPlayerTolerances[player.id] = {
        ...defaultTolerances,
        playerId: player.id,
        playerName: player.name
      };
    });
    
    setPlayerTolerances(initialPlayerTolerances);
    
    // Simulate Bluetooth connection status (demo only)
    const interval = setInterval(() => {
      if (bluetoothStatus === "disconnected") {
        setBluetoothStatus("searching");
        setTimeout(() => setBluetoothStatus("connected"), 2000);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Update tolerances when players change
  useEffect(() => {
    const initialPlayerTolerances: ToleranceSettingsMap = {};
    allPlayers.forEach(player => {
      initialPlayerTolerances[player.id] = {
        ...defaultTolerances,
        playerId: player.id,
        playerName: player.name
      };
    });
    
    // Try to load saved settings from local storage
    const savedSettings = localStorage.getItem('playerToleranceSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        // Merge saved settings with defaults for any new players
        const mergedSettings = { ...initialPlayerTolerances, ...parsedSettings };
        setPlayerTolerances(mergedSettings);
      } catch (e) {
        console.error('Error parsing saved tolerance settings', e);
        setPlayerTolerances(initialPlayerTolerances);
      }
    } else {
      setPlayerTolerances(initialPlayerTolerances);
    }
  }, [allPlayers]);
  
  // Stable seeded random per player to avoid re-randomizing on every render
  const stableRandomRef = React.useRef<Map<string, number[]>>(new Map());
  
  const getStableRandoms = (playerId: string): number[] => {
    if (!stableRandomRef.current.has(playerId)) {
      stableRandomRef.current.set(playerId, [
        Math.random(), Math.random(), Math.random(), Math.random(), Math.random()
      ]);
    }
    return stableRandomRef.current.get(playerId)!;
  };

  // Current biometric values - in a real app, these would come from device readings
  const playerBiometrics = allPlayers.map(player => {
    const randoms = getStableRandoms(player.id);
    // Generate slightly different values for each player
    const baseHR = playerMode === "performance" ? 132 : 76;
    const baseHydration = playerMode === "performance" ? 82 : 96;
    const baseLactic = playerMode === "performance" ? 5.2 : 1.3;
    const baseVO2 = playerMode === "performance" ? 52 : 48;
    const baseFatigue = playerMode === "performance" ? 65 : 15;
    
    // Use stable random values per player
    const heartRate = Math.round(baseHR + (randoms[0] * 20 - 10));
    const hydration = Math.round(baseHydration + (randoms[1] * 10 - 5));
    const lacticAcid = +(baseLactic + (randoms[2] * 1 - 0.5)).toFixed(1);
    const vo2Max = Math.round(baseVO2 + (randoms[3] * 6 - 3));
    const muscleFatigue = Math.round(baseFatigue + (randoms[4] * 10 - 5));
    
    // Determine status based on values and tolerance
    const playerTolerance = playerTolerances[player.id] || globalTolerances;
    
    let status: "good" | "warning" | "critical" = "good";
    if (
      heartRate > playerTolerance.heartRate.max + 20 || 
      heartRate < playerTolerance.heartRate.min - 10 ||
      hydration < playerTolerance.hydration.min - 10 ||
      lacticAcid > playerTolerance.lacticAcid.max + 2
    ) {
      status = "critical";
    } else if (
      heartRate > playerTolerance.heartRate.max || 
      heartRate < playerTolerance.heartRate.min ||
      hydration < playerTolerance.hydration.min ||
      lacticAcid > playerTolerance.lacticAcid.max
    ) {
      status = "warning";
    }
    
    return {
      playerId: player.id,
      playerName: player.name,
      heartRate,
      hydration,
      lacticAcid,
      vo2Max,
      muscleFatigue,
      status
    };
  });
  
  // Get current player's data
  const currentPlayerData = selectedPlayer 
    ? playerBiometrics.find(p => p.playerId === selectedPlayer.id) 
    : playerBiometrics[0];
  
  // Current biometric values
  const currentValues = currentPlayerData ? {
    heartRate: currentPlayerData.heartRate,
    hydration: currentPlayerData.hydration,
    lacticAcid: currentPlayerData.lacticAcid,
    vo2Max: currentPlayerData.vo2Max,
    muscleFatigue: currentPlayerData.muscleFatigue,
  } : {
    heartRate: playerMode === "performance" ? 132 : 76,
    hydration: playerMode === "performance" ? 82 : 96,
    lacticAcid: playerMode === "performance" ? 5.2 : 1.3,
    vo2Max: playerMode === "performance" ? 52 : 48,
    muscleFatigue: playerMode === "performance" ? 65 : 15,
  };
  
  // Sample biometric data for demonstration
  const heartRateData: BiometricData[] = [
    { time: "09:00", value: 72 },
    { time: "09:15", value: 110 },
    { time: "09:30", value: 145 },
    { time: "09:45", value: 165 },
    { time: "10:00", value: 155 },
    { time: "10:15", value: 140 },
    { time: "10:30", value: 120 },
    { time: "10:45", value: 110 },
    { time: "11:00", value: 85 },
  ];
  
  const hydrationData: BiometricData[] = [
    { time: "09:00", value: 98 },
    { time: "09:15", value: 97 },
    { time: "09:30", value: 95 },
    { time: "09:45", value: 92 },
    { time: "10:00", value: 89 },
    { time: "10:15", value: 86 },
    { time: "10:30", value: 84 },
    { time: "10:45", value: 82 },
    { time: "11:00", value: 80 },
  ];
  
  const lacticAcidData: BiometricData[] = [
    { time: "09:00", value: 1.2 },
    { time: "09:15", value: 1.5 },
    { time: "09:30", value: 2.8 },
    { time: "09:45", value: 4.2 },
    { time: "10:00", value: 5.5 },
    { time: "10:15", value: 6.2 },
    { time: "10:30", value: 5.1 },
    { time: "10:45", value: 3.8 },
    { time: "11:00", value: 2.3 },
  ];
  
  const vo2MaxData: BiometricData[] = [
    { time: "09:00", value: 48 },
    { time: "09:15", value: 50 },
    { time: "09:30", value: 52 },
    { time: "09:45", value: 53 },
    { time: "10:00", value: 54 },
    { time: "10:15", value: 54 },
    { time: "10:30", value: 53 },
    { time: "10:45", value: 52 },
    { time: "11:00", value: 50 },
  ];
  
  const muscleFatigueData: BiometricData[] = [
    { time: "09:00", value: 12 },
    { time: "09:15", value: 18 },
    { time: "09:30", value: 25 },
    { time: "09:45", value: 38 },
    { time: "10:00", value: 52 },
    { time: "10:15", value: 65 },
    { time: "10:30", value: 72 },
    { time: "10:45", value: 78 },
    { time: "11:00", value: 80 },
  ];

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
  };

  const handleModeChange = (checked: boolean) => {
    setPlayerMode(checked ? "recovery" : "performance");
  };

  const handleToleranceChange = (newPlayerTolerances: ToleranceSettingsMap, newGlobalTolerances: PlayerToleranceSettingsType) => {
    setPlayerTolerances(newPlayerTolerances);
    setGlobalTolerances(newGlobalTolerances);
    
    toast({
      title: "Tolerance Settings Updated",
      description: "New biometric tolerance ranges have been applied for all players",
    });
  };
  
  const handleBluetoothConnect = () => {
    setBluetoothStatus("searching");
    
    toast({
      title: "Searching for Bluetooth devices",
      description: "Looking for compatible biometric sensors and Bluetooth boosters...",
    });
    
    // Simulate connection process
    setTimeout(() => {
      setBluetoothStatus("connected");
      
      toast({
        title: "Bluetooth Connected",
        description: "Successfully connected to biometric sensors and Bluetooth booster",
      });
    }, 2000);
  };

  const getStatusFromValue = (value: number, toleranceRange: ToleranceRange): "good" | "normal" | "warning" | "critical" => {
    if (value < toleranceRange.min) {
      // Below minimum
      const distance = toleranceRange.min - value;
      const percentBelowMin = distance / toleranceRange.min;
      
      return percentBelowMin > 0.1 ? "critical" : "warning";
    } else if (value > toleranceRange.max) {
      // Above maximum
      const distance = value - toleranceRange.max;
      const percentAboveMax = distance / toleranceRange.max;
      
      return percentAboveMax > 0.1 ? "critical" : "warning";
    } else {
      // Within range
      const range = toleranceRange.max - toleranceRange.min;
      const distanceFromMin = value - toleranceRange.min;
      const percentInRange = distanceFromMin / range;
      
      return percentInRange > 0.25 && percentInRange < 0.75 ? "good" : "normal";
    }
  };
  
  // Get player-specific tolerance or fall back to global
  const getPlayerTolerance = () => {
    if (!selectedPlayer) return globalTolerances;
    return playerTolerances[selectedPlayer.id] || globalTolerances;
  };
  
  const currentTolerance = getPlayerTolerance();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="w-full sm:w-1/3">
          <PlayerSelector onPlayerSelect={handlePlayerSelect} selectedPlayerId={selectedPlayer?.id} />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center space-x-2">
            <Select value={sessionType} onValueChange={(value: "training" | "match") => setSessionType(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Session Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">Training Session</SelectItem>
                <SelectItem value="match">Match Play</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="mode-switch" className={playerMode === "performance" ? "text-primary" : "text-muted-foreground"}>
              Performance Mode
            </Label>
            <Switch 
              id="mode-switch" 
              checked={playerMode === "recovery"} 
              onCheckedChange={handleModeChange} 
            />
            <Label htmlFor="mode-switch" className={playerMode === "recovery" ? "text-destructive" : "text-muted-foreground"}>
              Recovery Mode
            </Label>
          </div>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="season">Full Season</SelectItem>
            </SelectContent>
          </Select>
          
          <PlayerToleranceSettings 
            globalSettings={globalTolerances}
            players={allPlayers}
            onSave={handleToleranceChange}
          />
        </div>
      </div>
      
      {/* Bluetooth Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1 rounded-full",
            bluetoothStatus === "connected" ? "bg-green-100" : 
            bluetoothStatus === "searching" ? "bg-amber-100" : "bg-slate-100"
          )}>
            <Bluetooth className={cn(
              "h-4 w-4",
              bluetoothStatus === "connected" ? "text-green-600" : 
              bluetoothStatus === "searching" ? "text-amber-600" : "text-slate-600"
            )} />
          </div>
          <span className="text-sm font-medium">
            {bluetoothStatus === "connected" ? "Bluetooth Connected (with Range Booster)" : 
             bluetoothStatus === "searching" ? "Searching for devices..." : "Bluetooth Disconnected"}
          </span>
        </div>
        
        {bluetoothStatus !== "connected" && (
          <button 
            className="text-sm text-primary hover:underline"
            onClick={handleBluetoothConnect}
          >
            Connect Bluetooth Devices
          </button>
        )}
      </div>
      
      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team Summary</TabsTrigger>
          <TabsTrigger value="individual">Individual Player</TabsTrigger>
        </TabsList>
        
        <TabsContent value="team" className="space-y-6 mt-4">
          <TeamSummary 
            players={playerBiometrics} 
            sessionType={sessionType} 
          />
          
          {bluetoothStatus === "disconnected" && (
            <Alert>
              <Bluetooth className="h-4 w-4" />
              <AlertTitle>Bluetooth Range Booster Required</AlertTitle>
              <AlertDescription>
                To receive live biometric data from multiple players simultaneously, 
                connect a Bluetooth repeater or booster device. This will extend the range 
                and number of devices that can be monitored in real-time.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="individual">
          {selectedPlayer ? (
            <>
              <div className="bg-white shadow rounded-lg p-4 mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedPlayer.name}'s Biometric Data</h2>
                  <div className="flex gap-2 items-center mt-1">
                    {playerMode === "recovery" && (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                        Recovery Mode Active
                      </span>
                    )}
                    {playerMode === "performance" && (
                      <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
                        Performance Tracking Active
                      </span>
                    )}
                    <span className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium",
                      sessionType === "match" 
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    )}>
                      {sessionType === "match" ? "Match" : "Training"}
                    </span>
                  </div>
                </div>
                
                {/* Visual player tolerance status indicator */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Tolerance Status:</span>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      getStatusFromValue(currentValues.heartRate, currentTolerance.heartRate) === "critical" || 
                      getStatusFromValue(currentValues.hydration, currentTolerance.hydration) === "critical" || 
                      getStatusFromValue(currentValues.lacticAcid, currentTolerance.lacticAcid) === "critical"
                        ? "bg-red-500" 
                        : getStatusFromValue(currentValues.heartRate, currentTolerance.heartRate) === "warning" || 
                          getStatusFromValue(currentValues.hydration, currentTolerance.hydration) === "warning" || 
                          getStatusFromValue(currentValues.lacticAcid, currentTolerance.lacticAcid) === "warning"
                          ? "bg-amber-500" 
                          : "bg-green-500"
                    )}></div>
                    <span className="text-sm font-medium">
                      {getStatusFromValue(currentValues.heartRate, currentTolerance.heartRate) === "critical" || 
                       getStatusFromValue(currentValues.hydration, currentTolerance.hydration) === "critical" || 
                       getStatusFromValue(currentValues.lacticAcid, currentTolerance.lacticAcid) === "critical"
                        ? "Critical" 
                        : getStatusFromValue(currentValues.heartRate, currentTolerance.heartRate) === "warning" || 
                          getStatusFromValue(currentValues.hydration, currentTolerance.hydration) === "warning" || 
                          getStatusFromValue(currentValues.lacticAcid, currentTolerance.lacticAcid) === "warning"
                          ? "Warning" 
                          : "Good"
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <BiometricDetailsCard 
                  title="Heart Rate"
                  value={`${currentValues.heartRate} bpm`}
                  icon={<HeartPulse className="h-5 w-5" />}
                  change={playerMode === "performance" ? "+12%" : "-8%"}
                  status={getStatusFromValue(currentValues.heartRate, currentTolerance.heartRate)}
                  toleranceMin={currentTolerance.heartRate.min}
                  toleranceMax={currentTolerance.heartRate.max}
                  numericValue={currentValues.heartRate}
                  playerId={selectedPlayer.id}
                />
                <BiometricDetailsCard 
                  title="Hydration"
                  value={`${currentValues.hydration}%`}
                  icon={<Droplet className="h-5 w-5" />}
                  change={playerMode === "performance" ? "-15%" : "+4%"}
                  status={getStatusFromValue(currentValues.hydration, currentTolerance.hydration)}
                  toleranceMin={currentTolerance.hydration.min}
                  toleranceMax={currentTolerance.hydration.max}
                  numericValue={currentValues.hydration}
                  playerId={selectedPlayer.id}
                />
                <BiometricDetailsCard 
                  title="Lactic Acid"
                  value={`${currentValues.lacticAcid} mmol/L`}
                  icon={<Thermometer className="h-5 w-5" />}
                  change={playerMode === "performance" ? "+120%" : "-40%"}
                  status={getStatusFromValue(currentValues.lacticAcid, currentTolerance.lacticAcid)}
                  toleranceMin={currentTolerance.lacticAcid.min}
                  toleranceMax={currentTolerance.lacticAcid.max}
                  numericValue={currentValues.lacticAcid}
                  playerId={selectedPlayer.id}
                />
                <BiometricDetailsCard 
                  title="VO2 Max"
                  value={`${currentValues.vo2Max} ml/kg/min`}
                  icon={<Wind className="h-5 w-5" />}
                  change={playerMode === "performance" ? "+4%" : "-2%"}
                  status={getStatusFromValue(currentValues.vo2Max, currentTolerance.vo2Max)}
                  toleranceMin={currentTolerance.vo2Max.min}
                  toleranceMax={currentTolerance.vo2Max.max}
                  numericValue={currentValues.vo2Max}
                  playerId={selectedPlayer.id}
                />
              </div>

              <Tabs defaultValue="charts" className="w-full">
                <TabsList>
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  <TabsTrigger value="combined">Combined Analysis</TabsTrigger>
                  {playerMode === "recovery" && <TabsTrigger value="recovery">Recovery Plan</TabsTrigger>}
                  {playerMode === "recovery" && <TabsTrigger value="smart-bandage">Smart Bandage Data</TabsTrigger>}
                  {playerMode === "recovery" && <TabsTrigger value="medical">Medical Assessment</TabsTrigger>}
                </TabsList>
                <TabsContent value="charts" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                    <BiometricChart 
                      title="Heart Rate" 
                      data={heartRateData} 
                      color="#ef4444" 
                      unit="bpm"
                      threshold={currentTolerance.heartRate.max}
                    />
                    <BiometricChart 
                      title="Hydration Level" 
                      data={hydrationData} 
                      color="#0ea5e9" 
                      unit="%"
                      threshold={currentTolerance.hydration.min}
                      thresholdDirection="below"
                    />
                    <BiometricChart 
                      title="Lactic Acid" 
                      data={lacticAcidData} 
                      color="#8b5cf6" 
                      unit="mmol/L"
                      threshold={currentTolerance.lacticAcid.max}
                    />
                    <BiometricChart 
                      title="VO2 Max" 
                      data={vo2MaxData} 
                      color="#10b981" 
                      unit="ml/kg/min"
                    />
                    <BiometricChart 
                      title="Muscle Fatigue" 
                      data={muscleFatigueData} 
                      color="#f59e0b" 
                      unit="%"
                      threshold={currentTolerance.muscleFatigue.max}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="combined">
                  <div className="mt-4 grid grid-cols-1 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Combined Biometric & Positional Data</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[400px] relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-muted-foreground">Interactive biometric and positional data visualization would appear here.</p>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 bg-white/95 p-4 rounded-lg border">
                          <h3 className="font-semibold mb-2">Insights</h3>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start">
                              <Activity className="h-4 w-4 mr-2 mt-0.5 text-primary" />
                              <span>Heart rate peaked at 165 bpm during high-intensity sprints in the final third.</span>
                            </li>
                            <li className="flex items-start">
                              <Shield className="h-4 w-4 mr-2 mt-0.5 text-amber-500" />
                              <span>Hydration levels dropped below optimal threshold after 30 minutes of play.</span>
                            </li>
                            <li className="flex items-start">
                              <Clock className="h-4 w-4 mr-2 mt-0.5 text-blue-500" />
                              <span>Recovery periods insufficient during central midfield positioning - consider rotation.</span>
                            </li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                {playerMode === "recovery" && (
                  <TabsContent value="recovery">
                    <div className="mt-4 space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Recovery Plan</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="p-4 border rounded-md bg-slate-50">
                              <h3 className="font-medium mb-2">Injury Overview</h3>
                              <p className="text-sm text-muted-foreground">{injuryDetails.type}, {injuryDetails.location}, onset date: {injuryDetails.dateOccurred}</p>
                              <p className="text-sm text-muted-foreground mt-1">Estimated recovery time: {injuryDetails.estimatedRecovery}</p>
                            </div>
                            
                            <div className="p-4 border rounded-md">
                              <h3 className="font-medium mb-2">Physiotherapy Instructions</h3>
                              <ul className="space-y-2 text-sm">
                                {physioPlan.map((instruction, index) => (
                                  <li key={index} className="flex items-start">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-600 mr-2">{instruction.step}</span>
                                    <span>{instruction.instruction}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Card>
                                <CardHeader className="p-4">
                                  <CardTitle className="text-sm">Current Phase</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 pb-4 px-4">
                                  <p className="text-xl font-bold">{injuryDetails.currentPhase}</p>
                                  <p className="text-xs text-muted-foreground">Day {injuryDetails.daysElapsed} of {injuryDetails.totalDays}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="p-4">
                                  <CardTitle className="text-sm">Next Phase</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 pb-4 px-4">
                                  <p className="text-xl font-bold">{injuryDetails.nextPhase}</p>
                                  <p className="text-xs text-muted-foreground">Starts in {injuryDetails.daysToNextPhase} days</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="p-4">
                                  <CardTitle className="text-sm">Return to Play</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 pb-4 px-4">
                                  <p className="text-xl font-bold">{injuryDetails.daysToReturn} days</p>
                                  <p className="text-xs text-muted-foreground">Target date: {injuryDetails.returnToPlayDate}</p>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                )}
                
                {playerMode === "recovery" && (
                  <TabsContent value="medical">
                    <div className="mt-4 space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Medical Assessment</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            <div className="p-4 border rounded-md bg-slate-50">
                              <h3 className="font-medium mb-2">Diagnosis</h3>
                              <p className="text-sm">{injuryDetails.type} in the {injuryDetails.location}, with mild inflammation and restricted range of motion.</p>
                              <div className="mt-3 flex gap-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  Grade 2 Strain
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Moderate Severity
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Good Prognosis
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h3 className="font-medium text-sm text-muted-foreground mb-2">TREATMENT RECOMMENDATIONS</h3>
                                <div className="space-y-3">
                                  <div className="p-3 border rounded bg-white">
                                    <h4 className="font-medium text-sm">Immediate Phase (Days 1-5)</h4>
                                    <ul className="mt-2 space-y-1 text-sm">
                                      <li>• RICE protocol (Rest, Ice, Compression, Elevation)</li>
                                      <li>• Anti-inflammatory medication as prescribed</li>
                                      <li>• Limited weight bearing with crutch assistance</li>
                                      <li>• Gentle range of motion exercises</li>
                                    </ul>
                                  </div>
                                  
                                  <div className="p-3 border rounded bg-white">
                                    <h4 className="font-medium text-sm">Intermediate Phase (Days 6-14)</h4>
                                    <ul className="mt-2 space-y-1 text-sm">
                                      <li>• Progressive resistance exercises</li>
                                      <li>• Stationary bike (low resistance)</li>
                                      <li>• Pool therapy for reduced weight bearing</li>
                                      <li>• Proprioception training</li>
                                    </ul>
                                  </div>
                                  
                                  <div className="p-3 border rounded bg-white">
                                    <h4 className="font-medium text-sm">Advanced Phase (Days 15+)</h4>
                                    <ul className="mt-2 space-y-1 text-sm">
                                      <li>• Sport-specific drills (non-contact)</li>
                                      <li>• Agility and acceleration training</li>
                                      <li>• Controlled scrimmage participation</li>
                                      <li>• Return-to-play testing</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h3 className="font-medium text-sm text-muted-foreground mb-2">RECOVERY MONITORING</h3>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">Pain Level</span>
                                      <span className="text-sm text-muted-foreground">3/10</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="bg-amber-500 h-full rounded-full" style={{ width: '30%' }}></div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">Range of Motion</span>
                                      <span className="text-sm text-muted-foreground">65%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="bg-blue-500 h-full rounded-full" style={{ width: '65%' }}></div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">Strength (vs. Uninjured Side)</span>
                                      <span className="text-sm text-muted-foreground">45%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="bg-red-500 h-full rounded-full" style={{ width: '45%' }}></div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">Function</span>
                                      <span className="text-sm text-muted-foreground">50%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="bg-orange-500 h-full rounded-full" style={{ width: '50%' }}></div>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-6 p-3 border rounded bg-blue-50 border-blue-200">
                                    <h4 className="font-medium text-sm text-blue-800">Medical Notes</h4>
                                    <p className="mt-1 text-sm text-blue-700">
                                      Patient showing good response to initial treatment. MRI confirms Grade 2 hamstring strain without tendon avulsion. 
                                      Continued adherence to rehab protocol recommended. Weekly reassessment scheduled.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                )}
                
                {playerMode === "recovery" && (
                  <TabsContent value="smart-bandage">
                    <div className="mt-4 space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Smart Bandage Data - Hamstring Recovery</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                              <CardHeader className="p-4">
                                <CardTitle className="text-sm">Muscle Tension Readings</CardTitle>
                              </CardHeader>
                              <CardContent className="h-[200px] relative">
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <p className="text-muted-foreground">Muscle tension visualization would appear here</p>
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="p-4">
                                <CardTitle className="text-sm">Inflammation Indicators</CardTitle>
                              </CardHeader>
                              <CardContent className="h-[200px] relative">
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <p className="text-muted-foreground">Inflammation data visualization would appear here</p>
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="md:col-span-2">
                              <CardHeader className="p-4">
                                <CardTitle className="text-sm">Smart Bandage Sensor Readouts</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                                    <h4 className="text-xs text-muted-foreground mb-1">Strain</h4>
                                    <p className="text-xl font-bold">{smartBandageData.strain.value}%</p>
                                    <p className="text-xs text-green-600">{smartBandageData.strain.change}% from yesterday</p>
                                  </div>
                                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                                    <h4 className="text-xs text-muted-foreground mb-1">Force</h4>
                                    <p className="text-xl font-bold">{smartBandageData.force.value} N</p>
                                    <p className="text-xs text-green-600">{smartBandageData.force.change} N from yesterday</p>
                                  </div>
                                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                                    <h4 className="text-xs text-muted-foreground mb-1">Temperature</h4>
                                    <p className="text-xl font-bold">{smartBandageData.temperature.value}°C</p>
                                    <p className="text-xs text-green-600">{smartBandageData.temperature.change}°C from yesterday</p>
                                  </div>
                                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                                    <h4 className="text-xs text-muted-foreground mb-1">Swelling</h4>
                                    <p className="text-xl font-bold">{smartBandageData.swelling.value}%</p>
                                    <p className="text-xs text-green-600">{smartBandageData.swelling.change}% from yesterday</p>
                                  </div>
                                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                                    <h4 className="text-xs text-muted-foreground mb-1">Range of Motion</h4>
                                    <p className="text-xl font-bold">{smartBandageData.rangeOfMotion.value}°</p>
                                    <p className="text-xs text-green-600">+{smartBandageData.rangeOfMotion.change}° from yesterday</p>
                                  </div>
                                </div>
                                <div className="mt-6 p-4 border rounded-md">
                                  <h3 className="text-sm font-medium mb-2">Smart Bandage Configuration</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Sampling Rate:</span>
                                      <span className="font-medium">Every 5 minutes</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Last Calibrated:</span>
                                      <span className="font-medium">Today, 08:15 AM</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Battery Level:</span>
                                      <span className="font-medium">87%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Alert Threshold:</span>
                                      <span className="font-medium">Enabled</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Medication Delivery:</span>
                                      <span className="font-medium">Disabled</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Sensor Type:</span>
                                      <span className="font-medium">Advanced Recovery+</span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-gray-50">
              <HeartPulse className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-1">Select a player to view biometric data</h3>
              <p className="text-muted-foreground">Player biometric information will be displayed here</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Helper function for conditional class names
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

export default BiometricsTab;
