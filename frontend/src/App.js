import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import AuthPage from "./pages/AuthPage";
import OverviewPage from "./pages/OverviewPage";
import MessagesPage from "./pages/MessagesPage";
import LandingPage from "./pages/LandingPage";
import VoiceProvider from "./voice/VoiceProvider";
import TasksPage from "./pages/TaskPage";
import SettingsPage from "./pages/SettingsPage";
import HabitsPage from "./pages/HabitsPage";
import PricingPage from "./pages/PricingPage";
import { BillingSuccessPage, BillingCancelPage } from "./pages/BillingResultPage";
import ContactsPage from "./pages/ContactsPage";
import BrokerDashboard from "./pages/BrokerDashboard";

const SmartLanding = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-neural" />
        <div className="glass-premium rounded-2xl p-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/broker" replace />;
  return <LandingPage />;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-neural" />
        <div className="glass-premium rounded-2xl p-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<SmartLanding />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/broker" element={<ProtectedRoute><BrokerDashboard /></ProtectedRoute>} />
      <Route path="/app" element={<ProtectedRoute><VoiceProvider><OverviewPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/messages" element={<ProtectedRoute><VoiceProvider><MessagesPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/tasks" element={<ProtectedRoute><VoiceProvider><TasksPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/settings" element={<ProtectedRoute><VoiceProvider><SettingsPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/habits" element={<ProtectedRoute><VoiceProvider><HabitsPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/pricing" element={<ProtectedRoute><VoiceProvider><PricingPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/contacts" element={<ProtectedRoute><VoiceProvider><ContactsPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/billing/success" element={<ProtectedRoute><VoiceProvider><BillingSuccessPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/app/billing/cancel" element={<ProtectedRoute><VoiceProvider><BillingCancelPage /></VoiceProvider></ProtectedRoute>} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/messages" element={<Navigate to="/app/messages" replace />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="bottom-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
