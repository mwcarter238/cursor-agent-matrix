import type {
  InventoryRow,
  MovementRequest,
  MovementResponse,
  ScanResult,
  Transaction,
  User,
  WorkflowMode,
} from "./types";

export interface LoginResponse {
  token: string;
  user: User;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "stockwell.token";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });

  if (res.status === 401) {
    setToken(null);
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listOperators: () => request<User[]>("/auth/operators"),

  login: (username: string, pin: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, pin }),
    }),

  parse: (raw: string) =>
    request<ScanResult>("/scan/parse", {
      method: "POST",
      body: JSON.stringify({ raw }),
    }),

  movement: (mode: WorkflowMode, body: MovementRequest) =>
    request<MovementResponse>(`/${mode}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  inventory: () => request<InventoryRow[]>("/inventory/"),

  transactions: (take = 50) =>
    request<Transaction[]>(`/inventory/transactions?take=${take}`),
};
