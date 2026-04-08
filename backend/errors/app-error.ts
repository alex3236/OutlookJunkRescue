export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function normalizeUnknownError(error: unknown, fallback = 'Internal server error') {
  if (error instanceof AppError) {
    return error;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new AppError(500, 'INTERNAL_ERROR', String((error as { message: unknown }).message), error);
  }

  return new AppError(500, 'INTERNAL_ERROR', fallback, error);
}

