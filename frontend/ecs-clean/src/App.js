import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import MessagesPage from "./pages/MessagesPage";
import AppLayout from "./components/AppLayout";
import Landing from "./pages/LandingPage";


function App() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{padding:"40px",color:"white"}}>
        Cargando aplicación...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/app/*"
          element={
            token ? <AppLayout /> : <Navigate to="/auth" replace />
          }
        >
          <Route
            index
            element={
              <div style={{padding:"40px",color:"white"}}>
                Dashboard operativo
              </div>
            }
          />
          <Route path="messages" element={<MessagesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
