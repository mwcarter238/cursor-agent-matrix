import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { InventoryRow } from "../api/types";
import { ExpiryBadge, formatExpiry } from "../components/ExpiryBadge";
import "./Lists.css";

export function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.inventory().then(setRows).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.product.name.toLowerCase().includes(q) ||
        r.product.gtin.includes(q) ||
        (r.product.manufacturer ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totalUnits = rows.reduce((s, r) => s + r.totalOnHand, 0);

  return (
    <div className="screen list-screen app-bg">
      <header className="list-head">
        <div>
          <p className="eyebrow">On hand</p>
          <h1 className="title">Inventory</h1>
        </div>
        <span className="pill">{totalUnits} units</span>
      </header>

      <input
        className="search"
        placeholder="Search product, GTIN, maker…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading && <p className="muted">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="muted empty">No products match.</p>
      )}

      <div className="list">
        {filtered.map((row) => (
          <div key={row.product.id} className="card list-card">
            <div className="list-card-head">
              <div>
                <p className="list-name">{row.product.name}</p>
                <p className="muted list-sub">
                  {[row.product.strength, row.product.form].filter(Boolean).join(" · ") || row.product.gtin}
                </p>
              </div>
              <span className={`onhand ${row.totalOnHand === 0 ? "onhand-zero" : ""}`}>
                {row.totalOnHand}
              </span>
            </div>

            {row.lots.filter((l) => l.quantity > 0).length > 0 && (
              <div className="lot-list">
                {row.lots
                  .filter((l) => l.quantity > 0)
                  .map((lot) => (
                    <div key={lot.id} className="lot-row">
                      <span className="mono lot-num">{lot.lot ?? "—"}</span>
                      <span className="lot-exp">
                        {formatExpiry(lot.expiry)} <ExpiryBadge expiry={lot.expiry} />
                      </span>
                      <span className="lot-qty">{lot.quantity}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
