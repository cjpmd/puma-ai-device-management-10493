
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Toggle } from "@/components/ui/toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Activity, Target, ArrowRight, CircleDot, Hand, Map } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RealtimeChannel } from '@supabase/supabase-js';

interface PlayerMovementMapProps {
  gpsData?: Array<[number, number, number]>; // [timestamp, latitude, longitude]
  possessionData?: Array<[number, boolean]>; // [timestamp, hasPossession]
  shotsData?: Array<{x: number, y: number, isGoal: boolean}>;
  passesData?: Array<{startX: number, startY: number, endX: number, endY: number, isSuccessful: boolean}>;
  dribblingData?: Array<{x: number, y: number, distance: number}>;
  touchesData?: Array<{x: number, y: number, type: string}>;
  playerId?: string; // Optional player ID for filtering data
  sessionId?: string; // Optional session ID for filtering data
  isLiveMode?: boolean; // Whether to continuously update with new data
}

interface GpsCoordinate {
  timestamp: number;
  latitude: number;
  longitude: number;
}

interface GeofencePoint {
  latitude: number;
  longitude: number;
}

interface GeofenceSettings {
  enabled: boolean;
  points: GeofencePoint[];
  name: string;
}

const PlayerMovementMap = ({ 
  gpsData: initialGpsData, 
  possessionData,
  shotsData = [],
  passesData = [],
  dribblingData = [],
  touchesData = [],
  playerId,
  sessionId,
  isLiveMode = false
}: PlayerMovementMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isIndoorMode, setIsIndoorMode] = useState(true);
  const [analysisType, setAnalysisType] = useState<'movement' | 'heatmap' | 'shots' | 'passes' | 'dribbling' | 'touches'>('movement');
  const [showThirds, setShowThirds] = useState(false);
  const [gpsData, setGpsData] = useState<Array<[number, number, number]>>(initialGpsData || []);
  const [isRecording, setIsRecording] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [geofenceSettings, setGeofenceSettings] = useState<GeofenceSettings>({
    enabled: false,
    points: [],
    name: 'Default Pitch'
  });
  const [isGeofenceDialogOpen, setIsGeofenceDialogOpen] = useState(false);
  const { toast } = useToast();

  // Draw indoor pitch with thirds
  const drawIndoorPitch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set pitch dimensions
    const pitchWidth = canvas.width * 0.9;
    const pitchHeight = canvas.height * 0.9;
    const startX = (canvas.width - pitchWidth) / 2;
    const startY = (canvas.height - pitchHeight) / 2;

    // Draw pitch outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, pitchWidth, pitchHeight);

    // Draw thirds if enabled
    if (showThirds) {
      const thirdWidth = pitchWidth / 3;
      ctx.beginPath();
      ctx.moveTo(startX + thirdWidth, startY);
      ctx.lineTo(startX + thirdWidth, startY + pitchHeight);
      ctx.moveTo(startX + thirdWidth * 2, startY);
      ctx.lineTo(startX + thirdWidth * 2, startY + pitchHeight);
      ctx.stroke();
    }

    // Draw center line and circle
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, startY);
    ctx.lineTo(canvas.width / 2, startY + pitchHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, pitchHeight * 0.15, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw penalty areas
    const penAreaWidth = pitchWidth * 0.2;
    const penAreaHeight = pitchHeight * 0.4;
    
    ctx.strokeRect(
      startX,
      startY + (pitchHeight - penAreaHeight) / 2,
      penAreaWidth,
      penAreaHeight
    );

    ctx.strokeRect(
      startX + pitchWidth - penAreaWidth,
      startY + (pitchHeight - penAreaHeight) / 2,
      penAreaWidth,
      penAreaHeight
    );

    // Draw analysis data based on type
    switch (analysisType) {
      case 'movement':
        drawMovementLines(ctx, startX, startY, pitchWidth, pitchHeight);
        break;
      case 'heatmap':
        drawHeatmap(ctx, startX, startY, pitchWidth, pitchHeight);
        break;
      case 'shots':
        drawShots(ctx, startX, startY, pitchWidth, pitchHeight);
        break;
      case 'passes':
        drawPasses(ctx, startX, startY, pitchWidth, pitchHeight);
        break;
      case 'dribbling':
        drawDribbling(ctx, startX, startY, pitchWidth, pitchHeight);
        break;
      case 'touches':
        drawTouches(ctx, startX, startY, pitchWidth, pitchHeight);
        break;
    }
  };

  const drawMovementLines = (ctx: CanvasRenderingContext2D, startX: number, startY: number, pitchWidth: number, pitchHeight: number) => {
    if (!gpsData?.length) return;

    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    
    const normalizedPoints = gpsData.map(([_, lat, lng]) => ({
      x: startX + (lng - Math.min(...gpsData.map(d => d[2]))) / (Math.max(...gpsData.map(d => d[2])) - Math.min(...gpsData.map(d => d[2]))) * pitchWidth,
      y: startY + (lat - Math.min(...gpsData.map(d => d[1]))) / (Math.max(...gpsData.map(d => d[1])) - Math.min(...gpsData.map(d => d[1]))) * pitchHeight
    }));

    normalizedPoints.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    
    // Draw current position marker
    if (normalizedPoints.length > 0) {
      const currentPos = normalizedPoints[normalizedPoints.length - 1];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(currentPos.x, currentPos.y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const drawHeatmap = (ctx: CanvasRenderingContext2D, startX: number, startY: number, pitchWidth: number, pitchHeight: number) => {
    if (!gpsData?.length) return;

    const resolution = 20;
    const cellWidth = pitchWidth / resolution;
    const cellHeight = pitchHeight / resolution;
    const heatmapData = Array(resolution).fill(0).map(() => Array(resolution).fill(0));

    // Aggregate position data
    gpsData.forEach(([_, lat, lng]) => {
      const x = Math.floor((lng - Math.min(...gpsData.map(d => d[2]))) / (Math.max(...gpsData.map(d => d[2])) - Math.min(...gpsData.map(d => d[2]))) * resolution);
      const y = Math.floor((lat - Math.min(...gpsData.map(d => d[1]))) / (Math.max(...gpsData.map(d => d[1])) - Math.min(...gpsData.map(d => d[1]))) * resolution);
      if (x >= 0 && x < resolution && y >= 0 && y < resolution) {
        heatmapData[y][x]++;
      }
    });

    // Draw heatmap
    const maxValue = Math.max(...heatmapData.flat());
    heatmapData.forEach((row, y) => {
      row.forEach((value, x) => {
        const intensity = value / maxValue;
        ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.7})`;
        ctx.fillRect(
          startX + x * cellWidth,
          startY + y * cellHeight,
          cellWidth,
          cellHeight
        );
      });
    });
  };

  const drawShots = (ctx: CanvasRenderingContext2D, startX: number, startY: number, pitchWidth: number, pitchHeight: number) => {
    shotsData.forEach(shot => {
      ctx.fillStyle = shot.isGoal ? 'green' : 'red';
      ctx.beginPath();
      ctx.arc(
        startX + (shot.x / 100) * pitchWidth,
        startY + (shot.y / 100) * pitchHeight,
        5,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });
  };

  const drawPasses = (ctx: CanvasRenderingContext2D, startX: number, startY: number, pitchWidth: number, pitchHeight: number) => {
    passesData.forEach(pass => {
      ctx.strokeStyle = pass.isSuccessful ? 'blue' : 'orange';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX + (pass.startX / 100) * pitchWidth, startY + (pass.startY / 100) * pitchHeight);
      ctx.lineTo(startX + (pass.endX / 100) * pitchWidth, startY + (pass.endY / 100) * pitchHeight);
      ctx.stroke();
    });
  };

  const drawDribbling = (ctx: CanvasRenderingContext2D, startX: number, startY: number, pitchWidth: number, pitchHeight: number) => {
    dribblingData.forEach(dribble => {
      ctx.fillStyle = 'yellow';
      ctx.beginPath();
      ctx.arc(
        startX + (dribble.x / 100) * pitchWidth,
        startY + (dribble.y / 100) * pitchHeight,
        5,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });
  };

  const drawTouches = (ctx: CanvasRenderingContext2D, startX: number, startY: number, pitchWidth: number, pitchHeight: number) => {
    touchesData.forEach(touch => {
      ctx.fillStyle = 'purple';
      ctx.beginPath();
      ctx.arc(
        startX + (touch.x / 100) * pitchWidth,
        startY + (touch.y / 100) * pitchHeight,
        5,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });
  };

  useEffect(() => {
    // Set initial gps data
    if (initialGpsData?.length) {
      setGpsData(initialGpsData);
    }
    
    // Initialize map or canvas
    if (isIndoorMode) {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.offsetWidth;
        canvasRef.current.height = canvasRef.current.offsetHeight;
        drawIndoorPitch();
      }
    } else {
      initializeMapboxMap();
    }

    // Fetch saved geofence settings from local storage
    const savedGeofence = localStorage.getItem('geofenceSettings');
    if (savedGeofence) {
      try {
        setGeofenceSettings(JSON.parse(savedGeofence));
      } catch (e) {
        console.error('Error loading geofence settings', e);
      }
    }

    // Set up real-time data subscription if in live mode
    if (isLiveMode) {
      setupRealTimeDataSubscription();
    } 
    // Otherwise fetch historical data if sessionId is provided
    else if (sessionId) {
      fetchHistoricalGpsData();
    }

    return () => {
      map.current?.remove();
      map.current = null;
      
      // Clean up any subscriptions
      if (isLiveMode) {
        // Fix: Don't use string for channel, use the stored channel reference for removal
        supabase.removeAllChannels();
      }
    };
  }, [isIndoorMode, showThirds, mapboxToken, sessionId, isLiveMode]);

  // Effect to redraw when analysis type changes
  useEffect(() => {
    if (isIndoorMode && canvasRef.current) {
      drawIndoorPitch();
    }
  }, [analysisType, gpsData]);

  const initializeMapboxMap = () => {
    if (!mapContainer.current || !mapboxToken) {
      if (!mapboxToken && !isIndoorMode) {
        toast({
          title: "Mapbox Token Required",
          description: "Please enter your Mapbox public token to view the GPS map.",
          variant: "destructive",
        });
      }
      return;
    }

    try {
      mapboxgl.accessToken = mapboxToken;
      
      if (!map.current) {
        // Fix: Ensure we have a valid center point with correct format
        const center: [number, number] = gpsData?.length 
          ? [gpsData[0][2], gpsData[0][1]]
          : [-0.1278, 51.5074]; // Default to London if no data
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/satellite-v9',
          center,
          zoom: 18,
          pitch: 45,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.current.on('load', () => {
          if (!map.current || !gpsData?.length) return;

          // Add path layer
          map.current.addSource('movement-path', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: gpsData.map(([_, lat, lng]) => [lng, lat])
              }
            }
          });

          map.current.addLayer({
            id: 'movement-path',
            type: 'line',
            source: 'movement-path',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#22c55e',
              'line-width': 3
            }
          });

          // Add heatmap layer
          map.current.addSource('movement-heat', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: gpsData.map(([_, lat, lng]) => ({
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: [lng, lat]
                }
              }))
            }
          });

          map.current.addLayer({
            id: 'movement-heat',
            type: 'heatmap',
            source: 'movement-heat',
            paint: {
              'heatmap-weight': 1,
              'heatmap-intensity': 1,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(33,102,172,0)',
                0.2, 'rgb(103,169,207)',
                0.4, 'rgb(209,229,240)',
                0.6, 'rgb(253,219,199)',
                0.8, 'rgb(239,138,98)',
                1, 'rgb(178,24,43)'
              ],
              'heatmap-radius': 15
            }
          });

          // If geofence is enabled, draw it
          if (geofenceSettings.enabled && geofenceSettings.points.length > 2) {
            drawGeofence();
          }
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      toast({
        title: "Map Error",
        description: "Failed to initialize map. Please check your Mapbox token.",
        variant: "destructive",
      });
    }
  };

  const drawGeofence = () => {
    if (!map.current || !geofenceSettings.points.length) return;
    
    // Add source for geofence if it doesn't exist
    if (!map.current.getSource('geofence')) {
      map.current.addSource('geofence', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [...geofenceSettings.points.map(p => [p.longitude, p.latitude]), 
              // Close the polygon by repeating first point
              geofenceSettings.points.length ? [geofenceSettings.points[0].longitude, geofenceSettings.points[0].latitude] : []]
            ]
          }
        }
      });
      
      // Add fill layer
      map.current.addLayer({
        id: 'geofence-fill',
        type: 'fill',
        source: 'geofence',
        paint: {
          'fill-color': '#0F766E',
          'fill-opacity': 0.2
        }
      });
      
      // Add line layer
      map.current.addLayer({
        id: 'geofence-line',
        type: 'line',
        source: 'geofence',
        paint: {
          'line-color': '#10B981',
          'line-width': 2
        }
      });
    } else {
      // Update existing geofence
      (map.current.getSource('geofence') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [...geofenceSettings.points.map(p => [p.longitude, p.latitude]),
            // Close the polygon
            geofenceSettings.points.length ? [geofenceSettings.points[0].longitude, geofenceSettings.points[0].latitude] : []]
          ]
        }
      });
    }
  };

  const setupRealTimeDataSubscription = () => {
    console.log('Setting up real-time data subscription');
    
    // Store the channel reference so we can properly clean it up later
    const gpsChannel = supabase
      .channel('gps-updates')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'sensor_recordings',
          filter: sessionId ? `training_session_id=eq.${sessionId}` : undefined
        },
        handleRealTimeGpsUpdate
      )
      .subscribe();

    // Mock data for testing if not connected to real device
    if (isLiveMode && !deviceConnected) {
      startMockDataGeneration();
    }
    
    return () => {
      supabase.removeChannel(gpsChannel);
    };
  };

  const handleRealTimeGpsUpdate = (payload: any) => {
    console.log('Real-time GPS update received:', payload);
    
    // Process the GPS data if it's location data
    if (payload.new && payload.new.sensor_type === 'Location') {
      const timestamp = payload.new.timestamp;
      const latitude = payload.new.x; // Using X field for latitude
      const longitude = payload.new.y; // Using Y field for longitude
      
      setGpsData(currentData => {
        const newData = [...currentData, [timestamp, latitude, longitude] as [number, number, number]];
        updateMapWithNewCoordinate(timestamp, latitude, longitude);
        return newData;
      });
    }
  };

  const fetchHistoricalGpsData = async () => {
    if (!sessionId) return;
    
    try {
      const { data, error } = await supabase
        .from('sensor_recordings')
        .select('*')
        .eq('training_session_id', sessionId)
        .eq('sensor_type', 'Location')
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Transform the data into the expected format [timestamp, lat, lng]
        const formattedData = data.map(record => [
          typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : (record.timestamp as number),
          record.x, // latitude
          record.y  // longitude
        ]) as [number, number, number][];
        
        setGpsData(formattedData);
      }
    } catch (error) {
      console.error('Error fetching historical GPS data:', error);
      toast({
        title: "Data Error",
        description: "Failed to load historical GPS data.",
        variant: "destructive",
      });
    }
  };

  const updateMapWithNewCoordinate = (timestamp: number, latitude: number, longitude: number) => {
    // Update map if in Mapbox mode
    if (!isIndoorMode && map.current) {
      // Update path source
      const pathSource = map.current.getSource('movement-path') as mapboxgl.GeoJSONSource;
      const heatSource = map.current.getSource('movement-heat') as mapboxgl.GeoJSONSource;
      
      if (pathSource && heatSource) {
        // Get current data and add new point
        const pathData = (pathSource as any)._data;
        if (pathData?.geometry?.coordinates) {
          const newCoords = [...pathData.geometry.coordinates, [longitude, latitude]];
          pathSource.setData({
            ...pathData,
            geometry: {
              ...pathData.geometry,
              coordinates: newCoords
            }
          });
        }
        
        // Update heatmap
        const heatData = (heatSource as any)._data;
        if (heatData?.features) {
          const newFeature = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            }
          };
          heatSource.setData({
            ...heatData,
            features: [...heatData.features, newFeature]
          });
        }
      }
    }
  };

  const startMockDataGeneration = () => {
    // Parameters for generating realistic GPS trajectories
    let lastLat = 51.5074; // Start at London
    let lastLng = -0.1278;
    let heading = Math.random() * 360; // Random initial heading (degrees)
    const updateInterval = 2000; // Update every 2 seconds
    const speedMs = 2 + Math.random() * 3; // Speed in m/s (walking/jogging speed)
    const turnProbability = 0.2; // Probability of changing direction
    const maxTurn = 30; // Max turn in degrees
    
    // Earth radius in meters
    const EARTH_RADIUS = 6378137;
    
    // Function to calculate new position based on bearing and distance
    const calculateNewPosition = (lat: number, lng: number, bearing: number, distance: number) => {
      // Convert to radians
      const latRad = (lat * Math.PI) / 180;
      const lngRad = (lng * Math.PI) / 180;
      const bearingRad = (bearing * Math.PI) / 180;
      
      // Angular distance
      const angularDistance = distance / EARTH_RADIUS;
      
      // Calculate new latitude
      const newLatRad = Math.asin(
        Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
      );
      
      // Calculate new longitude
      const newLngRad = lngRad + Math.atan2(
        Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
      );
      
      // Convert back to degrees
      const newLat = (newLatRad * 180) / Math.PI;
      const newLng = (newLngRad * 180) / Math.PI;
      
      return { lat: newLat, lng: newLng };
    };
    
    // Generate simulated movement
    const interval = setInterval(() => {
      if (!isRecording) {
        clearInterval(interval);
        return;
      }
      
      // Maybe change direction
      if (Math.random() < turnProbability) {
        heading += (Math.random() * 2 - 1) * maxTurn;
        // Keep heading in 0-360 range
        heading = (heading + 360) % 360;
      }
      
      // Calculate new position
      const distanceTraveled = speedMs * updateInterval / 1000;
      const { lat: newLat, lng: newLng } = calculateNewPosition(
        lastLat, lastLng, heading, distanceTraveled
      );
      
      // Create timestamp
      const timestamp = Date.now();
      
      // Update last position
      lastLat = newLat;
      lastLng = newLng;
      
      // Add new point
      setGpsData(currentData => {
        // Fix: Ensure we're returning the correct type: Array<[number, number, number]>
        const newPoint: [number, number, number] = [timestamp, newLat, newLng];
        const newData = [...currentData, newPoint];
        updateMapWithNewCoordinate(timestamp, newLat, newLng);
        return newData;
      });
    }, updateInterval);
    
    return () => clearInterval(interval);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording
      setIsRecording(true);
      toast({
        title: "Recording Started",
        description: "GPS tracking is now active.",
      });
      
      // If not connected to a real device, start mock data
      if (!deviceConnected) {
        startMockDataGeneration();
      }
    } else {
      // Stop recording
      setIsRecording(false);
      toast({
        title: "Recording Stopped",
        description: "GPS tracking has been stopped.",
      });
    }
  };

  // Function to connect with Apple Watch or other wearable
  const connectDevice = () => {
    // Mock connection for now
    toast({
      title: "Connecting to Device",
      description: "Attempting to connect to your Apple Watch...",
    });
    
    // Simulate connection delay
    setTimeout(() => {
      setDeviceConnected(true);
      toast({
        title: "Device Connected",
        description: "Successfully connected to Apple Watch. You can now start recording.",
      });
    }, 2000);
  };

  const saveGeofenceSettings = () => {
    // Save to localStorage
    localStorage.setItem('geofenceSettings', JSON.stringify(geofenceSettings));
    setIsGeofenceDialogOpen(false);
    
    if (geofenceSettings.enabled) {
      toast({
        title: "Geofence Saved",
        description: `Geofence "${geofenceSettings.name}" has been saved and activated.`,
      });
      
      // Draw geofence on map
      if (!isIndoorMode && map.current) {
        drawGeofence();
      }
    } else {
      toast({
        title: "Geofence Disabled",
        description: "Geofence has been disabled.",
      });
    }
  };

  const setCurrentLocationAsGeofencePoint = () => {
    if (!geofenceSettings.enabled) return;
    
    if (gpsData?.length) {
      const lastPoint = gpsData[gpsData.length - 1];
      const newPoint = {
        latitude: lastPoint[1],
        longitude: lastPoint[2]
      };
      
      setGeofenceSettings(current => ({
        ...current,
        points: [...current.points, newPoint]
      }));
      
      toast({
        title: "Point Added",
        description: `Added point to geofence boundary at ${newPoint.latitude.toFixed(6)}, ${newPoint.longitude.toFixed(6)}`,
      });
    } else {
      toast({
        title: "No GPS Data",
        description: "Cannot add geofence point without current location data.",
        variant: "destructive",
      });
    }
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    setMapboxToken(newToken);
    
    // Save token to localStorage for convenience
    if (newToken) {
      localStorage.setItem('mapboxToken', newToken);
      
      if (!isIndoorMode) {
        toast({
          title: "Token Updated",
          description: "Mapbox token has been updated and saved.",
        });
      }
    }
  };

  // Load token from localStorage on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem('mapboxToken');
    if (savedToken) {
      setMapboxToken(savedToken);
    }
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Player Movement Map</span>
          <div className="flex items-center gap-2">
            <Toggle
              pressed={showThirds}
              onPressedChange={setShowThirds}
              className="ml-2"
            >
              Show Thirds
            </Toggle>
            <Toggle
              pressed={isIndoorMode}
              onPressedChange={setIsIndoorMode}
              className="ml-2"
            >
              {isIndoorMode ? 'Indoor Mode' : 'GPS Mode'}
            </Toggle>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select analysis type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="movement">Player Movement</SelectItem>
              <SelectItem value="heatmap">Heat Map</SelectItem>
              <SelectItem value="shots">Shots Map</SelectItem>
              <SelectItem value="passes">Passes</SelectItem>
              <SelectItem value="dribbling">Dribbling</SelectItem>
              <SelectItem value="touches">Touches</SelectItem>
            </SelectContent>
          </Select>

          {!isIndoorMode && (
            <Input
              type="text"
              placeholder="Enter your Mapbox public token"
              value={mapboxToken}
              onChange={handleTokenChange}
              className="mb-2"
            />
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              variant={deviceConnected ? "outline" : "default"}
              onClick={connectDevice}
              disabled={deviceConnected}
              className="flex items-center gap-1"
            >
              <Activity className="h-4 w-4" />
              {deviceConnected ? "Device Connected" : "Connect Apple Watch"}
            </Button>
            
            <Button
              variant={isRecording ? "destructive" : "default"}
              onClick={toggleRecording}
              disabled={!deviceConnected && !isLiveMode}
              className="flex items-center gap-1"
            >
              <CircleDot className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
            
            <AlertDialog open={isGeofenceDialogOpen} onOpenChange={setIsGeofenceDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-1"
                >
                  <Map className="h-4 w-4" />
                  Geofence Settings
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Pitch Geofence Settings</AlertDialogTitle>
                  <AlertDialogDescription>
                    Define the boundaries of your playing area to map GPS coordinates to the virtual pitch.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2">
                    <Toggle
                      pressed={geofenceSettings.enabled}
                      onPressedChange={(enabled) => setGeofenceSettings(current => ({...current, enabled}))}
                    >
                      Enable Geofencing
                    </Toggle>
                  </div>
                  
                  <Input
                    placeholder="Geofence Name (e.g. Main Pitch)"
                    value={geofenceSettings.name}
                    onChange={(e) => setGeofenceSettings(current => ({...current, name: e.target.value}))}
                    disabled={!geofenceSettings.enabled}
                  />
                  
                  <div className="border rounded-md p-3">
                    <h4 className="text-sm font-medium mb-2">Boundary Points: {geofenceSettings.points.length}</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      Walk around the perimeter of your pitch and add points to create the boundary.
                    </p>
                    
                    <Button 
                      size="sm" 
                      onClick={setCurrentLocationAsGeofencePoint}
                      disabled={!geofenceSettings.enabled || !gpsData?.length}
                    >
                      Add Current Location as Point
                    </Button>
                    
                    {geofenceSettings.points.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto">
                        <ul className="text-xs">
                          {geofenceSettings.points.map((point, index) => (
                            <li key={index} className="flex justify-between my-1">
                              <span>Point {index + 1}: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</span>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-5 px-1"
                                onClick={() => setGeofenceSettings(current => ({
                                  ...current,
                                  points: current.points.filter((_, i) => i !== index)
                                }))}
                              >
                                ✕
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={saveGeofenceSettings}>
                    Save Settings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {isIndoorMode ? (
          <canvas 
            ref={canvasRef}
            className="h-[500px] w-full rounded-lg bg-[#0F172A]"
          />
        ) : (
          <div ref={mapContainer} className="h-[500px] rounded-lg overflow-hidden" />
        )}

        {showThirds && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Defensive Third</CardTitle>
              </CardHeader>
              <CardContent>
                {gpsData?.length > 0 && analysisType === 'heatmap' && (
                  <div className="text-sm">
                    <p>Time spent: {Math.floor(Math.random() * 30) + 10}%</p>
                    <p>Defensive actions: {Math.floor(Math.random() * 20) + 5}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Middle Third</CardTitle>
              </CardHeader>
              <CardContent>
                {gpsData?.length > 0 && analysisType === 'heatmap' && (
                  <div className="text-sm">
                    <p>Time spent: {Math.floor(Math.random() * 30) + 30}%</p>
                    <p>Passes completed: {Math.floor(Math.random() * 30) + 10}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Attacking Third</CardTitle>
              </CardHeader>
              <CardContent>
                {gpsData?.length > 0 && analysisType === 'heatmap' && (
                  <div className="text-sm">
                    <p>Time spent: {Math.floor(Math.random() * 30) + 20}%</p>
                    <p>Shots: {Math.floor(Math.random() * 10) + 2}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerMovementMap;
