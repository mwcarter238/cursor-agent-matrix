# Stockwell — Pharmacy Inventory

A mobile-first web app for managing pharmaceutical inventory by scanning **GS1
barcodes** (GS1 DataMatrix and GS1-128) with the phone camera. Designed to feel
like a premium native app: dark, calm, and obvious to use.

Three workflows, one scan each:

1. **Receiving** — scan incoming stock to add it to inventory.
2. **Dispense** — scan product as it is dispensed to a patient.
3. **Cycle Count** — scan to reconcile what is physically on the shelf.

## Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Frontend | React + TypeScript + Vite, Framer Motion, installable PWA |
| Scanning | [ZXing](https://github.com/zxing-js) (`@zxing/browser`) — DataMatrix, Code 128, QR, EAN-13 |
| Backend  | ASP.NET Core 8 (minimal APIs), EF Core                |
| Database | PostgreSQL                                            |
| Auth     | Operator roster + PIN, issued as JWT                  |

## Architecture

```
frontend/   React PWA (camera, three workflows, inventory, history)
backend/
  PharmaInventory.Api/    ASP.NET Core API
    Gs1/                  GS1 Application-Identifier parser (the core engine)
    Domain/               Product, InventoryLot, StockTransaction, AppUser
    Services/             InventoryService (ledger + balances), TokenService
    Endpoints/            /api/auth, /api/scan, /api/receive|dispense|cycle-count, /api/inventory
  PharmaInventory.Tests/  xUnit tests for the GS1 parser
```

The transaction ledger (`StockTransaction`) is the source of truth; per-lot
on-hand balances (`InventoryLot`) are a projection updated inside the same
database transaction as each movement.

### GS1 parsing

Pharmaceutical packs encode data with GS1 Application Identifiers. The parser
(in both C# and a TypeScript mirror for instant on-device feedback) extracts:

| AI     | Meaning          |
| ------ | ---------------- |
| `(01)` | GTIN             |
| `(17)` | Expiration date  |
| `(10)` | Batch / lot      |
| `(21)` | Serial number    |
| `(11)` | Production date  |
| `(30)` / `(37)` | Count   |
| `(00)` | SSCC             |
| `(71x)`| National reimbursement number |

It handles fixed- and variable-length elements (terminated by the FNC1 / ASCII
GS separator), strips scanner symbology prefixes, and treats a day of `00` as
the last day of the month.

## Run it (Docker)

```bash
cp .env.example .env          # set JWT_KEY and POSTGRES_PASSWORD
docker compose up --build
```

- App: **http://localhost:8080**
- API (Swagger in Development): **http://localhost:8081/swagger**

## Run it (local dev)

Prerequisites: .NET 8 SDK, Node 20+, a PostgreSQL instance.

**API**

```bash
cd backend/PharmaInventory.Api
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=pharma;Username=pharma;Password=pharma"
dotnet run            # http://localhost:8080  (seeds demo data on first run)
```

**Frontend**

```bash
cd frontend
npm install
npm run dev           # http://localhost:5173 — Vite proxies /api to :8080
```

> **Camera & HTTPS:** `getUserMedia` only works in a secure context.
> `localhost` counts as secure, so desktop dev works as-is. To test on a real
> phone over the LAN, serve the app over HTTPS (e.g. a tunnel or TLS proxy).

## Demo logins

Seeded on first run:

| Operator         | Username | PIN  |
| ---------------- | -------- | ---- |
| Demo Pharmacist  | `demo`   | 1234 |
| Demo Technician  | `tech`   | 0000 |

The catalogue is seeded with a few products (Amoxicillin, Atorvastatin,
Lisinopril). Scanning an unknown GTIN creates a stub product automatically so
inventory is never blocked.

## Tests

```bash
cd backend
dotnet test           # GS1 parser unit tests
```

## Notes & roadmap

- The schema is created on startup via `EnsureCreated` for fast prototyping.
  Switch to EF Core migrations before going to production.
- The scanner is abstracted behind one `Scanner` component, so a commercial
  machine-vision SDK (e.g. Scandit/Dynamsoft) can be dropped in later without
  touching the workflows.
- Planned: role-based permissions, lot-level FEFO picking on dispense, offline
  queueing, and CSV/exports.
