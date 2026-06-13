import { parseGs1 } from "../gs1/parseGs1";
import type {
  InventoryRow,
  LoginResponse,
  MovementRequest,
  MovementResponse,
  Product,
  ScanResult,
  Transaction,
  User,
  WorkflowMode,
} from "./types";

/**
 * A fully on-device implementation of the API, used for the static GitHub Pages
 * build where there is no .NET backend. Inventory, history, operators, and the
 * product catalogue live in localStorage so the three workflows work entirely
 * offline on the phone. It mirrors the behaviour of the server-side
 * InventoryService (receive adds, dispense subtracts, cycle-count sets).
 */

interface LocalOperator extends User {
  pin: string;
}

interface LocalLot {
  id: number;
  gtin: string;
  lot: string | null;
  expiry: string | null;
  quantity: number;
  updatedAt: string;
}

interface Store {
  seq: number;
  operators: LocalOperator[];
  products: Product[];
  lots: LocalLot[];
  transactions: Transaction[];
}

const KEY = "stockwell.local.store";

const SEED: Store = {
  seq: 100,
  operators: [
    { id: 1, name: "Demo Pharmacist", username: "demo", role: "pharmacist", pin: "1234" },
    { id: 2, name: "Demo Technician", username: "tech", role: "operator", pin: "0000" },
  ],
  products: [
    { id: 1, gtin: "00312345678906", name: "Amoxicillin", strength: "500 mg", form: "Capsule", manufacturer: "Acme Pharma", packSize: 30 },
    { id: 2, gtin: "00312345678913", name: "Atorvastatin", strength: "20 mg", form: "Tablet", manufacturer: "Northwind Labs", packSize: 90 },
    { id: 3, gtin: "00312345678920", name: "Lisinopril", strength: "10 mg", form: "Tablet", manufacturer: "Contoso Health", packSize: 100 },
  ],
  lots: [],
  transactions: [],
};

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fall through to seed */
  }
  const seeded = structuredClone(SEED);
  save(seeded);
  return seeded;
}

function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

function currentUserName(): string {
  try {
    const u = localStorage.getItem("stockwell.user");
    if (u) return (JSON.parse(u) as User).name;
  } catch {
    /* ignore */
  }
  return "—";
}

function onHand(store: Store, gtin: string): number {
  return store.lots.filter((l) => l.gtin === gtin).reduce((s, l) => s + l.quantity, 0);
}

function ensureProduct(store: Store, req: MovementRequest): Product {
  let p = store.products.find((x) => x.gtin === req.gtin);
  if (!p) {
    p = {
      id: ++store.seq,
      gtin: req.gtin,
      name: req.name?.trim() || `Unknown (${req.gtin})`,
      strength: req.strength ?? null,
      form: req.form ?? null,
      manufacturer: req.manufacturer ?? null,
      packSize: null,
    };
    store.products.push(p);
  }
  return p;
}

function ensureLot(store: Store, gtin: string, lot: string | null, expiry: string | null): LocalLot {
  let row = store.lots.find((l) => l.gtin === gtin && l.lot === lot && l.expiry === expiry);
  if (!row) {
    row = { id: ++store.seq, gtin, lot, expiry, quantity: 0, updatedAt: new Date().toISOString() };
    store.lots.push(row);
  }
  return row;
}

const TYPE_NAME: Record<WorkflowMode, Transaction["type"]> = {
  receive: "Receive",
  dispense: "Dispense",
  "cycle-count": "CycleCount",
};

function applyMovement(mode: WorkflowMode, req: MovementRequest): MovementResponse {
  const store = load();
  const product = ensureProduct(store, req);
  const lot = ensureLot(store, req.gtin, req.lot ?? null, req.expiry ?? null);
  const qty = Math.abs(req.quantity);

  let delta: number;
  if (mode === "receive") {
    delta = qty;
    lot.quantity = lot.quantity + qty;
  } else if (mode === "dispense") {
    delta = -qty;
    lot.quantity = Math.max(0, lot.quantity - qty);
  } else {
    // cycle count: set on-hand to the counted quantity; delta is the correction.
    delta = qty - lot.quantity;
    lot.quantity = qty;
  }
  lot.updatedAt = new Date().toISOString();

  const tx: Transaction = {
    id: ++store.seq,
    type: TYPE_NAME[mode],
    gtin: req.gtin,
    productName: product.name,
    lot: req.lot ?? null,
    serial: req.serial ?? null,
    expiry: req.expiry ?? null,
    quantityDelta: delta,
    resultingQuantity: lot.quantity,
    userName: currentUserName(),
    createdAt: new Date().toISOString(),
  };
  store.transactions.push(tx);
  save(store);

  return { transaction: tx, onHand: onHand(store, req.gtin) };
}

const delay = <T>(value: T): Promise<T> => Promise.resolve(value);

export const localApi = {
  listOperators: (): Promise<User[]> =>
    delay(load().operators.map(({ pin: _pin, ...u }) => u)),

  login: (username: string, pin: string): Promise<LoginResponse> => {
    const op = load().operators.find((o) => o.username === username && o.pin === pin);
    if (!op) return Promise.reject(new Error("Incorrect PIN."));
    const { pin: _pin, ...user } = op;
    return delay({ token: `local-${username}-${Date.now()}`, user });
  },

  parse: (raw: string): Promise<ScanResult> => {
    const store = load();
    const barcode = parseGs1(raw);
    const product = barcode.gtin ? store.products.find((p) => p.gtin === barcode.gtin) ?? null : null;
    return delay({ barcode, product, onHand: barcode.gtin ? onHand(store, barcode.gtin) : 0 });
  },

  movement: (mode: WorkflowMode, body: MovementRequest): Promise<MovementResponse> =>
    delay(applyMovement(mode, body)),

  inventory: (): Promise<InventoryRow[]> => {
    const store = load();
    const rows = [...store.products]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const lots = store.lots
          .filter((l) => l.gtin === p.gtin)
          .sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999"))
          .map((l) => ({
            id: l.id,
            lot: l.lot,
            expiry: l.expiry,
            quantity: l.quantity,
            updatedAt: l.updatedAt.slice(0, 10),
          }));
        return { product: p, lots, totalOnHand: lots.reduce((s, l) => s + l.quantity, 0) };
      });
    return delay(rows);
  },

  transactions: (take = 50): Promise<Transaction[]> =>
    delay([...load().transactions].reverse().slice(0, take)),
};
