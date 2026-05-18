import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import type { AuthContext } from "./auth.types.js";

/**
 * Injects the verified `AuthContext` set by `AuthGuard` on the request.
 */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<Request & { authContext?: AuthContext }>();
    if (!req.authContext) {
      throw new UnauthorizedException("Unauthenticated request");
    }
    return req.authContext;
  },
);
