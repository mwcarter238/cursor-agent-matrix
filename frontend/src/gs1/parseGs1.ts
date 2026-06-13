import type { Gs1Barcode, Gs1Element } from "../api/types";

/**
 * Lightweight client-side GS1 parser used for *instant* on-device feedback the
 * moment the camera decodes a symbol. The server performs the authoritative
 * parse when a movement is committed; this mirror keeps the UI feeling fast.
 *
 * It supports the Application Identifiers that matter for pharmaceutical packs:
 * (01) GTIN, (17) expiry, (10) lot, (21) serial, (11) production, (00) SSCC,
 * (30)/(37) count.
 */

const GS = "\u001d"; // FNC1 / ASCII Group Separator

interface AiDef {
  ai: string;
  name: string;
  fixed: boolean;
  len: number; // data length (fixed) or max (variable)
  date?: boolean;
  field?: keyof Gs1Barcode;
}

const TABLE: Record<string, AiDef> = Object.fromEntries(
  (
    [
      { ai: "00", name: "SSCC", fixed: true, len: 18, field: "sscc" },
      { ai: "01", name: "GTIN", fixed: true, len: 14, field: "gtin" },
      { ai: "02", name: "Content GTIN", fixed: true, len: 14 },
      { ai: "10", name: "Batch/Lot", fixed: false, len: 20, field: "lot" },
      { ai: "11", name: "Production date", fixed: true, len: 6, date: true, field: "productionDate" },
      { ai: "15", name: "Best before", fixed: true, len: 6, date: true },
      { ai: "17", name: "Expiration date", fixed: true, len: 6, date: true, field: "expiry" },
      { ai: "20", name: "Variant", fixed: true, len: 2 },
      { ai: "21", name: "Serial number", fixed: false, len: 20, field: "serial" },
      { ai: "30", name: "Variable count", fixed: false, len: 8, field: "quantity" },
      { ai: "37", name: "Count", fixed: false, len: 8, field: "quantity" },
      { ai: "240", name: "Additional product id", fixed: false, len: 30 },
      { ai: "710", name: "NHRN PZN", fixed: false, len: 20, field: "nhrn" },
      { ai: "711", name: "NHRN CIP", fixed: false, len: 20, field: "nhrn" },
    ] satisfies AiDef[]
  ).map((d) => [d.ai, d]),
);

function normalise(raw: string): string {
  let s = raw;
  if (s.length >= 3 && s[0] === "]") s = s.slice(3); // symbology identifier
  return s.replace(/<GS>|\{GS\}/g, GS);
}

function matchAi(data: string, pos: number): AiDef | null {
  for (const len of [4, 3, 2]) {
    const candidate = data.slice(pos, pos + len);
    if (candidate.length === len && TABLE[candidate]) return TABLE[candidate];
  }
  return null;
}

function parseDate(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return null;
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  if (month < 1 || month > 12) return null;
  let day = Number(value.slice(4, 6));
  if (day === 0) day = new Date(year, month, 0).getDate(); // last day of month
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso;
}

export function parseGs1(raw: string): Gs1Barcode {
  const result: Gs1Barcode = {
    gtin: null,
    lot: null,
    serial: null,
    expiry: null,
    productionDate: null,
    sscc: null,
    quantity: null,
    nhrn: null,
    elements: [],
    warnings: [],
    raw,
  };

  if (!raw) {
    result.warnings.push("Empty barcode payload.");
    return result;
  }

  const data = normalise(raw);
  result.raw = data;
  let pos = 0;

  while (pos < data.length) {
    if (data[pos] === GS) {
      pos++;
      continue;
    }

    const ai = matchAi(data, pos);
    if (!ai) {
      result.warnings.push(`Unknown AI near "${data.slice(pos, pos + 6)}".`);
      break;
    }
    pos += ai.ai.length;

    let value: string;
    if (ai.fixed) {
      value = data.slice(pos, pos + ai.len);
      pos += ai.len;
    } else {
      let end = data.indexOf(GS, pos);
      if (end < 0) end = data.length;
      value = data.slice(pos, end);
      pos = end < data.length ? end + 1 : end;
    }

    const element: Gs1Element = { ai: ai.ai, name: ai.name, value };
    result.elements.push(element);

    if (ai.field === "quantity") {
      const n = Number(value);
      if (!Number.isNaN(n)) result.quantity = n;
    } else if (ai.date) {
      const iso = parseDate(value);
      if (ai.field === "expiry") result.expiry = iso;
      else if (ai.field === "productionDate") result.productionDate = iso;
    } else if (ai.field) {
      // string-valued fields (gtin, lot, serial, sscc, nhrn)
      (result as unknown as Record<string, unknown>)[ai.field] = value;
    }
  }

  return result;
}
