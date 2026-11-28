/**
 * Typed error class for all API failures.
 *
 * Thrown by `apiClient` whenever the Flask API returns a non-2xx response.
 * Callers can `catch (err)` and narrow with `err instanceof ApiError` to
 * access structured error details without inspecting raw HTTP responses.
 */
export class ApiError extends Error {
  /** HTTP status code returned by the Flask API. */
  readonly statusCode: number;
  /**
   * Human-readable message safe to display to the user.
   * Taken from the Flask error envelope `error.message` when available,
   * otherwise a generic description derived from the status code.
   */
  override readonly message: string;
  /**
   * Machine-readable error code from the Flask envelope (`error.code`).
   * Undefined when the response body cannot be parsed as JSON.
   */
  readonly code: string | undefined;
  /**
   * Structured field-level validation details from the Flask envelope
   * (`error.details`). Present on validation error responses (400 / 422).
   */
  readonly details: Record<string, string[]> | undefined;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.message = message;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isConflict(): boolean {
    return this.statusCode === 409;
  }

  get isValidationError(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

/** Flask error envelope shape (`{ data: null, error: { code, message, details } }`). */
export interface FlaskErrorEnvelope {
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]> | null;
  };
}

/** Flask success envelope shape (`{ data: T }`). */
export interface FlaskSuccessEnvelope<T> {
  data: T;
}

/** Type guard — narrows an unknown response body to a Flask error envelope. */
export function isFlaskErrorEnvelope(body: unknown): body is FlaskErrorEnvelope {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as FlaskErrorEnvelope).error?.message === "string"
  );
}