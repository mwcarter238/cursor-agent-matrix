import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "./auth/AuthContext";
import { BottomNav } from "./components/BottomNav";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Workflow } from "./pages/Workflow";
import { Inventory } from "./pages/Inventory";
import { History } from "./pages/History";

export function App() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <div className="shell app-bg" />;

  if (!user) {
    return (
      <div className="shell">
        <Login />
      </div>
    );
  }

  // Hide the bottom nav while a full-screen scan workflow is active.
  const inWorkflow = location.pathname.startsWith("/scan/");

  return (
    <div className="shell">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/scan/:mode" element={<Workflow />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      {!inWorkflow && <BottomNav />}
    </div>
  );
}
