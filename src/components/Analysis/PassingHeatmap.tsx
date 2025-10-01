import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface Pass {
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  is_successful: boolean;
}

interface PassingHeatmapProps {
  videoId?: string;
}

const PassingHeatmap = ({ videoId }: PassingHeatmapProps) => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [totalPasses, setTotalPasses] = useState(0);
  const [successRate, setSuccessRate] = useState(0);

  useEffect(() => {
    if (!videoId) return;

    const fetchPasses = async () => {
      const { data, error } = await supabase
        .from('pass_analysis')
        .select('start_x, start_y, end_x, end_y, is_successful')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching passes:', error);
        return;
      }

      setPasses((data || []) as Pass[]);
      setTotalPasses(data?.length || 0);
      const successfulPasses = (data || []).filter(pass => pass.is_successful).length;
      setSuccessRate((data && data.length > 0) ? (successfulPasses / data.length) * 100 : 0);
    };

    fetchPasses();
  }, [videoId]);

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          Passing Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-[2/1] bg-green-100 rounded-lg overflow-hidden">
          {/* Soccer field markings */}
          <div className="absolute inset-0 border-2 border-green-600" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-600" />
          
          {/* Plot passes */}
          {passes.map((pass, index) => (
            <svg
              key={index}
              className="absolute inset-0"
              style={{ overflow: 'visible' }}
            >
              <line
                x1={`${pass.start_x * 100}%`}
                y1={`${pass.start_y * 100}%`}
                x2={`${pass.end_x * 100}%`}
                y2={`${pass.end_y * 100}%`}
                stroke={pass.is_successful ? '#4CAF50' : '#FF5252'}
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </svg>
          ))}
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{totalPasses}</div>
            <div className="text-sm text-muted-foreground">Total Passes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PassingHeatmap;