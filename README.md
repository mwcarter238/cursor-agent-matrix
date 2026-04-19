# Cursor Agent Matrix

Operator dashboard for **Cursor Cloud Agents**: Matrix-themed UI, animated workflow graph ([React Flow](https://reactflow.dev/)), and a **FastAPI** backend that proxies the [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/overview) so your API key never ships to the browser.

## Prerequisites

- Node 20+
- Python 3.12+ (for local API) **or** Docker
- A Cursor **Cloud Agents** API key from [Dashboard → Cloud Agents](https://cursor.com/dashboard/cloud-agents)

## Quick start (local)

1. From the **repository root**, copy env and set your key:

   ```bash
   cp .env.example .env
   # Edit .env — set CURSOR_API_KEY
   ```

2. **API** (terminal A):

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   # Optional: copy root .env here as .env for pydantic-settings
   cp ../.env .env 2>/dev/null || true
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8787
   ```

3. **UI** (terminal B):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open **http://localhost:5173**. Vite proxies `/api` → `http://127.0.0.1:8787`.

## Docker (API only)

```bash
cp .env.example .env
# set CURSOR_API_KEY in .env
docker compose up --build
```

Run the UI with `npm run dev` in `frontend/` (proxy targets `127.0.0.1:8787` by default). Override with `VITE_DEV_API_PROXY` if needed.

## Production UI env

Build the SPA with an explicit API origin (no proxy):

```bash
cd frontend
VITE_API_URL=https://your-api-host.example.com npm run build
```

## Features (v0.1)

- **NEXUS-style control surface** (chrome, KPI strip, roster, Kanban lanes, right-rail sparkline/gauges/log, scanlines) with **Board / Timeline / Analytics** views
- Poll cloud agents; **Timeline** view shows the React Flow topology (NEXUS hub + animated links)
- Inspector: status, repo, PR links, load transcript, follow-up, stop, delete
- Launch agent modal (`POST /v0/agents` via proxy)
- Reduce-motion toggle (persists in `localStorage`)

## Threat model (short)

- Treat `CURSOR_API_KEY` as a secret: **server-side only**, never in `VITE_*` bundles.
- Conversation transcripts may contain secrets; add dashboard auth before exposing beyond localhost (planned).

## License

MIT
