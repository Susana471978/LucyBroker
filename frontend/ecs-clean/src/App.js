import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import AuthPage from "./pages/AuthPage";
import OverviewPage from "./pages/OverviewPage";
import MessagesPage from "./pages/MessagesPage";
import DashboardHome from "./pages/DashboardHome";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";

// Protected Route Component
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
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return children;
};

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-neural" />
        <div className="glass-premium rounded-2xl p-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }
  
  return children;
};


// AppLayout para rutas /app/*
const AppLayout = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const AppRoutes = () => {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/app/*"
        element={
          token ? <AppLayout /> : <Navigate to="/auth" replace />
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="messages" element={<MessagesPage />} />
      </Route>
      {/* Legacy redirect */}
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/messages" element={<Navigate to="/app/messages" replace />} />
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
