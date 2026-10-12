/** PostgREST jsonb RPC may return a parsed array or a JSON string. */
export function coerceTrendRpcJson<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
