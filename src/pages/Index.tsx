import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, BarChart, Video } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen wallpaper-dawn p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center mb-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Origin Sports Performance</h1>
          <h2 className="text-2xl font-medium text-white/80 mb-4">Performance Management</h2>
          <p className="text-white/70 max-w-2xl">
            Advanced analytics and performance tracking for elite athletes. Monitor real-time metrics,
            analyze performance data, and optimize training with AI-driven insights.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Link to="/matches">
            <Card className="glass border-white/10 hover:bg-white/10 transition-colors h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Video className="h-6 w-6 text-primary" />
                  Match Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/70">
                  Set up dual-camera match-day capture, control recording from your master phone,
                  and review AI-processed footage and highlights.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/ml-training">
            <Card className="glass border-white/10 hover:bg-white/10 transition-colors h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BrainCircuit className="h-6 w-6 text-primary" />
                  Machine Learning Training
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/70">
                  Upload and manage training data, monitor model performance, and train the ML model
                  for activity recognition.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/analysis">
            <Card className="glass border-white/10 hover:bg-white/10 transition-colors h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BarChart className="h-6 w-6 text-primary" />
                  Performance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/70">
                  View real-time metrics, performance charts, and movement analysis from sensor data.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-12 text-center text-sm text-white/50">
          &copy; {new Date().getFullYear()} Origin Sports Performance | Powering the future of sports analytics
        </div>
      </div>
    </div>
  );
};

export default Index;
