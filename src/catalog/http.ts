import { CatalogError } from './types';

/** fetch + JSON with a timeout and readable errors. */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new CatalogError(`HTTP ${res.status} for ${url.split('?')[0]}`, res.status);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new CatalogError(`Invalid JSON from ${url.split('?')[0]}`, res.status);
    }
  } catch (err) {
    if (err instanceof CatalogError) throw err;
    throw new CatalogError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}
