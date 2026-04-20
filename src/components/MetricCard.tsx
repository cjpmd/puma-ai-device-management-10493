import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  icon?: React.ReactNode;
  subtitle?: string;
}

const MetricCard = ({ title, value, unit, icon, subtitle }: MetricCardProps) => {
  return (
    <Card className="bg-white/5 border border-white/10 backdrop-blur-md text-white shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-white/60">
          {title}
        </CardTitle>
        {icon && <div className="text-white/80">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">
          {value}
          {unit && <span className="ml-1 text-sm text-white/60">{unit}</span>}
        </div>
        {subtitle && <div className="text-sm text-white/60 mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
};

export default MetricCard;
