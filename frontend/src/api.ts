const apiPrefix = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text || res.statusText)
  }
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiPrefix}${path}`)
  const data = await parse<unknown>(res)
  if (!res.ok) {
    const detail = typeof data === 'object' && data && 'detail' in data ? String((data as { detail: unknown }).detail) : String(data)
    throw new ApiError(res.status, detail)
  }
  return data as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiPrefix}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parse<unknown>(res)
  if (!res.ok) {
    const detail = typeof data === 'object' && data && 'detail' in data ? String((data as { detail: unknown }).detail) : String(data)
    throw new ApiError(res.status, detail)
  }
  return data as T
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${apiPrefix}${path}`, { method: 'DELETE' })
  const data = await parse<unknown>(res)
  if (!res.ok) {
    const detail = typeof data === 'object' && data && 'detail' in data ? String((data as { detail: unknown }).detail) : String(data)
    throw new ApiError(res.status, detail)
  }
  return data as T
}
