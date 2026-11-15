export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

// Shape of every error response from the API.
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
