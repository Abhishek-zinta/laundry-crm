import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppError } from './app-error';

export interface ErrorBody {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Converts every error into a consistent, user-safe JSON body.
 * Technical details are logged server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const body = this.toBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} failed: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.status,
        error: { code: exception.code, message: exception.message, details: exception.details },
      };
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      return validationBody(zodError);
    }
    if (exception instanceof ZodError) {
      return validationBody(exception);
    }

    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a moment and try again.' },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          error: {
            code: 'DUPLICATE',
            message: 'A record with these details already exists.',
            details: { fields: exception.meta?.target },
          },
        };
      }
      if (exception.code === 'P2025') {
        return { statusCode: HttpStatus.NOT_FOUND, error: { code: 'NOT_FOUND', message: 'Record not found.' } };
      }
      if (exception.code === 'P2003') {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: { code: 'INVALID_REFERENCE', message: 'A referenced record does not exist.' },
        };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string' ? response : ((response as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        error: {
          code: httpCode(status),
          message: Array.isArray(message) ? message.join(', ') : message,
        },
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
    };
  }
}

function validationBody(error: ZodError): ErrorBody {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  const first = error.issues[0];
  return {
    statusCode: HttpStatus.BAD_REQUEST,
    error: {
      code: 'VALIDATION_FAILED',
      message: first ? `Please check the form: ${first.message}` : 'Please check the form and try again.',
      details: { fields },
    },
  };
}

function httpCode(status: number): string {
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
}
