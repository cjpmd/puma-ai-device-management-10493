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
    <Card className="bg-white border border-slate-200 border border-slate-200 backdrop-blur-md text-slate-900 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        {icon && <div className="text-slate-700">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">
          {value}
          {unit && <span className="ml-1 text-sm text-slate-600">{unit}</span>}
        </div>
        {subtitle && <div className="text-sm text-slate-600 mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
};

export default MetricCard;
