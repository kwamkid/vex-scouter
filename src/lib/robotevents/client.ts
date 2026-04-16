import { z } from "zod";
import { PagedResponseSchema } from "./schemas";
import { acquireRateLimitSlot } from "./rateLimit";

export const RE_BASE = "https://www.robotevents.com/api/v2";

export class RobotEventsError extends Error {
  constructor(
    public status: number,
    message: string,
    public url?: string,
  ) {
    super(message);
    this.name = "RobotEventsError";
  }
}

type FetchOpts = {
  revalidate?: number;
  tags?: string[];
  timeoutMs?: number;
  retries?: number;
};

function getToken(): string {
  const token = process.env.ROBOTEVENTS_TOKEN;
  if (!token) {
    throw new RobotEventsError(
      401,
      "ROBOTEVENTS_TOKEN is not set. Add it to .env.local",
    );
  }
  return token;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | string[] | number[] | undefined>,
): string {
  const url = new URL(path.startsWith("http") ? path : `${RE_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rawFetch(url: string, opts: FetchOpts): Promise<Response> {
  const token = getToken();
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxRetries = opts.retries ?? 4;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= maxRetries) {
    await acquireRateLimitSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Referer: "https://www.robotevents.com/api/v2",
          Origin: "https://www.robotevents.com",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Dest": "empty",
          "Sec-Ch-Ua":
            '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
        },
        signal: controller.signal,
        next: {
          revalidate: opts.revalidate,
          tags: opts.tags,
        },
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status === 403) {
        console.warn(`[RE] ${res.status} ${url.slice(0, 120)} — retry ${attempt + 1}/${maxRetries}`);
        if (attempt >= maxRetries) {
          const body = await res.text().catch(() => "");
          throw new RobotEventsError(res.status, `RE API ${res.status}: ${body.slice(0, 200)}`, url);
        }
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : null;
        const base = res.status === 403 ? 2000 : 1500;
        const backoff = Math.min(base * 2 ** attempt + Math.random() * 1500, 20_000);
        const delay = retryAfterMs ?? backoff;
        await sleep(delay);
        attempt++;
        continue;
      }
      if (res.status >= 500 && attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 4000);
        await sleep(delay);
        attempt++;
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new RobotEventsError(
          res.status,
          `RE API ${res.status}: ${body.slice(0, 200)}`,
          url,
        );
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof RobotEventsError) throw err;
      const isAbort = (err as Error)?.name === "AbortError";
      console.warn(`[RE] ${isAbort ? "timeout" : "error"} ${url.slice(0, 120)} — retry ${attempt + 1}/${maxRetries}`);
      if (attempt >= maxRetries) break;
      const delay = Math.min(500 * 2 ** attempt, 4000);
      await sleep(delay);
      attempt++;
    }
  }
  throw lastErr ?? new RobotEventsError(0, "Unknown fetch error", url);
}

export async function reGet<T extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string | number | string[] | number[] | undefined> | undefined,
  schema: T,
  opts: FetchOpts = {},
): Promise<z.infer<T>> {
  const url = buildUrl(path, params);
  const res = await rawFetch(url, opts);
  const json = await res.json();
  return schema.parse(json);
}

// Paginate sequentially, invoking `onPage` after each page. If `onPage` returns
// `true`, pagination stops. Useful for "scan until we've found what we need"
// patterns against large result sets like season-wide skills.
export async function reGetPagedUntil<T extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string | number | string[] | number[] | undefined> | undefined,
  itemSchema: T,
  onPage: (items: z.infer<T>[], pageNum: number) => boolean,
  opts: FetchOpts = {},
  maxPages = 30,
): Promise<void> {
  const pageSchema = PagedResponseSchema(itemSchema);
  const perPage = 250;
  let page = 1;
  while (page <= maxPages) {
    const url = buildUrl(path, { ...params, per_page: perPage, page });
    const res = await rawFetch(url, opts);
    const parsed = pageSchema.parse(await res.json());
    const done = onPage(parsed.data, page);
    if (done) return;
    const lastPage = parsed.meta?.last_page ?? page;
    if (page >= lastPage) return;
    page++;
  }
}

export async function reGetAllPaged<T extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string | number | string[] | number[] | undefined> | undefined,
  itemSchema: T,
  opts: FetchOpts = {},
  maxPages = 20,
): Promise<z.infer<T>[]> {
  const pageSchema = PagedResponseSchema(itemSchema);
  const perPage = 250;
  const firstUrl = buildUrl(path, { ...params, per_page: perPage, page: 1 });
  const firstRes = await rawFetch(firstUrl, opts);
  const firstJson = await firstRes.json();
  const first = pageSchema.parse(firstJson);
  const all: z.infer<T>[] = [...first.data];
  const lastPage = Math.min(first.meta?.last_page ?? 1, maxPages);

  if (lastPage <= 1) return all;

  const pagePromises: Promise<z.infer<T>[]>[] = [];
  for (let p = 2; p <= lastPage; p++) {
    const pageUrl = buildUrl(path, { ...params, per_page: perPage, page: p });
    pagePromises.push(
      rawFetch(pageUrl, opts)
        .then((r) => r.json())
        .then((j) => pageSchema.parse(j).data),
    );
  }
  const rest = await Promise.all(pagePromises);
  for (const chunk of rest) all.push(...chunk);
  return all;
}
