import { ForbiddenError } from "../errors/app-error";

/**
 * CSRF & Origin Validation Utility
 *
 * Mandated Rules:
 * 1. State-changing requests (POST, PUT, PATCH, DELETE) must originate from a trusted origin.
 * 2. Compares the `Origin` or `Referer` header against the expected application host.
 * 3. Prevents Cross-Site Request Forgery via cookie-authenticated browser sessions.
 */

export function isStateChangingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(m);
}

export function validateOrigin(req: Request): { valid: boolean; reason?: string } {
  // Safe read-only methods do not require origin validation
  if (!isStateChangingMethod(req.method)) {
    return { valid: true };
  }

  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");
  const hostHeader = req.headers.get("host");

  // In standard browser Fetch/XHR, 'origin' is populated on POST/PUT/DELETE.
  const requestOrigin = originHeader || (refererHeader ? new URL(refererHeader).origin : null);

  if (!requestOrigin) {
    // Check if cross-site header is explicitly present
    const secFetchSite = req.headers.get("sec-fetch-site");
    if (secFetchSite === "cross-site") {
      return { valid: false, reason: "Cross-site request blocked by Sec-Fetch-Site" };
    }
    return { valid: true };
  }

  try {
    const originUrl = new URL(requestOrigin);

    if (hostHeader) {
      const expectedHost = hostHeader.split(":")[0];
      const actualHost = originUrl.hostname;

      // Allow localhost / 127.0.0.1 variations during development & testing
      const isLocalhost =
        (actualHost === "localhost" || actualHost === "127.0.0.1") &&
        (expectedHost === "localhost" || expectedHost === "127.0.0.1");

      if (actualHost !== expectedHost && !isLocalhost) {
        return {
          valid: false,
          reason: `Origin host mismatch: received '${actualHost}', expected '${expectedHost}'`,
        };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Malformed Origin or Referer URL" };
  }
}

/**
 * Throws ForbiddenError if request origin violates CSRF constraints.
 */
export function requireCsrf(req: Request): void {
  const check = validateOrigin(req);
  if (!check.valid) {
    throw new ForbiddenError(check.reason || "طلب غير مصرح به (CSRF Protection)");
  }
}
