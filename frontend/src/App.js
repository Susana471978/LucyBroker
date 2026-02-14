import "./App.css";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import AuthPage from "./pages/AuthPage";
import OverviewPage from "./pages/OverviewPage";
import MessagesPage from "./pages/MessagesPage";
import LandingPage from "./pages/LandingPage";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route path="/app" element={<OverviewPage />} />
      <Route path="/app/messages" element={<MessagesPage />} />

      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/messages" element={<Navigate to="/app/messages" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <AppRoutes />
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
