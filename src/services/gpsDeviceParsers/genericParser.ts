/**
 * Generic GPS Device Parser
 * Supports common GPS data formats (CSV, JSON, binary)
 */

export interface GpsReading {
  deviceId: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
}

/**
 * Parse GPS Location and Speed Characteristic (0x2A67)
 * Standard Bluetooth Location and Navigation Service format
 */
export const parseLocationAndSpeed = (dataView: DataView): Partial<GpsReading> => {
  try {
    // Flags byte (indicates which fields are present)
    const flags = dataView.getUint16(0, true);
    let offset = 2;

    const reading: Partial<GpsReading> = {
      timestamp: Date.now(),
    };

    // Latitude (int32, resolution 1/10^7)
    if (offset + 4 <= dataView.byteLength) {
      reading.latitude = dataView.getInt32(offset, true) / 10000000;
      offset += 4;
    }

    // Longitude (int32, resolution 1/10^7)
    if (offset + 4 <= dataView.byteLength) {
      reading.longitude = dataView.getInt32(offset, true) / 10000000;
      offset += 4;
    }

    // Altitude (int24, resolution 1/100 meters)
    if (flags & 0x01 && offset + 3 <= dataView.byteLength) {
      const altBytes = [
        dataView.getUint8(offset),
        dataView.getUint8(offset + 1),
        dataView.getUint8(offset + 2),
      ];
      const altValue = (altBytes[0] | (altBytes[1] << 8) | (altBytes[2] << 16));
      reading.altitude = altValue / 100;
      offset += 3;
    }

    // Speed (uint16, resolution 1/100 m/s)
    if (offset + 2 <= dataView.byteLength) {
      reading.speed = dataView.getUint16(offset, true) / 100;
      offset += 2;
    }

    // Heading (uint16, resolution 1/100 degrees)
    if (flags & 0x04 && offset + 2 <= dataView.byteLength) {
      reading.heading = dataView.getUint16(offset, true) / 100;
      offset += 2;
    }

    return reading;
  } catch (error) {
    console.error('Error parsing GPS data:', error);
    return { timestamp: Date.now() };
  }
};

/**
 * Parse Position Quality Characteristic (0x2A69)
 * GPS accuracy and quality information
 */
export const parsePositionQuality = (dataView: DataView): { accuracy?: number } => {
  try {
    // Flags
    const flags = dataView.getUint16(0, true);
    let offset = 2;

    const quality: { accuracy?: number } = {};

    // Position Status flags
    // Skip various quality indicators...

    // Horizontal Dilution of Precision (HDOP) - indicates accuracy
    if (offset + 1 <= dataView.byteLength) {
      quality.accuracy = dataView.getUint8(offset) / 10; // meters
    }

    return quality;
  } catch (error) {
    console.error('Error parsing position quality:', error);
    return {};
  }
};

/**
 * Parse text-based GPS data (CSV format)
 * Format: timestamp,lat,lon,alt,speed,heading,accuracy
 */
export const parseCSVGpsData = (text: string): Partial<GpsReading>[] => {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const readings: Partial<GpsReading>[] = [];

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim());
    
    const reading: Partial<GpsReading> = {
      timestamp: cols[0] ? Number(cols[0]) : Date.now(),
      latitude: cols[1] ? Number(cols[1]) : undefined,
      longitude: cols[2] ? Number(cols[2]) : undefined,
      altitude: cols[3] ? Number(cols[3]) : undefined,
      speed: cols[4] ? Number(cols[4]) : undefined,
      heading: cols[5] ? Number(cols[5]) : undefined,
      accuracy: cols[6] ? Number(cols[6]) : undefined,
    };

    readings.push(reading);
  }

  return readings;
};

/**
 * Parse JSON GPS data
 */
export const parseJSONGpsData = (json: string): Partial<GpsReading> => {
  try {
    const data = JSON.parse(json);
    return {
      timestamp: data.timestamp || Date.now(),
      latitude: data.lat || data.latitude,
      longitude: data.lon || data.longitude || data.lng,
      altitude: data.alt || data.altitude,
      speed: data.speed,
      heading: data.heading || data.bearing,
      accuracy: data.accuracy || data.hdop,
    };
  } catch (error) {
    console.error('Error parsing JSON GPS data:', error);
    return { timestamp: Date.now() };
  }
};

/**
 * Get supported GPS service UUIDs
 */
export const getGpsServiceUUIDs = (): string[] => {
  return [
    '0x1819', // Location and Navigation Service
    '00001819-0000-1000-8000-00805f9b34fb', // Location and Navigation Service (full UUID)
  ];
};

/**
 * Get supported GPS characteristic UUIDs
 */
export const getGpsCharacteristicUUIDs = (): Record<string, string> => {
  return {
    locationAndSpeed: '0x2A67',
    positionQuality: '0x2A69',
    lnFeature: '0x2A6A',
    lnControlPoint: '0x2A6B',
  };
};
