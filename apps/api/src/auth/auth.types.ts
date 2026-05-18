/**
 * Normalized auth context after a bearer token has been verified.
 * Provider-specific claims stay opaque — only stable fields cross the guard.
 */
export type AuthProviderId = "clerk";

export interface AuthContext {
  provider: AuthProviderId;
  /** Stable subject from the provider (Clerk `user_…` id). */
  externalAuthId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}
