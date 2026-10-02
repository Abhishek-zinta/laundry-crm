import { HttpStatus } from '@nestjs/common';

/**
 * Expected business errors. The message is safe to show to end users;
 * the code lets the UI react to specific situations.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (entity: string, code = `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`) =>
  new AppError(code, `${entity} not found.`, HttpStatus.NOT_FOUND);

export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(code, message, HttpStatus.CONFLICT, details);

export const forbidden = (message = "You don't have permission to do that.", code = 'FORBIDDEN') =>
  new AppError(code, message, HttpStatus.FORBIDDEN);

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(code, message, HttpStatus.BAD_REQUEST, details);

export const unprocessable = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
