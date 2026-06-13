import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Scanner } from "../components/Scanner";
import { QuantityStepper } from "../components/QuantityStepper";
import { ExpiryBadge, formatExpiry } from "../components/ExpiryBadge";
import { api, ApiError } from "../api/client";
import type { MovementResponse, ScanResult, WorkflowMode } from "../api/types";
import { WORKFLOWS } from "../workflow/config";
import "./Workflow.css";

type Phase = "scanning" | "review" | "done";

export function Workflow() {
  const { mode } = useParams<{ mode: WorkflowMode }>();
  const navigate = useNavigate();
  const meta = mode ? WORKFLOWS[mode] : undefined;

  const [phase, setPhase] = useState<Phase>("scanning");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<MovementResponse[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const defaultQuantity = useCallback(
    (scan: ScanResult): number => {
      if (mode === "cycle-count") return scan.onHand || scan.barcode.quantity || 0;
      return scan.barcode.quantity ?? scan.product?.packSize ?? 1;
    },
    [mode],
  );

  const handleRaw = useCallback(
    async (raw: string) => {
      if (busy || phase === "review") return;
      setBusy(true);
      setError(null);
      try {
        const scan = await api.parse(raw);
        if (!scan.barcode.gtin) {
          setError("No GTIN found in that barcode. Try again or enter it manually.");
          setBusy(false);
          return;
        }
        setResult(scan);
        setQuantity(defaultQuantity(scan));
        setPhase("review");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not read that barcode.");
      } finally {
        setBusy(false);
      }
    },
    [busy, phase, defaultQuantity],
  );

  async function confirm() {
    if (!result || !mode) return;
    setBusy(true);
    setError(null);
    try {
      const { barcode, product } = result;
      const res = await api.movement(mode, {
        gtin: barcode.gtin!,
        lot: barcode.lot,
        serial: barcode.serial,
        expiry: barcode.expiry,
        quantity,
        rawBarcode: barcode.raw,
        name: product?.name,
        strength: product?.strength,
        form: product?.form,
        manufacturer: product?.manufacturer,
      });
      setSession((s) => [res, ...s]);
      setPhase("done");
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      // Briefly show the success state, then resume scanning.
      setTimeout(() => {
        setResult(null);
        setPhase("scanning");
      }, 1100);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function cancelReview() {
    setResult(null);
    setError(null);
    setPhase("scanning");
  }

  function submitManual() {
    if (!manualValue.trim()) return;
    setManualOpen(false);
    const value = manualValue.trim();
    setManualValue("");
    void handleRaw(value);
  }

  const sessionTotal = useMemo(
    () => session.reduce((sum, r) => sum + Math.abs(r.transaction.quantityDelta), 0),
    [session],
  );

  if (!meta) {
    return (
      <div className="screen">
        <p>Unknown workflow.</p>
      </div>
    );
  }

  return (
    <div className="screen workflow app-bg" style={{ ["--accent" as string]: meta.accent }}>
      <header className="wf-head">
        <button className="wf-back" onClick={() => navigate("/")} aria-label="Back">‹</button>
        <div className="wf-title-group">
          <p className="eyebrow">{meta.short}</p>
          <h1 className="wf-title">{meta.title}</h1>
        </div>
        {session.length > 0 && (
          <span className="wf-tally pill">
            {session.length} scan{session.length > 1 ? "s" : ""} · {sessionTotal}
          </span>
        )}
      </header>

      <Scanner onDetected={handleRaw} paused={phase !== "scanning"} />

      {error && <p className="wf-error">{error}</p>}

      {phase === "scanning" && (
        <div className="wf-actions">
          <button className="btn btn-ghost" onClick={() => setManualOpen(true)}>
            Enter barcode manually
          </button>
        </div>
      )}

      {/* Recent items processed in this session */}
      {session.length > 0 && phase === "scanning" && (
        <div className="wf-session">
          {session.slice(0, 4).map((r) => (
            <div key={r.transaction.id} className="wf-session-row card">
              <span className="wf-session-name">
                {r.transaction.productName ?? r.transaction.gtin}
              </span>
              <span className="wf-session-meta muted">
                {signed(r.transaction.quantityDelta)} · on hand {r.onHand}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Review sheet */}
      <AnimatePresence>
        {phase === "review" && result && (
          <ReviewSheet
            scan={result}
            mode={mode!}
            quantity={quantity}
            setQuantity={setQuantity}
            busy={busy}
            onConfirm={confirm}
            onCancel={cancelReview}
          />
        )}
        {phase === "done" && (
          <motion.div
            className="wf-success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="success-ring">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
                <path d="M5 12l5 5 9-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="success-text">{meta.verb.replace("Set ", "").replace("Add ", "Added ")}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual entry sheet */}
      <AnimatePresence>
        {manualOpen && (
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setManualOpen(false)}>
            <motion.div
              className="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-grip" />
              <h3 className="sheet-title">Enter barcode</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                Paste the full GS1 string, or type the GTIN.
              </p>
              <input
                autoFocus
                className="manual-input"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitManual()}
                placeholder="(01)03064567890129(17)…"
                inputMode="text"
              />
              <button className="btn btn-primary" onClick={submitManual} disabled={!manualValue.trim()}>
                Look up
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReviewSheet({
  scan,
  mode,
  quantity,
  setQuantity,
  busy,
  onConfirm,
  onCancel,
}: {
  scan: ScanResult;
  mode: WorkflowMode;
  quantity: number;
  setQuantity: (n: number) => void;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const meta = WORKFLOWS[mode];
  const { barcode, product, onHand } = scan;
  const name = product?.name ?? `Unrecognised GTIN`;

  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="sheet review-sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="sheet-grip" />

        <div className="review-product">
          <div className="review-name-row">
            <h2 className="review-name">{name}</h2>
            {!product && <span className="pill pill-warn">New item</span>}
          </div>
          {product && (
            <p className="muted review-sub">
              {[product.strength, product.form, product.manufacturer].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="review-fields">
          <Field label="GTIN" value={barcode.gtin ?? "—"} mono />
          <Field label="Lot" value={barcode.lot ?? "—"} mono />
          <Field
            label="Expiry"
            value={formatExpiry(barcode.expiry)}
            extra={<ExpiryBadge expiry={barcode.expiry} />}
          />
          {barcode.serial && <Field label="Serial" value={barcode.serial} mono />}
          <Field label="On hand" value={String(onHand)} />
        </div>

        <div className="review-qty">
          <span className="review-qty-label">{meta.quantityLabel}</span>
          <QuantityStepper value={quantity} onChange={setQuantity} min={mode === "cycle-count" ? 0 : 1} />
        </div>

        {mode === "cycle-count" && (
          <p className="muted count-hint">
            {quantity === onHand
              ? "Matches the system count."
              : `Adjustment: ${signed(quantity - onHand)} vs. system count.`}
          </p>
        )}

        <div className="review-buttons">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? "Saving…" : meta.verb}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, mono, extra }: { label: string; value: string; mono?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label muted">{label}</span>
      <span className={`field-value ${mono ? "mono" : ""}`}>
        {value}
        {extra}
      </span>
    </div>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
