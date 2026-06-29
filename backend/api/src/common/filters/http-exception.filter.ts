import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomUUID();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttp ? exception.getResponse() : null;

    // Unexpected (non-HttpException) errors must NOT leak their internal message —
    // a raw Prisma/DB error string, a stack, an invariant — to the client. Log the
    // real error server-side keyed by requestId for correlation, and return a
    // constant generic message. HttpException messages are author-chosen and safe.
    if (!isHttp) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} — ` +
          ((exception as Error)?.stack ?? String(exception)),
      );
      // Report the unexpected 500 to Sentry (no-op when no DSN is configured),
      // carrying the same requestId so a server log line maps to the Sentry event.
      Sentry.withScope((scope) => {
        scope.setTag('requestId', requestId);
        scope.setContext('request', { method: request.method, url: request.url });
        Sentry.captureException(exception);
      });
    }

    const message = !isHttp
      ? 'Internal server error'
      : typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)['message'] ?? 'Error'
        : typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exception.message;

    const code = !isHttp
      ? 'INTERNAL_SERVER_ERROR'
      : typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)['error'] ?? 'HTTP_ERROR'
        : 'HTTP_ERROR';

    // Carry through any extra detail fields a thrower attached alongside
    // { error, message } (e.g. liveTripId/liveTripOverdue, cutoff) so the client
    // can act on them — without them the structured error is just a string.
    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? Object.fromEntries(
            Object.entries(exceptionResponse as Record<string, unknown>).filter(
              ([k]) => !['error', 'message', 'statusCode'].includes(k),
            ),
          )
        : {};

    response.status(status).json({
      error: { code, message, ...details },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        path: request.url,
      },
    });
  }
}
