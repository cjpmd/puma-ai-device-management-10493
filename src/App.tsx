import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { OrgTypeProvider } from "@/contexts/OrgTypeContext";
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

      {/* iOS shell routes (existing — untouched) */}
      <Route path="/" element={<PrivateRoute><IOSApp /></PrivateRoute>} />
      <Route path="/legacy" element={<PrivateRoute><Index /></PrivateRoute>} />
      <Route path="/my-recordings" element={<PrivateRoute><MyRecordings /></PrivateRoute>} />
      <Route path="/scan-qr" element={<PrivateRoute><ScanQR /></PrivateRoute>} />

      {/* Video routes — existing, preserved exactly */}
      <Route path="/ml-training"      element={<PrivateRoute><MobileNavShell><MLTraining /></MobileNavShell></PrivateRoute>} />
      <Route path="/analysis"         element={<PrivateRoute><MobileNavShell><Analysis /></MobileNavShell></PrivateRoute>} />
      <Route path="/devices"          element={<PrivateRoute><MobileNavShell><Devices /></MobileNavShell></PrivateRoute>} />
      <Route path="/pitch-calibration" element={<PrivateRoute><MobileNavShell><PitchCalibration /></MobileNavShell></PrivateRoute>} />
      <Route path="/matches"          element={<PrivateRoute><MobileNavShell><Matches /></MobileNavShell></PrivateRoute>} />
      <Route path="/matches/demo"     element={<PrivateRoute><MobileNavShell><DemoMatch /></MobileNavShell></PrivateRoute>} />
      <Route path="/matches/:id"      element={<PrivateRoute><MobileNavShell><MatchDetail /></MobileNavShell></PrivateRoute>} />

      {/* Web dashboard shell — org-type-aware sidebar + top bar */}
      <Route path="/dashboard" element={
        <PrivateRoute>
          <AppShell><Dashboard /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/players" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Players" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/players/:id" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Player Profile" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/squads" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Squads" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/development" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Development" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/medical" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Medical" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/welfare" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Welfare" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/scouting" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Scouting" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/coaching" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Coaching" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/compliance" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Compliance" /></AppShell>
        </PrivateRoute>
      } />
      <Route path="/settings" element={
        <PrivateRoute>
          <AppShell><PlaceholderPage module="Settings" /></AppShell>
        </PrivateRoute>
      } />

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
        <OrgTypeProvider>
          <AppRoutes />
        </OrgTypeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
