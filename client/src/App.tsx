import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { JobProvider } from "@/contexts/JobContext";
import { UserProvider } from "@/contexts/UserContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard, PublicOnlyGuard } from "@/components/auth/AuthGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { Loader2 } from 'lucide-react';

// Loading component for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Auth pages - kept static for fast initial load
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Onboarding - kept static
import BuilderSetup from "./pages/onboarding/BuilderSetup";

// Dashboard - kept static as primary landing page
import Dashboard from "./pages/Dashboard";

// ============================================================
// LAZY LOADED PAGES - Code splitting for better performance
// ============================================================

// Core Operations - frequently used
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetails = lazy(() => import("./pages/JobDetails"));
const Invoices = lazy(() => import("./pages/Invoices"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const Draws = lazy(() => import("./pages/Draws"));
const Budget = lazy(() => import("./pages/Budget"));

// Sales & Pre-Con
const Leads = lazy(() => import("./pages/Leads"));
const Estimates = lazy(() => import("./pages/Estimates"));
const Bids = lazy(() => import("./pages/Bids"));
const Selections = lazy(() => import("./pages/Selections"));
const Proposals = lazy(() => import("./pages/Proposals"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Permits = lazy(() => import("./pages/Permits"));

// Operations
const Schedule = lazy(() => import("./pages/Schedule"));
const DailyLogs = lazy(() => import("./pages/DailyLogs"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Files = lazy(() => import("./pages/Files"));
const ChangeOrders = lazy(() => import("./pages/ChangeOrders"));
const RFIs = lazy(() => import("./pages/RFIs"));
const Submittals = lazy(() => import("./pages/Submittals"));
const Inspections = lazy(() => import("./pages/Inspections"));
const Photos = lazy(() => import("./pages/Photos"));
const TimeTracking = lazy(() => import("./pages/TimeTracking"));

// Financial
const Profitability = lazy(() => import("./pages/Profitability"));
const WIPSchedule = lazy(() => import("./pages/WIPSchedule"));
const PnLDashboard = lazy(() => import("./pages/PnLDashboard"));
const CashFlow = lazy(() => import("./pages/CashFlow"));
const BusinessPlanning = lazy(() => import("./pages/BusinessPlanning"));
const Expenses = lazy(() => import("./pages/Expenses"));

// Closeout
const PunchLists = lazy(() => import("./pages/PunchLists"));
const Warranties = lazy(() => import("./pages/Warranties"));
const LienReleases = lazy(() => import("./pages/LienReleases"));
const FinalDocs = lazy(() => import("./pages/FinalDocs"));

// Settings & Administration
const Vendors = lazy(() => import("./pages/Vendors"));
const Employees = lazy(() => import("./pages/Employees"));
const CostCodes = lazy(() => import("./pages/CostCodes"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Plans = lazy(() => import("./pages/Plans"));
const Clients = lazy(() => import("./pages/Clients"));

// Portal pages
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalPhotos = lazy(() => import("./pages/portal/PortalPhotos"));
const PortalMessages = lazy(() => import("./pages/portal/PortalMessages"));

// Error pages
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Wrapper component for protected routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <JobProvider>
        {children}
      </JobProvider>
    </AuthGuard>
  );
}

// Lazy route wrapper with suspense
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
}

// Protected + Lazy wrapper
function ProtectedLazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ProtectedRoute>
  );
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
  <AuthProvider>
  <RealtimeProvider>
  <UserProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <BrowserRouter>
        <Routes>
          {/* Public auth routes - not lazy loaded for fast auth */}
          <Route path="/login" element={
            <PublicOnlyGuard>
              <Login />
            </PublicOnlyGuard>
          } />
          <Route path="/signup" element={
            <PublicOnlyGuard>
              <Signup />
            </PublicOnlyGuard>
          } />
          <Route path="/forgot-password" element={
            <PublicOnlyGuard>
              <ForgotPassword />
            </PublicOnlyGuard>
          } />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Onboarding - protected but no job context needed */}
          <Route path="/onboarding" element={<AuthGuard><BuilderSetup /></AuthGuard>} />

          {/* Dashboard - not lazy loaded as primary landing page */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Core Operations - Protected & Lazy Loaded */}
          <Route path="/jobs" element={<ProtectedLazyRoute><Jobs /></ProtectedLazyRoute>} />
          <Route path="/job-details" element={<ProtectedLazyRoute><JobDetails /></ProtectedLazyRoute>} />

          {/* Sales */}
          <Route path="/leads" element={<ProtectedLazyRoute><Leads /></ProtectedLazyRoute>} />

          {/* Pre-Con */}
          <Route path="/estimates" element={<ProtectedLazyRoute><Estimates /></ProtectedLazyRoute>} />
          <Route path="/bids" element={<ProtectedLazyRoute><Bids /></ProtectedLazyRoute>} />
          <Route path="/selections" element={<ProtectedLazyRoute><Selections /></ProtectedLazyRoute>} />
          <Route path="/proposals" element={<ProtectedLazyRoute><Proposals /></ProtectedLazyRoute>} />
          <Route path="/contracts" element={<ProtectedLazyRoute><Contracts /></ProtectedLazyRoute>} />
          <Route path="/permits" element={<ProtectedLazyRoute><Permits /></ProtectedLazyRoute>} />

          {/* Operations */}
          <Route path="/schedule" element={<ProtectedLazyRoute><Schedule /></ProtectedLazyRoute>} />
          <Route path="/daily-logs" element={<ProtectedLazyRoute><DailyLogs /></ProtectedLazyRoute>} />
          <Route path="/tasks" element={<ProtectedLazyRoute><Tasks /></ProtectedLazyRoute>} />
          <Route path="/files" element={<ProtectedLazyRoute><Files /></ProtectedLazyRoute>} />
          <Route path="/change-orders" element={<ProtectedLazyRoute><ChangeOrders /></ProtectedLazyRoute>} />
          <Route path="/rfis" element={<ProtectedLazyRoute><RFIs /></ProtectedLazyRoute>} />
          <Route path="/submittals" element={<ProtectedLazyRoute><Submittals /></ProtectedLazyRoute>} />
          <Route path="/inspections" element={<ProtectedLazyRoute><Inspections /></ProtectedLazyRoute>} />
          <Route path="/photos" element={<ProtectedLazyRoute><Photos /></ProtectedLazyRoute>} />
          <Route path="/time-tracking" element={<ProtectedLazyRoute><TimeTracking /></ProtectedLazyRoute>} />

          {/* Financial */}
          <Route path="/invoices" element={<ProtectedLazyRoute><Invoices /></ProtectedLazyRoute>} />
          <Route path="/purchase-orders" element={<ProtectedLazyRoute><PurchaseOrders /></ProtectedLazyRoute>} />
          <Route path="/draws" element={<ProtectedLazyRoute><Draws /></ProtectedLazyRoute>} />
          <Route path="/budget" element={<ProtectedLazyRoute><Budget /></ProtectedLazyRoute>} />
          <Route path="/pnl" element={<ProtectedLazyRoute><PnLDashboard /></ProtectedLazyRoute>} />
          <Route path="/profitability" element={<ProtectedLazyRoute><Profitability /></ProtectedLazyRoute>} />
          <Route path="/wip" element={<ProtectedLazyRoute><WIPSchedule /></ProtectedLazyRoute>} />
          <Route path="/cash-flow" element={<ProtectedLazyRoute><CashFlow /></ProtectedLazyRoute>} />
          <Route path="/business-planning" element={<ProtectedLazyRoute><BusinessPlanning /></ProtectedLazyRoute>} />

          {/* Closeout */}
          <Route path="/punch-lists" element={<ProtectedLazyRoute><PunchLists /></ProtectedLazyRoute>} />
          <Route path="/warranties" element={<ProtectedLazyRoute><Warranties /></ProtectedLazyRoute>} />
          <Route path="/lien-releases" element={<ProtectedLazyRoute><LienReleases /></ProtectedLazyRoute>} />
          <Route path="/final-docs" element={<ProtectedLazyRoute><FinalDocs /></ProtectedLazyRoute>} />

          {/* Reports */}
          <Route path="/reports" element={<ProtectedLazyRoute><Reports /></ProtectedLazyRoute>} />

          {/* Settings */}
          <Route path="/vendors" element={<ProtectedLazyRoute><Vendors /></ProtectedLazyRoute>} />
          <Route path="/employees" element={<ProtectedLazyRoute><Employees /></ProtectedLazyRoute>} />
          <Route path="/expenses" element={<ProtectedLazyRoute><Expenses /></ProtectedLazyRoute>} />
          <Route path="/cost-codes" element={<ProtectedLazyRoute><CostCodes /></ProtectedLazyRoute>} />
          <Route path="/pricing" element={<ProtectedLazyRoute><Pricing /></ProtectedLazyRoute>} />
          <Route path="/plans" element={<ProtectedLazyRoute><Plans /></ProtectedLazyRoute>} />
          <Route path="/settings" element={<ProtectedLazyRoute><Settings /></ProtectedLazyRoute>} />
          <Route path="/clients" element={<ProtectedLazyRoute><Clients /></ProtectedLazyRoute>} />

          {/* Client Portal routes - lazy loaded */}
          <Route path="/portal/login" element={<LazyRoute><PortalLogin /></LazyRoute>} />
          <Route path="/portal/dashboard" element={<LazyRoute><PortalDashboard /></LazyRoute>} />
          <Route path="/portal/photos" element={<LazyRoute><PortalPhotos /></LazyRoute>} />
          <Route path="/portal/messages" element={<LazyRoute><PortalMessages /></LazyRoute>} />

          <Route path="*" element={<LazyRoute><NotFound /></LazyRoute>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </UserProvider>
  </RealtimeProvider>
  </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
