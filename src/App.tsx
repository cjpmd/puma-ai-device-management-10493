
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IOSApp } from "./pages/ios/IOSApp";
import { MobileNavShell } from "@/components/ios/MobileNavShell";
import Index from "./pages/Index";
import MLTraining from "./pages/MLTraining";
import Analysis from "./pages/Analysis";
import Devices from "./pages/Devices";
import PitchCalibration from "./pages/PitchCalibration";
import Matches from "./pages/Matches";
import MatchDetail from "./pages/MatchDetail";
import DemoMatch from "./pages/DemoMatch";
import CameraCapture from "./pages/CameraCapture";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/capture/:token" element={<CameraCapture />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <IOSApp />
              </PrivateRoute>
            }
          />
          <Route
            path="/legacy"
            element={
              <PrivateRoute>
                <Index />
              </PrivateRoute>
            }
          />
          <Route
            path="/ml-training"
            element={
              <PrivateRoute>
                <MobileNavShell><MLTraining /></MobileNavShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/analysis"
            element={
              <PrivateRoute>
                <MobileNavShell><Analysis /></MobileNavShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/devices"
            element={
              <PrivateRoute>
                <MobileNavShell><Devices /></MobileNavShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/pitch-calibration"
            element={
              <PrivateRoute>
                <MobileNavShell><PitchCalibration /></MobileNavShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/matches"
            element={
              <PrivateRoute>
                <MobileNavShell><Matches /></MobileNavShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/matches/demo"
            element={
              <PrivateRoute>
                <MobileNavShell><DemoMatch /></MobileNavShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/matches/:id"
            element={
              <PrivateRoute>
                <MobileNavShell><MatchDetail /></MobileNavShell>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
