import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Transaction } from "../api/types";
import { WORKFLOWS } from "../workflow/config";
import "./Lists.css";

const TYPE_ACCENT: Record<Transaction["type"], string> = {
  Receive: WORKFLOWS.receive.accent,
  Dispense: WORKFLOWS.dispense.accent,
  CycleCount: WORKFLOWS["cycle-count"].accent,
};

const TYPE_LABEL: Record<Transaction["type"], string> = {
  Receive: "Received",
  Dispense: "Dispensed",
  CycleCount: "Counted",
};

export function History() {
  const [tx, setTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.transactions(100).then(setTx).finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen list-screen app-bg">
      <header className="list-head">
        <div>
          <p className="eyebrow">Activity</p>
          <h1 className="title">History</h1>
        </div>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {!loading && tx.length === 0 && <p className="muted empty">No activity yet.</p>}

      <div className="list">
        {tx.map((t) => (
          <div key={t.id} className="card tx-row">
            <span
              className="tx-dot"
              style={{ background: TYPE_ACCENT[t.type] }}
              aria-hidden
            />
            <div className="tx-body">
              <p className="tx-name">{t.productName ?? t.gtin}</p>
              <p className="muted tx-meta">
                {TYPE_LABEL[t.type]} · {t.userName} · {timeAgo(t.createdAt)}
                {t.lot ? ` · lot ${t.lot}` : ""}
              </p>
            </div>
            <div className="tx-amount">
              <span
                className="tx-delta"
                style={{ color: t.quantityDelta >= 0 ? "var(--success)" : "var(--danger)" }}
              >
                {t.quantityDelta >= 0 ? `+${t.quantityDelta}` : t.quantityDelta}
              </span>
              <span className="muted tx-balance">→ {t.resultingQuantity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
