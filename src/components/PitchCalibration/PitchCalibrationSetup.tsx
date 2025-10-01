import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Save, Trash2 } from 'lucide-react';

interface Corner {
  lat: number | null;
  lon: number | null;
}

const PitchCalibrationSetup = () => {
  const { toast } = useToast();
  const [pitchName, setPitchName] = useState('');
  const [pitchLength, setPitchLength] = useState('105');
  const [pitchWidth, setPitchWidth] = useState('68');
  const [corners, setCorners] = useState<{
    nw: Corner;
    ne: Corner;
    sw: Corner;
    se: Corner;
  }>({
    nw: { lat: null, lon: null },
    ne: { lat: null, lon: null },
    sw: { lat: null, lon: null },
    se: { lat: null, lon: null },
  });
  const [savedCalibrations, setSavedCalibrations] = useState<any[]>([]);
  const [capturing, setCapturing] = useState<string | null>(null);

  useEffect(() => {
    fetchCalibrations();
  }, []);

  const fetchCalibrations = async () => {
    const { data, error } = await supabase
      .from('pitch_calibration')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedCalibrations(data);
    }
  };

  const captureCorner = (cornerName: keyof typeof corners) => {
    setCapturing(cornerName);
    
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support geolocation',
        variant: 'destructive',
      });
      setCapturing(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCorners((prev) => ({
          ...prev,
          [cornerName]: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
        }));
        toast({
          title: 'Location captured',
          description: `${cornerName.toUpperCase()} corner position saved`,
        });
        setCapturing(null);
      },
      (error) => {
        toast({
          title: 'Location capture failed',
          description: error.message,
          variant: 'destructive',
        });
        setCapturing(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const saveCalibration = async () => {
    // Validate all corners are captured
    if (
      !corners.nw.lat || !corners.ne.lat || !corners.sw.lat || !corners.se.lat ||
      !corners.nw.lon || !corners.ne.lon || !corners.sw.lon || !corners.se.lon
    ) {
      toast({
        title: 'Incomplete calibration',
        description: 'Please capture all four corners',
        variant: 'destructive',
      });
      return;
    }

    if (!pitchName.trim()) {
      toast({
        title: 'Missing pitch name',
        description: 'Please enter a name for this pitch',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('pitch_calibration').insert({
      name: pitchName,
      corner_nw_lat: corners.nw.lat,
      corner_nw_lon: corners.nw.lon,
      corner_ne_lat: corners.ne.lat,
      corner_ne_lon: corners.ne.lon,
      corner_sw_lat: corners.sw.lat,
      corner_sw_lon: corners.sw.lon,
      corner_se_lat: corners.se.lat,
      corner_se_lon: corners.se.lon,
      pitch_length: Number(pitchLength),
      pitch_width: Number(pitchWidth),
      is_active: savedCalibrations.length === 0, // First one is active by default
    });

    if (error) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Calibration saved',
        description: 'Pitch calibration has been saved successfully',
      });
      fetchCalibrations();
      // Reset form
      setPitchName('');
      setCorners({
        nw: { lat: null, lon: null },
        ne: { lat: null, lon: null },
        sw: { lat: null, lon: null },
        se: { lat: null, lon: null },
      });
    }
  };

  const deleteCalibration = async (id: string) => {
    const { error } = await supabase
      .from('pitch_calibration')
      .delete()
      .eq('id', id);

    if (!error) {
      toast({
        title: 'Calibration deleted',
        description: 'Pitch calibration has been removed',
      });
      fetchCalibrations();
    }
  };

  const setActiveCalibration = async (id: string) => {
    // Deactivate all
    await supabase
      .from('pitch_calibration')
      .update({ is_active: false })
      .neq('id', id);

    // Activate selected
    const { error } = await supabase
      .from('pitch_calibration')
      .update({ is_active: true })
      .eq('id', id);

    if (!error) {
      toast({
        title: 'Active pitch updated',
        description: 'This calibration is now active',
      });
      fetchCalibrations();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Pitch Calibration</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="pitchName">Pitch Name</Label>
            <Input
              id="pitchName"
              value={pitchName}
              onChange={(e) => setPitchName(e.target.value)}
              placeholder="e.g., Training Ground A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="length">Length (m)</Label>
              <Input
                id="length"
                type="number"
                value={pitchLength}
                onChange={(e) => setPitchLength(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="width">Width (m)</Label>
              <Input
                id="width"
                type="number"
                value={pitchWidth}
                onChange={(e) => setPitchWidth(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
              <div key={corner} className="space-y-2">
                <Label>{corner.toUpperCase()} Corner</Label>
                <Button
                  onClick={() => captureCorner(corner)}
                  disabled={capturing !== null}
                  variant={corners[corner].lat ? 'default' : 'outline'}
                  className="w-full"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  {capturing === corner
                    ? 'Capturing...'
                    : corners[corner].lat
                    ? `${corners[corner].lat?.toFixed(6)}, ${corners[corner].lon?.toFixed(6)}`
                    : 'Capture Location'}
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={saveCalibration} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save Calibration
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Saved Calibrations</h3>
        <div className="space-y-2">
          {savedCalibrations.map((cal) => (
            <div
              key={cal.id}
              className="flex items-center justify-between p-3 border rounded"
            >
              <div>
                <p className="font-semibold">{cal.name}</p>
                <p className="text-sm text-muted-foreground">
                  {cal.pitch_length}m × {cal.pitch_width}m
                  {cal.is_active && <span className="ml-2 text-primary">(Active)</span>}
                </p>
              </div>
              <div className="flex gap-2">
                {!cal.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveCalibration(cal.id)}
                  >
                    Set Active
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteCalibration(cal.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {savedCalibrations.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No calibrations saved yet
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PitchCalibrationSetup;
