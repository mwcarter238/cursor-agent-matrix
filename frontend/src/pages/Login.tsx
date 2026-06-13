import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import type { User } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import "./Login.css";

const PIN_LENGTH = 4;

export function Login() {
  const { login } = useAuth();
  const [operators, setOperators] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listOperators().then(setOperators).catch(() => setOperators([]));
  }, []);

  async function submit(code: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await login(selected.username, code);
    } catch {
      setError("Incorrect PIN. Try again.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  function press(digit: string) {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === PIN_LENGTH) void submit(next);
  }

  return (
    <div className="screen login app-bg">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M12 2 4 6v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-4Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className="brand-name">Stockwell</h1>
          <p className="eyebrow">Pharmacy Inventory</p>
        </div>
      </div>

      {!selected ? (
        <div className="stack" style={{ marginTop: 28 }}>
          <p className="subtitle">Select your profile to sign in.</p>
          <div className="roster">
            {operators.map((op) => (
              <motion.button
                key={op.id}
                className="roster-item card"
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(op)}
              >
                <span className="avatar">{initials(op.name)}</span>
                <span className="roster-meta">
                  <span className="roster-name">{op.name}</span>
                  <span className="muted roster-role">{op.role}</span>
                </span>
                <span className="chevron">›</span>
              </motion.button>
            ))}
            {operators.length === 0 && (
              <p className="muted">No operators available. Is the API running?</p>
            )}
          </div>
        </div>
      ) : (
        <motion.div
          className="stack pinpad-wrap"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button className="back-link" onClick={() => { setSelected(null); setPin(""); setError(null); }}>
            ‹ Back
          </button>
          <div className="pin-head">
            <span className="avatar avatar-lg">{initials(selected.name)}</span>
            <h2 className="title" style={{ fontSize: 22 }}>{selected.name}</h2>
            <p className="muted">Enter your {PIN_LENGTH}-digit PIN</p>
          </div>

          <div className={`pin-dots ${error ? "shake" : ""}`}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span key={i} className={`dot ${i < pin.length ? "dot-filled" : ""}`} />
            ))}
          </div>

          <p className="pin-error">{error ?? " "}</p>

          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} className="key" onClick={() => press(d)}>{d}</button>
            ))}
            <span />
            <button className="key" onClick={() => press("0")}>0</button>
            <button
              className="key key-del"
              onClick={() => setPin((p) => p.slice(0, -1))}
              aria-label="Delete"
            >
              ⌫
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
