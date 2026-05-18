import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

import type { ApiError } from "@pickleball/shared";

/**
 * Single source of truth for the error envelope the API sends back. Matches
 * the `ApiError` DTO in `@pickleball/shared` so the web (and future mobile)
 * client can rely on a stable shape.
 *
 * Anything not derived from a NestJS `HttpException` is logged at error
 * level and surfaced to the client as a generic 500 — never leak stack
 * traces or internal messages.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "internal_error";
    let message = "Internal server error";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === "string") {
        message = response;
        code = slug(exception.name);
      } else if (response && typeof response === "object") {
        const r = response as Record<string, unknown>;
        message = (r.message as string) ?? exception.message;
        code = (r.error as string) ? slug(String(r.error)) : slug(exception.name);
        if ("details" in r && r.details && typeof r.details === "object") {
          details = r.details as Record<string, unknown>;
        }
      }
    } else {
      this.logger.error(
        `Unhandled error on ${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiError = { statusCode, code, message, details };
    res.status(statusCode).json(body);
  }
}

function slug(name: string): string {
  return name
    .replace(/Exception$/, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();
}
