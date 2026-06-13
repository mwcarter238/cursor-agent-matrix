import { NavLink } from "react-router-dom";
import "./BottomNav.css";

interface Tab {
  to: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { to: "/inventory", label: "Inventory", icon: "M4 7h16M4 12h16M4 17h16" },
  { to: "/history", label: "History", icon: "M12 8v4l3 2M21 12a9 9 0 1 1-9-9" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"}
          className={({ isActive }) => `nav-tab ${isActive ? "nav-active" : ""}`}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d={t.icon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
