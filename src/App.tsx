import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { OrgTypeProvider } from "@/contexts/OrgTypeContext";
import { ActiveContextProvider } from "@/contexts/ActiveContextContext";
import { AppShell } from "@/components/layout/AppShell";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";
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
import ScanQR from "./pages/ScanQR";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MyRecordings from "./pages/MyRecordings";
import SharedVideo from "./pages/SharedVideo";
import Dashboard from "./pages/Dashboard";
import Players from "./pages/Players";
import PlayerProfile from "./pages/PlayerProfile";
import Medical from "./pages/Medical";
import Welfare from "./pages/Welfare";
import Scouting from "./pages/Scouting";
import Compliance from "./pages/Compliance";
import Settings from "./pages/Settings";
import LogRPE from "./pages/LogRPE";
import FitnessTesting from "./pages/FitnessTesting";
import TravelEvents from "./pages/TravelEvents";
import TravelEventDetail from "./pages/TravelEventDetail";

const queryClient = new QueryClient();

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading…</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  useDeepLinkHandler();
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/capture/:token" element={<CameraCapture />} />
      <Route path="/share/:token" element={<SharedVideo />} />
      <Route path="/log-rpe/:token" element={<LogRPE />} />

      {/* iOS shell routes */}
      <Route path="/" element={<PrivateRoute><IOSApp /></PrivateRoute>} />
      <Route path="/legacy" element={<PrivateRoute><Index /></PrivateRoute>} />
      <Route path="/my-recordings" element={<PrivateRoute><MyRecordings /></PrivateRoute>} />
      <Route path="/scan-qr" element={<PrivateRoute><ScanQR /></PrivateRoute>} />

      {/* Video routes */}
      <Route path="/ml-training"       element={<PrivateRoute><MobileNavShell><MLTraining /></MobileNavShell></PrivateRoute>} />
      <Route path="/analysis"          element={<PrivateRoute><MobileNavShell><Analysis /></MobileNavShell></PrivateRoute>} />
      <Route path="/devices"           element={<PrivateRoute><MobileNavShell><Devices /></MobileNavShell></PrivateRoute>} />
      <Route path="/pitch-calibration" element={<PrivateRoute><MobileNavShell><PitchCalibration /></MobileNavShell></PrivateRoute>} />
      <Route path="/matches"           element={<PrivateRoute><MobileNavShell><Matches /></MobileNavShell></PrivateRoute>} />
      <Route path="/matches/demo"      element={<PrivateRoute><MobileNavShell><DemoMatch /></MobileNavShell></PrivateRoute>} />
      <Route path="/matches/:id"       element={<PrivateRoute><MobileNavShell><MatchDetail /></MobileNavShell></PrivateRoute>} />

      {/* Web dashboard */}
      <Route path="/dashboard"       element={<PrivateRoute><AppShell><Dashboard /></AppShell></PrivateRoute>} />
      <Route path="/players"         element={<PrivateRoute><AppShell><Players /></AppShell></PrivateRoute>} />
      <Route path="/players/:id"     element={<PrivateRoute><AppShell><PlayerProfile /></AppShell></PrivateRoute>} />
      <Route path="/squads"          element={<PrivateRoute><AppShell><PlaceholderPage module="Squads" /></AppShell></PrivateRoute>} />
      <Route path="/development"     element={<PrivateRoute><AppShell><PlaceholderPage module="Development" /></AppShell></PrivateRoute>} />
      <Route path="/medical"         element={<PrivateRoute><AppShell><Medical /></AppShell></PrivateRoute>} />
      <Route path="/welfare"         element={<PrivateRoute><AppShell><Welfare /></AppShell></PrivateRoute>} />
      <Route path="/scouting"        element={<PrivateRoute><AppShell><Scouting /></AppShell></PrivateRoute>} />
      <Route path="/fitness-testing" element={<PrivateRoute><AppShell><FitnessTesting /></AppShell></PrivateRoute>} />
      <Route path="/coaching"        element={<PrivateRoute><AppShell><PlaceholderPage module="Coaching" /></AppShell></PrivateRoute>} />
      <Route path="/compliance"      element={<PrivateRoute><AppShell><Compliance /></AppShell></PrivateRoute>} />
      <Route path="/travel"          element={<PrivateRoute><AppShell><TravelEvents /></AppShell></PrivateRoute>} />
      <Route path="/travel/:id"      element={<PrivateRoute><AppShell><TravelEventDetail /></AppShell></PrivateRoute>} />
      <Route path="/settings"        element={<PrivateRoute><AppShell><Settings /></AppShell></PrivateRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ActiveContextProvider>
          <OrgTypeProvider>
            <AppRoutes />
          </OrgTypeProvider>
        </ActiveContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
