import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { OrgTypeProvider } from "@/contexts/OrgTypeContext";
import { ActiveContextProvider, useActiveContext } from "@/contexts/ActiveContextContext";
import { AppShell } from "@/components/layout/AppShell";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";
import { MobileNavShell } from "@/components/ios/MobileNavShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

// Lazy-load every route so a transform/load failure in one page module
// (e.g. a preview 502 on a leaf UI primitive) cannot blank the entire app.
const IOSApp = lazy(() => import("./pages/ios/IOSApp").then(m => ({ default: m.IOSApp })));
const Index = lazy(() => import("./pages/Index"));
const MLTraining = lazy(() => import("./pages/MLTraining"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Devices = lazy(() => import("./pages/Devices"));
const PitchCalibration = lazy(() => import("./pages/PitchCalibration"));
const Matches = lazy(() => import("./pages/Matches"));
const MatchDetail = lazy(() => import("./pages/MatchDetail"));
const DemoMatch = lazy(() => import("./pages/DemoMatch"));
const CameraCapture = lazy(() => import("./pages/CameraCapture"));
const ScanQR = lazy(() => import("./pages/ScanQR"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyRecordings = lazy(() => import("./pages/MyRecordings"));
const SharedVideo = lazy(() => import("./pages/SharedVideo"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Players = lazy(() => import("./pages/Players"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const Medical = lazy(() => import("./pages/Medical"));
const Welfare = lazy(() => import("./pages/Welfare"));
const Scouting = lazy(() => import("./pages/Scouting"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Settings = lazy(() => import("./pages/Settings"));
const LogRPE = lazy(() => import("./pages/LogRPE"));
const FitnessTesting = lazy(() => import("./pages/FitnessTesting"));
const TravelEvents = lazy(() => import("./pages/TravelEvents"));
const TravelEventDetail = lazy(() => import("./pages/TravelEventDetail"));
const Squads = lazy(() => import("./pages/Squads"));
const Development = lazy(() => import("./pages/Development"));
const Coaching = lazy(() => import("./pages/Coaching"));
const TestVideoAnalysis = lazy(() => import("./pages/TestVideoAnalysis"));

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

const TierRoute = ({
  kind,
  children,
}: {
  kind: 'academy' | 'club' | 'team';
  children: React.ReactNode;
}) => {
  const { activeContext, loading } = useActiveContext();
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading…</div>;
  if (!activeContext || activeContext.kind !== kind) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  useDeepLinkHandler();
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-400">Loading…</div>}>
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
      <Route path="/squads"          element={<PrivateRoute><TierRoute kind="academy"><AppShell><Squads /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/development"     element={<PrivateRoute><TierRoute kind="academy"><AppShell><Development /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/medical"         element={<PrivateRoute><AppShell><Medical /></AppShell></PrivateRoute>} />
      <Route path="/welfare"         element={<PrivateRoute><TierRoute kind="academy"><AppShell><Welfare /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/scouting"        element={<PrivateRoute><TierRoute kind="academy"><AppShell><Scouting /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/fitness-testing" element={<PrivateRoute><AppShell><FitnessTesting /></AppShell></PrivateRoute>} />
      <Route path="/coaching"        element={<PrivateRoute><TierRoute kind="academy"><AppShell><Coaching /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/compliance"      element={<PrivateRoute><TierRoute kind="academy"><AppShell><Compliance /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/travel"          element={<PrivateRoute><TierRoute kind="academy"><AppShell><TravelEvents /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/travel/:id"      element={<PrivateRoute><TierRoute kind="academy"><AppShell><TravelEventDetail /></AppShell></TierRoute></PrivateRoute>} />
      <Route path="/settings"        element={<PrivateRoute><AppShell><Settings /></AppShell></PrivateRoute>} />

      {/* Temporary test route — delete after testing */}
      <Route path="/test-video-analysis" element={<PrivateRoute><TestVideoAnalysis /></PrivateRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </RouteErrorBoundary>
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
