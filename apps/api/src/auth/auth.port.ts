import type { AuthContext } from "./auth.types.js";

/**
 * Abstraction over JWT verification so the API can swap Clerk for another
 * OIDC provider later without touching controllers.
 */
export interface AuthPort {
  verifyBearerToken(rawToken: string): Promise<AuthContext>;
}

export const AUTH_PORT = Symbol("AUTH_PORT");
