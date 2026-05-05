import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  time: string;
  value: number;
}

interface PerformanceChartProps {
  title: string;
  data: DataPoint[];
  dataKey: string;
  color: string;
}

const PerformanceChart = ({ title, data, dataKey, color }: PerformanceChartProps) => {
  return (
    <Card className="bg-white border border-slate-200 border border-slate-200 backdrop-blur-md text-slate-900 shadow-none">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
              <Tooltip
                contentStyle={{
                  background: 'rgba(20,20,30,0.92)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  color: '#fff',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;
