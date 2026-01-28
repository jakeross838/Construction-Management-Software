import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { JobProvider } from "@/contexts/JobContext";
import Dashboard from "./pages/Dashboard";
import JobDetails from "./pages/JobDetails";
import Jobs from "./pages/Jobs";
import Invoices from "./pages/Invoices";
import PurchaseOrders from "./pages/PurchaseOrders";
import Draws from "./pages/Draws";
import Budget from "./pages/Budget";
import Profitability from "./pages/Profitability";
import Leads from "./pages/Leads";
import Vendors from "./pages/Vendors";
import Employees from "./pages/Employees";
import Schedule from "./pages/Schedule";
import DailyLogs from "./pages/DailyLogs";
import Expenses from "./pages/Expenses";
import PnLDashboard from "./pages/PnLDashboard";
import Estimates from "./pages/Estimates";
import Bids from "./pages/Bids";
import Selections from "./pages/Selections";
import Proposals from "./pages/Proposals";
import Contracts from "./pages/Contracts";
import Tasks from "./pages/Tasks";
import Files from "./pages/Files";
import ChangeOrders from "./pages/ChangeOrders";
import PunchLists from "./pages/PunchLists";
import Warranties from "./pages/Warranties";
import LienReleases from "./pages/LienReleases";
import FinalDocs from "./pages/FinalDocs";
import CostCodes from "./pages/CostCodes";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Permits from "./pages/Permits";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <JobProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Overview */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/job-details" element={<JobDetails />} />
          
          {/* Sales */}
          <Route path="/leads" element={<Leads />} />
          
          {/* Pre-Con */}
          <Route path="/estimates" element={<Estimates />} />
          <Route path="/bids" element={<Bids />} />
          <Route path="/selections" element={<Selections />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/permits" element={<Permits />} />
          
          {/* Operations */}
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/daily-logs" element={<DailyLogs />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/files" element={<Files />} />
          <Route path="/change-orders" element={<ChangeOrders />} />
          
          {/* Financial */}
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/draws" element={<Draws />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/pnl" element={<PnLDashboard />} />
          <Route path="/profitability" element={<Profitability />} />
          
          {/* Closeout */}
          <Route path="/punch-lists" element={<PunchLists />} />
          <Route path="/warranties" element={<Warranties />} />
          <Route path="/lien-releases" element={<LienReleases />} />
          <Route path="/final-docs" element={<FinalDocs />} />
          
          {/* Reports */}
          <Route path="/reports" element={<Reports />} />
          
          {/* Settings */}
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/cost-codes" element={<CostCodes />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/settings" element={<Settings />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </JobProvider>
);

export default App;
