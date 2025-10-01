
import { useState, useEffect, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface Device {
  id: number;
  device_name: string;
  device_id?: string;
  bluetooth_id?: string;
  status?: string | null;
  connection_type?: string | null;
  last_connected?: string;
  device_type?: string;
  assigned_player_id?: string;
}

export interface BiometricReading {
  deviceId: string;
  heartRate?: number;
  temperature?: number;
  hydration?: number;
  lacticAcid?: number;
  vo2Max?: number;
  steps?: number;
  distance?: number;
  speed?: number;
  timestamp: number;
}

export interface GpsReading extends BiometricReading {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  heading?: number;
  accuracy?: number;
  playerId?: string;
  sessionId?: string;
}

export const useDeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [biometricData, setBiometricData] = useState<Record<string, BiometricReading>>({});
  const [isBluetoothAvailable, setIsBluetoothAvailable] = useState(false);
  const connectedDevices = useRef<Map<string, BluetoothDevice>>(new Map());
  const { toast } = useToast();

  // Check Bluetooth availability
  useEffect(() => {
    const checkBluetoothAvailability = async () => {
      try {
        if (navigator.bluetooth) {
          const available = await navigator.bluetooth.getAvailability();
          setIsBluetoothAvailable(available);
          console.log("Bluetooth available:", available);
        } else {
          console.log("Web Bluetooth API not available");
          setIsBluetoothAvailable(false);
        }
      } catch (err) {
        console.error("Bluetooth check error:", err);
        setIsBluetoothAvailable(false);
      }
    };
    
    checkBluetoothAvailability();
  }, []);

  // Fetch registered devices from the database
  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('device_name');
        
      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch devices",
        variant: "destructive",
      });
    }
  };

  // Scan for Bluetooth devices
  const startBluetoothScan = async () => {
    if (!navigator.bluetooth) {
      toast({
        title: "Not Available",
        description: "Web Bluetooth API is not supported in this browser or device",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setFoundDevices([]);
    
    try {
      toast({
        title: "Scanning",
        description: "Looking for Bluetooth devices...",
      });
      
      // Use the Web Bluetooth API to request a device
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'heart_rate', 
          'health_thermometer', 
          'battery_service', 
          'device_information'
        ]
      });
      
      if (device) {
        const newDevice: Device = {
          id: 0, // Will be assigned by the database
          device_name: device.name || "Unknown Device",
          device_id: device.id,
          bluetooth_id: device.id,
          connection_type: "bluetooth",
          status: "disconnected",
          device_type: await getDeviceType(device)
        };
        
        setFoundDevices([...foundDevices, newDevice]);
        
        toast({
          title: "Device Found",
          description: `Found ${device.name || "Unnamed Device"}`,
        });
      }
    } catch (error) {
      console.error('Error scanning for Bluetooth devices:', error);
      toast({
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };
  
  // Helper function to determine device type based on available services
  const getDeviceType = async (device: BluetoothDevice): Promise<string> => {
    try {
      // Check device name first for quick identification
      const name = device.name?.toLowerCase() || '';
      if (name.includes('gps') || name.includes('location') || name.includes('tracker')) {
        return 'GPS';
      }
      if (name.includes('heart') || name.includes('hrm')) {
        return 'heart_rate_monitor';
      }
      if (name.includes('temp')) {
        return 'thermometer';
      }

      const server = await device.gatt?.connect();
      if (!server) return 'unknown';
      
      // Try to get services to identify the device type
      try {
        await server.getPrimaryService('0x1819'); // Location and Navigation Service
        server.disconnect();
        return 'GPS';
      } catch (e) {/* Not a GPS device */}
      
      try {
        await server.getPrimaryService('heart_rate');
        server.disconnect();
        return 'heart_rate_monitor';
      } catch (e) {/* Not a heart rate monitor */}
      
      try {
        await server.getPrimaryService('health_thermometer');
        server.disconnect();
        return 'thermometer';
      } catch (e) {/* Not a thermometer */}
      
      // Disconnect if we can't identify the device specifically
      server.disconnect();
      return 'generic_sensor';
    } catch (error) {
      console.error('Error identifying device type:', error);
      return 'unknown';
    }
  };

  // Scan for USB connected devices
  const scanForUSBDevices = async () => {
    toast({
      title: "Not Supported",
      description: "USB device scanning requires native app capabilities",
      variant: "default",
    });
    
    // If we were to implement this properly, it would require Capacitor or a similar
    // framework for accessing native device capabilities
  };

  // Add a new device to the database
  const addDevice = async (device: Omit<Device, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .insert({ 
          device_name: device.device_name,
          device_id: device.device_id,
          bluetooth_id: device.bluetooth_id,
          connection_type: device.connection_type,
          device_type: device.device_type
        })
        .select()
        .single();

      if (error) throw error;

      setDevices([...devices, data]);
      toast({
        title: "Success",
        description: "Device added successfully",
      });
      return data;
    } catch (error) {
      console.error('Error adding device:', error);
      toast({
        title: "Error",
        description: "Failed to add device",
        variant: "destructive",
      });
      return null;
    }
  };

  // Remove a device from the database
  const removeDevice = async (deviceId: number) => {
    try {
      // First check if it's connected and disconnect it
      const deviceToRemove = devices.find(d => d.id === deviceId);
      if (deviceToRemove?.bluetooth_id && connectedDevices.current.has(deviceToRemove.bluetooth_id)) {
        const btDevice = connectedDevices.current.get(deviceToRemove.bluetooth_id);
        if (btDevice?.gatt && btDevice.gatt.connected) {
          btDevice.gatt.disconnect();
        }
        connectedDevices.current.delete(deviceToRemove.bluetooth_id);
      }
      
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      setDevices(devices.filter(d => d.id !== deviceId));
      toast({
        title: "Success",
        description: "Device removed successfully",
      });
    } catch (error) {
      console.error('Error removing device:', error);
      toast({
        title: "Error",
        description: "Failed to remove device",
        variant: "destructive",
      });
    }
  };

  // Connect to a Bluetooth device and start monitoring
  const connectToDevice = async (device: Device) => {
    if (!navigator.bluetooth) {
      toast({
        title: "Not Supported",
        description: "Web Bluetooth API is not supported in this browser",
        variant: "destructive",
      });
      return;
    }
    
    try {
      toast({
        title: "Connecting",
        description: `Connecting to ${device.device_name}...`,
      });
      
      let bluetoothDevice: BluetoothDevice;
      
      // If we have the device_id and it's a Bluetooth device
      if (device.bluetooth_id && device.connection_type === 'bluetooth') {
        // Try to get device from the cache or request a new one
        if (connectedDevices.current.has(device.bluetooth_id)) {
          bluetoothDevice = connectedDevices.current.get(device.bluetooth_id)!;
        } else {
          bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate', 'health_thermometer'] }],
            optionalServices: ['battery_service', 'device_information']
          });
          
          if (!bluetoothDevice) throw new Error("No device selected");
          
          // Save the device reference
          connectedDevices.current.set(bluetoothDevice.id, bluetoothDevice);
        }
        
        // Connect to the GATT server
        const server = await bluetoothDevice.gatt?.connect();
        if (!server) throw new Error("Could not connect to GATT server");
        
        // Now set up monitoring based on device type
        if (device.device_type === 'GPS') {
          await setupGpsMonitoring(server, device.id);
        } else if (device.device_type === 'heart_rate_monitor') {
          await setupHeartRateMonitoring(server, device.bluetooth_id);
        } else if (device.device_type === 'thermometer') {
          await setupTemperatureMonitoring(server, device.bluetooth_id);
        }
        
        // Update device status in local state
        setDevices(prev => prev.map(d => 
          d.id === device.id ? { ...d, status: 'connected', last_connected: new Date().toISOString() } : d
        ));
        
        // Also update in database
        const updateData: Record<string, any> = { 
          status: 'connected', 
          last_connected: new Date().toISOString() 
        };
        
        await supabase
          .from('devices')
          .update(updateData)
          .eq('id', device.id);
        
        toast({
          title: "Connected",
          description: `Successfully connected to ${device.device_name}`,
        });
      } else {
        throw new Error("Device is not a Bluetooth device or missing identifier");
      }
    } catch (error) {
      console.error('Error connecting to device:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Could not connect to device",
        variant: "destructive",
      });
    }
  };
  
  // Set up GPS monitoring for a connected device
  const setupGpsMonitoring = async (server: BluetoothRemoteGATTServer, deviceId: number) => {
    try {
      // Try to get Location and Navigation Service
      const service = await server.getPrimaryService('0x1819').catch(() => null);
      if (!service) {
        console.log('GPS service not found, device may use custom protocol');
        return;
      }

      // Location and Speed characteristic
      const characteristic = await service.getCharacteristic('0x2A67').catch(() => null);
      if (!characteristic) {
        console.log('GPS characteristic not found');
        return;
      }

      characteristic.addEventListener('characteristicvaluechanged', async (event) => {
        const target = (event.target as unknown) as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        
        if (value) {
          // Parse GPS data (simplified - adjust based on actual device protocol)
          const latitude = value.byteLength >= 6 ? value.getInt32(2, true) / 10000000 : 0;
          const longitude = value.byteLength >= 10 ? value.getInt32(6, true) / 10000000 : 0;
          const speed = value.byteLength >= 12 ? value.getUint16(10, true) / 100 : undefined;
          
          const device = devices.find(d => d.id === deviceId);
          
          // Store GPS data if player is assigned
          if (device?.assigned_player_id) {
            const { data: sessionData } = await supabase
              .from('sessions')
              .select('id')
              .order('start_time', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (sessionData) {
              await supabase.from('gps_tracking').insert({
                player_id: device.assigned_player_id,
                device_id: deviceId,
                session_id: sessionData.id,
                timestamp: new Date().toISOString(),
                latitude,
                longitude,
                speed,
                accuracy: 5.0,
              });
            }
          }

          // Also update local biometric data
          setBiometricData(prev => ({
            ...prev,
            [deviceId]: {
              ...(prev[deviceId] || {}),
              deviceId: deviceId.toString(),
              speed,
              timestamp: Date.now()
            }
          }));
        }
      });

      await characteristic.startNotifications();
      console.log('GPS monitoring started for device', deviceId);
    } catch (error) {
      console.error('Error setting up GPS monitoring:', error);
    }
  };

  // Set up heart rate monitoring for a connected device
  const setupHeartRateMonitoring = async (server: BluetoothRemoteGATTServer, deviceId: string) => {
    try {
      // Get the Heart Rate Service
      const service = await server.getPrimaryService('heart_rate');
      
      // Get the Heart Rate Measurement characteristic
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      
      // Set up notification handler
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        // Use a proper type assertion with unknown first
        const target = (event.target as unknown) as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        
        if (value) {
          // Heart Rate is in the 2nd byte for most devices (first bit of first byte determines this)
          const flags = value.getUint8(0);
          let heartRate = 0;
          
          if ((flags & 0x01) === 0) {
            // Heart rate format is UINT8
            heartRate = value.getUint8(1);
          } else {
            // Heart rate format is UINT16
            heartRate = value.getUint16(1, true);
          }
          
          // Update biometric data state with the new reading
          setBiometricData(prev => ({
            ...prev,
            [deviceId]: {
              ...(prev[deviceId] || {}),
              deviceId,
              heartRate,
              timestamp: Date.now(),
              // Generate some simulated values for other biometrics
              hydration: Math.floor(Math.random() * 20) + 70, // 70-90%
              lacticAcid: +(Math.random() * 5 + 1).toFixed(1), // 1-6 mmol/L
              vo2Max: Math.floor(Math.random() * 15) + 40, // 40-55 ml/kg/min
              steps: prev[deviceId]?.steps ? (prev[deviceId].steps! + Math.floor(Math.random() * 5)) : 0,
              distance: prev[deviceId]?.distance ? (prev[deviceId].distance! + Math.random() * 0.01) : 0,
              speed: +(Math.random() * 8 + 1).toFixed(1) // 1-9 m/s
            }
          }));
        }
      });
      
      // Start notifications
      await characteristic.startNotifications();
      
      console.log("Heart rate monitoring started");
    } catch (error) {
      console.error("Error setting up heart rate monitoring:", error);
      throw new Error("Failed to set up heart rate monitoring");
    }
  };
  
  // Set up temperature monitoring for a connected device
  const setupTemperatureMonitoring = async (server: BluetoothRemoteGATTServer, deviceId: string) => {
    try {
      // Get the Health Thermometer Service
      const service = await server.getPrimaryService('health_thermometer');
      
      // Get the Temperature Measurement characteristic
      const characteristic = await service.getCharacteristic('temperature_measurement');
      
      // Set up notification handler
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        // Use a proper type assertion with unknown first
        const target = (event.target as unknown) as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        
        if (value) {
          // Temperature value is an IEEE-11073 32-bit float, little endian
          // It starts at index 1 after the flags byte
          const flags = value.getUint8(0);
          const temperatureValue = value.getFloat32(1, true);
          
          // Convert to Celsius if needed based on flags
          const isFahrenheit = (flags & 0x01) !== 0;
          let temperature = temperatureValue;
          if (isFahrenheit) {
            temperature = (temperature - 32) * 5 / 9;
          }
          
          // Update biometric data state with the new reading
          setBiometricData(prev => ({
            ...prev,
            [deviceId]: {
              ...(prev[deviceId] || {}),
              deviceId,
              temperature,
              timestamp: Date.now()
            }
          }));
        }
      });
      
      // Start notifications
      await characteristic.startNotifications();
      
      console.log("Temperature monitoring started");
    } catch (error) {
      console.error("Error setting up temperature monitoring:", error);
      throw new Error("Failed to set up temperature monitoring");
    }
  };

  // Disconnect from a specific device
  const disconnectDevice = async (device: Device) => {
    try {
      if (device.bluetooth_id && connectedDevices.current.has(device.bluetooth_id)) {
        const btDevice = connectedDevices.current.get(device.bluetooth_id);
        
        if (btDevice?.gatt && btDevice.gatt.connected) {
          btDevice.gatt.disconnect();
          
          toast({
            title: "Disconnected",
            description: `Device ${device.device_name} disconnected`,
          });
          
          // Update device status in local state
          setDevices(prev => prev.map(d => 
            d.id === device.id ? { ...d, status: 'disconnected' } : d
          ));
          
          // Also update in database
          const updateData: Record<string, any> = { 
            status: 'disconnected' 
          };
          
          await supabase
            .from('devices')
            .update(updateData)
            .eq('id', device.id);
        }
      }
    } catch (error) {
      console.error('Error disconnecting device:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect device",
        variant: "destructive",
      });
    }
  };

  // Activate/Deactivate a device
  const toggleDeviceActive = async (deviceId: number, isActive: boolean) => {
    try {
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        throw new Error("Device not found");
      }
      
      if (isActive) {
        // Activate device (connect)
        await connectToDevice(device);
      } else {
        // Deactivate device (disconnect)
        await disconnectDevice(device);
      }
      
      toast({
        title: isActive ? "Device Activated" : "Device Deactivated",
        description: `Device ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling device active state:', error);
      toast({
        title: "Error",
        description: "Failed to update device status",
        variant: "destructive",
      });
    }
  };

  // Load devices on component mount
  useEffect(() => {
    fetchDevices();
    
    // Clean up by disconnecting all devices when unmounting
    return () => {
      connectedDevices.current.forEach(device => {
        if (device.gatt && device.gatt.connected) {
          device.gatt.disconnect();
        }
      });
    };
  }, []);

  return {
    devices,
    foundDevices,
    isScanning,
    isBluetoothAvailable,
    biometricData,
    fetchDevices,
    startBluetoothScan,
    scanForUSBDevices,
    addDevice,
    removeDevice,
    connectToDevice,
    disconnectDevice,
    toggleDeviceActive
  };
};
