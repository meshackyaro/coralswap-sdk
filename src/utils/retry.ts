/**
 * Retry utilities for transient RPC failures.
 *
 * Soroban RPC endpoints may experience intermittent issues.
 * These helpers provide configurable retry logic with exponential backoff.
 */

/**
 * Retry configuration.
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with automatic retry on failure.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  let delay = cfg.baseDelayMs;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === cfg.maxRetries) break;

      if (!isRetryable(lastError)) throw lastError;

      await sleep(delay);
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError ?? new Error('Retry exhausted');
}

/**
 * Determine if an error is retryable (transient network issues).
 */
export function isRetryable(error: Error): boolean {
  const retryablePatterns = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'socket hang up',
    'network error',
    '502',
    '503',
    '504',
    'rate limit',
    'too many requests',
  ];

  const msg = error.message.toLowerCase();
  return retryablePatterns.some((p) => msg.includes(p.toLowerCase()));
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
