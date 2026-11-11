/**
 * Application Domain Errors
 * Provides typed error hierarchy for HTTP and domain-level error handling.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "UNAUTHORIZED: يرجى تسجيل الدخول أولاً") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "FORBIDDEN: ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "العنصر المطلوب غير موجود") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "تعارض في البيانات أو أن المورد محجوز حالياً") {
    super(message, 409, "CONFLICT");
  }
}

export class ValidationError extends AppError {
  public readonly errors?: unknown;

  constructor(message = "بيانات غير صالحة", errors?: unknown) {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

/**
 * Safely extracts an error message from an unknown catch block value.
 * Guaranteed to never return 'any' or cause runtime crashes.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "حدث خطأ غير متوقع أثناء معالجة الطلب";
}

/**
 * Safely extracts HTTP status code from an unknown catch block value.
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}
