import type {
  InventoryRow,
  LoginResponse,
  MovementRequest,
  MovementResponse,
  ScanResult,
  Transaction,
  User,
  WorkflowMode,
} from "./types";
import { localApi } from "./localData";

export type { LoginResponse };

/** The set of operations the UI needs; satisfied by either backend. */
export interface Api {
  listOperators(): Promise<User[]>;
  login(username: string, pin: string): Promise<LoginResponse>;
  parse(raw: string): Promise<ScanResult>;
  movement(mode: WorkflowMode, body: MovementRequest): Promise<MovementResponse>;
  inventory(): Promise<InventoryRow[]>;
  transactions(take?: number): Promise<Transaction[]>;
}

// The static GitHub Pages build runs entirely on-device (no .NET backend).
const LOCAL_MODE = import.meta.env.VITE_DATA_MODE === "local";

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

const httpApi: Api = {
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

export const api: Api = LOCAL_MODE ? localApi : httpApi;
