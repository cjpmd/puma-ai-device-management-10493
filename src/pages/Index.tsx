
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, BarChart, Video } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center mb-12 text-center">
          <img 
            src="/lovable-uploads/bf92a61b-cacd-463a-a597-0deee3ade844.png" 
            alt="Puma-AI Logo" 
            className="h-28 mb-4"
          />
          <h1 className="text-4xl font-bold text-emerald-700 mb-2">Puma-AI</h1>
          <h2 className="text-2xl font-medium text-emerald-600 mb-4">Performance Management</h2>
          <p className="text-gray-600 max-w-2xl">
            Advanced analytics and performance tracking for elite athletes. Monitor real-time metrics, 
            analyze performance data, and optimize training with AI-driven insights.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Link to="/matches">
            <Card className="hover:shadow-lg transition-shadow border-emerald-100">
              <CardHeader className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-6 w-6" />
                  Match Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  Upload dual-camera match footage, trigger AI processing, 
                  and view final follow-cam videos and highlights.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/ml-training">
            <Card className="hover:shadow-lg transition-shadow border-emerald-100">
              <CardHeader className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-6 w-6" />
                  Machine Learning Training
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  Upload and manage training data, monitor model performance, and train the ML model
                  for activity recognition.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/analysis">
            <Card className="hover:shadow-lg transition-shadow border-emerald-100">
              <CardHeader className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-6 w-6" />
                  Performance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  View real-time metrics, performance charts, and movement analysis from sensor data.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
        
        <div className="mt-12 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Puma-AI | Powering the future of sports analytics
        </div>
      </div>
    </div>
  );
};

export default Index;
