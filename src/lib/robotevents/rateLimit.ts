// Global token-bucket limiter shared across all RobotEvents requests in this
// process. RobotEvents returns `x-ratelimit-limit: 100` per ~60s window; we
// target ~85/min to leave headroom for retries and concurrent callers.
const TOKENS_PER_SEC = 85 / 60;
const BUCKET_CAPACITY = 5;

let tokens = BUCKET_CAPACITY;
let lastRefill = Date.now();
const waiters: Array<() => void> = [];

function refill() {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  tokens = Math.min(BUCKET_CAPACITY, tokens + elapsed * TOKENS_PER_SEC);
  lastRefill = now;
}

function drain() {
  while (waiters.length > 0) {
    refill();
    if (tokens < 1) return;
    tokens -= 1;
    const w = waiters.shift();
    w?.();
  }
}

let drainTimer: NodeJS.Timeout | null = null;

export function acquireRateLimitSlot(): Promise<void> {
  return new Promise((resolve) => {
    waiters.push(resolve);
    if (!drainTimer) {
      drain();
      if (waiters.length > 0) {
        drainTimer = setInterval(() => {
          drain();
          if (waiters.length === 0 && drainTimer) {
            clearInterval(drainTimer);
            drainTimer = null;
          }
        }, 200);
      }
    }
  });
}
