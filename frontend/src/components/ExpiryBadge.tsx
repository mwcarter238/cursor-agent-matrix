const WARN_DAYS = 90;

export function daysUntil(expiry: string | null): number | null {
  if (!expiry) return null;
  const d = new Date(expiry + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function formatExpiry(expiry: string | null): string {
  if (!expiry) return "—";
  const d = new Date(expiry + "T00:00:00");
  if (Number.isNaN(d.getTime())) return expiry;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** A small coloured chip flagging near-expiry or expired stock. */
export function ExpiryBadge({ expiry }: { expiry: string | null }) {
  const days = daysUntil(expiry);
  if (days === null) return null;

  if (days < 0) return <span className="exp-chip exp-danger">Expired</span>;
  if (days <= WARN_DAYS) return <span className="exp-chip exp-warn">{days}d left</span>;
  return null;
}
