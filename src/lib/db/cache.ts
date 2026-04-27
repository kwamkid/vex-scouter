// Lightweight JSON cache backed by Upstash. Used for assembled API responses
// where the freshness rules differ from the per-team scout cache.
//
// Local dev (no Upstash env): no-op — all reads miss, writes silently drop.
import { createClient } from "@vercel/kv";

const isVercelKV = Boolean(
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
);

let _kv: ReturnType<typeof createClient> | null = null;

function kv() {
  if (_kv) return _kv;
  _kv = createClient({
    url:
      process.env.UPSTASH_REDIS_REST_URL ??
      process.env.KV_REST_API_URL ??
      "",
    token:
      process.env.UPSTASH_REDIS_REST_TOKEN ??
      process.env.KV_REST_API_TOKEN ??
      "",
  });
  return _kv;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isVercelKV) return null;
  try {
    return (await kv().get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  if (!isVercelKV) return;
  try {
    await kv().set(key, value, { ex: ttlSeconds });
  } catch {
    // best-effort
  }
}
