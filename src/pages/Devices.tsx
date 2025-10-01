import { Link } from 'react-router-dom';
import DeviceManagement from '@/components/Devices/DeviceManagement';
import { Button } from "@/components/ui/button";
import { Settings, MapPin } from 'lucide-react';

const Devices = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Device Management</h1>
          <div className="flex gap-4">
            <Link to="/pitch-calibration">
              <Button variant="outline">
                <MapPin className="mr-2 h-4 w-4" />
                Pitch Calibration
              </Button>
            </Link>
            <Link to="/analysis">
              <Button variant="outline">
                Back to Analysis
              </Button>
            </Link>
          </div>
        </div>
        
        <DeviceManagement />
      </div>
    </div>
  );
};

export default Devices;
