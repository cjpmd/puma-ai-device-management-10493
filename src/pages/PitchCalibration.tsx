import PitchCalibrationSetup from '@/components/PitchCalibration/PitchCalibrationSetup';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PitchCalibration = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/devices">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Devices
            </Button>
          </Link>
        </div>
        
        <div className="mb-6">
          <h1 className="text-4xl font-bold">GPS Pitch Calibration</h1>
          <p className="text-muted-foreground mt-2">
            Calibrate your pitch by capturing GPS coordinates at each corner. This allows accurate
            player positioning and movement tracking.
          </p>
        </div>

        <PitchCalibrationSetup />
      </div>
    </div>
  );
};

export default PitchCalibration;
