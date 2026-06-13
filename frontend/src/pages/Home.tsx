import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import { WORKFLOWS, WORKFLOW_ORDER } from "../workflow/config";
import "./Home.css";

export function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="screen home app-bg">
      <header className="home-head">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1 className="title">{user?.name?.split(" ")[0] ?? "Welcome"}</h1>
        </div>
        <button className="signout" onClick={logout} aria-label="Sign out">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M15 12H4m0 0 4-4m-4 4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      <p className="subtitle home-prompt">What would you like to do?</p>

      <div className="workflow-grid">
        {WORKFLOW_ORDER.map((mode, i) => {
          const w = WORKFLOWS[mode];
          return (
            <motion.button
              key={mode}
              className="workflow-card card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/scan/${mode}`)}
              style={{ ["--accent" as string]: w.accent }}
            >
              <span className="workflow-glyph">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                  <path d={w.glyph} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="workflow-text">
                <span className="workflow-title">{w.title}</span>
                <span className="workflow-blurb muted">{w.blurb}</span>
              </span>
              <span className="workflow-arrow">›</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
