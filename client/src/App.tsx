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

// Auth pages
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Onboarding pages
import BuilderSetup from "./pages/onboarding/BuilderSetup";

// App pages
import Dashboard from "./pages/Dashboard";
import JobDetails from "./pages/JobDetails";
import Jobs from "./pages/Jobs";
import Invoices from "./pages/Invoices";
import PurchaseOrders from "./pages/PurchaseOrders";
import Draws from "./pages/Draws";
import Budget from "./pages/Budget";
import Profitability from "./pages/Profitability";
import WIPSchedule from "./pages/WIPSchedule";
import Leads from "./pages/Leads";
import Vendors from "./pages/Vendors";
import Employees from "./pages/Employees";
import Schedule from "./pages/Schedule";
import DailyLogs from "./pages/DailyLogs";
import Expenses from "./pages/Expenses";
import PnLDashboard from "./pages/PnLDashboard";
import CashFlow from "./pages/CashFlow";
import BusinessPlanning from "./pages/BusinessPlanning";
import Estimates from "./pages/Estimates";
import Bids from "./pages/Bids";
import Selections from "./pages/Selections";
import Proposals from "./pages/Proposals";
import Contracts from "./pages/Contracts";
import Tasks from "./pages/Tasks";
import Files from "./pages/Files";
import ChangeOrders from "./pages/ChangeOrders";
import RFIs from "./pages/RFIs";
import Submittals from "./pages/Submittals";
import Inspections from "./pages/Inspections";
import Photos from "./pages/Photos";
import PunchLists from "./pages/PunchLists";
import Warranties from "./pages/Warranties";
import LienReleases from "./pages/LienReleases";
import FinalDocs from "./pages/FinalDocs";
import CostCodes from "./pages/CostCodes";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Permits from "./pages/Permits";
import Pricing from "./pages/Pricing";
import Plans from "./pages/Plans";
import Clients from "./pages/Clients";
import TimeTracking from "./pages/TimeTracking";
import NotFound from "./pages/NotFound";

// Portal pages
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalPhotos from "./pages/portal/PortalPhotos";
import PortalMessages from "./pages/portal/PortalMessages";

const queryClient = new QueryClient();

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

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
  <AuthProvider>
  <UserProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
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

          {/* Protected routes - require authentication */}
          {/* Overview */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
          <Route path="/job-details" element={<ProtectedRoute><JobDetails /></ProtectedRoute>} />

          {/* Sales */}
          <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />

          {/* Pre-Con */}
          <Route path="/estimates" element={<ProtectedRoute><Estimates /></ProtectedRoute>} />
          <Route path="/bids" element={<ProtectedRoute><Bids /></ProtectedRoute>} />
          <Route path="/selections" element={<ProtectedRoute><Selections /></ProtectedRoute>} />
          <Route path="/proposals" element={<ProtectedRoute><Proposals /></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="/permits" element={<ProtectedRoute><Permits /></ProtectedRoute>} />

          {/* Operations */}
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/daily-logs" element={<ProtectedRoute><DailyLogs /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/files" element={<ProtectedRoute><Files /></ProtectedRoute>} />
          <Route path="/change-orders" element={<ProtectedRoute><ChangeOrders /></ProtectedRoute>} />
          <Route path="/rfis" element={<ProtectedRoute><RFIs /></ProtectedRoute>} />
          <Route path="/submittals" element={<ProtectedRoute><Submittals /></ProtectedRoute>} />
          <Route path="/inspections" element={<ProtectedRoute><Inspections /></ProtectedRoute>} />
          <Route path="/photos" element={<ProtectedRoute><Photos /></ProtectedRoute>} />
          <Route path="/time-tracking" element={<ProtectedRoute><TimeTracking /></ProtectedRoute>} />

          {/* Financial */}
          <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
          <Route path="/draws" element={<ProtectedRoute><Draws /></ProtectedRoute>} />
          <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
          <Route path="/pnl" element={<ProtectedRoute><PnLDashboard /></ProtectedRoute>} />
          <Route path="/profitability" element={<ProtectedRoute><Profitability /></ProtectedRoute>} />
          <Route path="/wip" element={<ProtectedRoute><WIPSchedule /></ProtectedRoute>} />
          <Route path="/cash-flow" element={<ProtectedRoute><CashFlow /></ProtectedRoute>} />
          <Route path="/business-planning" element={<ProtectedRoute><BusinessPlanning /></ProtectedRoute>} />

          {/* Closeout */}
          <Route path="/punch-lists" element={<ProtectedRoute><PunchLists /></ProtectedRoute>} />
          <Route path="/warranties" element={<ProtectedRoute><Warranties /></ProtectedRoute>} />
          <Route path="/lien-releases" element={<ProtectedRoute><LienReleases /></ProtectedRoute>} />
          <Route path="/final-docs" element={<ProtectedRoute><FinalDocs /></ProtectedRoute>} />

          {/* Reports */}
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

          {/* Settings */}
          <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/cost-codes" element={<ProtectedRoute><CostCodes /></ProtectedRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />

          {/* Client Portal routes - public for clients */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal/dashboard" element={<PortalDashboard />} />
          <Route path="/portal/photos" element={<PortalPhotos />} />
          <Route path="/portal/messages" element={<PortalMessages />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </UserProvider>
  </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
