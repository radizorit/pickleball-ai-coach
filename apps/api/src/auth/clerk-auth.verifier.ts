import { Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyToken } from "@clerk/backend";

import type { AuthContext, AuthProviderId } from "./auth.types.js";
import type { AuthPort } from "./auth.port.js";
import { loadEnv } from "../env.js";

@Injectable()
export class ClerkAuthVerifier implements AuthPort {
  private readonly secretKey: string;

  constructor() {
    this.secretKey = loadEnv().CLERK_SECRET_KEY;
  }

  async verifyBearerToken(rawToken: string): Promise<AuthContext> {
    try {
      const payload = await verifyToken(rawToken, {
        secretKey: this.secretKey,
      });

      const sub = typeof payload.sub === "string" ? payload.sub : null;
      if (!sub) {
        throw new UnauthorizedException("Invalid token: missing subject");
      }

      const record = payload as Record<string, unknown>;

      const email =
        typeof record.email === "string"
          ? record.email
          : typeof record.primary_email_address === "string"
            ? (record.primary_email_address as string)
            : null;

      if (!email) {
        throw new UnauthorizedException("Invalid token: missing email claim");
      }

      const name = typeof record.name === "string" ? (record.name as string) : null;

      const picture =
        typeof record.picture === "string"
          ? (record.picture as string)
          : typeof record.image_url === "string"
            ? (record.image_url as string)
            : null;

      const provider: AuthProviderId = "clerk";

      return {
        provider,
        externalAuthId: sub,
        email,
        name,
        avatarUrl: picture,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
