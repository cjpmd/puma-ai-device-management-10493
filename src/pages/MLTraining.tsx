import { useState } from 'react';
import { Link } from 'react-router-dom';
import MLTrainingManager from "@/components/MLTrainingManager";
import PhysicalDataForm from "@/components/PhysicalDataForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Database, BrainCircuit } from "lucide-react";
import VideoAnalysisTab from "@/components/VideoAnalysis/VideoAnalysisTab";

interface TrainingStats {
  totalExamples: {
    pass: number;
    shot: number;
    dribble: number;
    touch: number;
    no_possession: number;
  };
  currentAccuracy: number;
  epochsCompleted: number;
  lastTrainingTime: string | null;
}

const MLTraining = () => {
  const [showPhysicalForm, setShowPhysicalForm] = useState(true);
  const [trainingStats, setTrainingStats] = useState<TrainingStats>({
    totalExamples: {
      pass: 0,
      shot: 0,
      dribble: 0,
      touch: 0,
      no_possession: 0
    },
    currentAccuracy: 0,
    epochsCompleted: 0,
    lastTrainingTime: null
  });

  return (
    <div className="min-h-screen wallpaper-dawn p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Machine Learning Training</h1>
          <Link to="/analysis" className="text-primary hover:underline">
            Go to Analysis Dashboard
          </Link>
        </div>

        {showPhysicalForm ? (
          <PhysicalDataForm onComplete={() => setShowPhysicalForm(false)} />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Training Data Collection
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(trainingStats.totalExamples).map(([activity, count]) => (
                      <div key={activity} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{activity.replace('_', ' ')}</span>
                          <span>{count}/100 examples</span>
                        </div>
                        <Progress value={(count / 100) * 100} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Model Performance
                  </CardTitle>
                  <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Current Accuracy</span>
                        <span>{trainingStats.currentAccuracy.toFixed(1)}%</span>
                      </div>
                      <Progress value={trainingStats.currentAccuracy} />
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Epochs Completed</span>
                        <span>{trainingStats.epochsCompleted}/50</span>
                      </div>
                      {trainingStats.lastTrainingTime && (
                        <div className="flex justify-between">
                          <span>Last Training</span>
                          <span>{trainingStats.lastTrainingTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              <MLTrainingManager 
                onTrainingProgress={(stats: TrainingStats) => setTrainingStats(stats)} 
              />
              <VideoAnalysisTab />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MLTraining;