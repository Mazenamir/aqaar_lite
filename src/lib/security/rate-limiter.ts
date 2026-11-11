/**
 * Login Rate Limiter (Brute-Force & Credential Stuffing Protection)
 *
 * Tracks failed login attempts per key (e.g. IP address or IP + email).
 * Blocks further attempts for a cooldown window once the threshold is reached.
 */

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

export interface RateLimitConfig {
  maxAttempts: number;      // Maximum failed attempts before blocking (default: 5)
  windowMs: number;         // Time window in ms (default: 15 minutes)
  blockDurationMs: number;  // Block duration once threshold is exceeded (default: 15 minutes)
}

export const DEFAULT_LOGIN_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,        // 15 minutes
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
};

class RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic cleanup of stale entries every 10 minutes
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Check if the key is currently rate-limited.
   */
  public check(key: string, config: RateLimitConfig = DEFAULT_LOGIN_RATE_LIMIT_CONFIG): {
    allowed: boolean;
    remainingAttempts: number;
    retryAfterSeconds?: number;
  } {
    const now = Date.now();
    const record = this.records.get(key);

    if (!record) {
      return { allowed: true, remainingAttempts: config.maxAttempts };
    }

    // Check if blocked
    if (record.blockedUntil && record.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    // Check if window has expired
    if (now - record.firstAttemptAt > config.windowMs) {
      this.records.delete(key);
      return { allowed: true, remainingAttempts: config.maxAttempts };
    }

    const remainingAttempts = Math.max(0, config.maxAttempts - record.attempts);
    return {
      allowed: record.attempts < config.maxAttempts,
      remainingAttempts,
    };
  }

  /**
   * Record a failed attempt. If maxAttempts reached, block the key.
   */
  public recordFailedAttempt(
    key: string,
    config: RateLimitConfig = DEFAULT_LOGIN_RATE_LIMIT_CONFIG
  ): {
    blocked: boolean;
    retryAfterSeconds?: number;
  } {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record || now - record.firstAttemptAt > config.windowMs) {
      record = {
        attempts: 1,
        firstAttemptAt: now,
        blockedUntil: null,
      };
      this.records.set(key, record);
      return { blocked: false };
    }

    record.attempts += 1;

    if (record.attempts >= config.maxAttempts) {
      record.blockedUntil = now + config.blockDurationMs;
      const retryAfterSeconds = Math.ceil(config.blockDurationMs / 1000);
      return {
        blocked: true,
        retryAfterSeconds,
      };
    }

    return { blocked: false };
  }

  /**
   * Reset attempts on successful authentication.
   */
  public reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Clear all records (useful for test suites).
   */
  public clearAll(): void {
    this.records.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      const isExpired = now - record.firstAttemptAt > DEFAULT_LOGIN_RATE_LIMIT_CONFIG.windowMs;
      const isUnblocked = !record.blockedUntil || record.blockedUntil <= now;
      if (isExpired && isUnblocked) {
        this.records.delete(key);
      }
    }
  }
}

export const loginRateLimiter = new RateLimiter();
