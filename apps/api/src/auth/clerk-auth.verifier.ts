import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createClerkClient, verifyToken } from "@clerk/backend";

import type { AuthContext, AuthProviderId } from "./auth.types.js";
import type { AuthPort } from "./auth.port.js";
import { loadEnv } from "../env.js";

function emailFromJwtPayload(record: Record<string, unknown>): string | null {
  if (typeof record.email === "string") return record.email;
  if (typeof record.primary_email_address === "string") {
    return record.primary_email_address as string;
  }
  return null;
}

function emailFromClerkUser(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
}): string | null {
  const primaryId = user.primaryEmailAddressId;
  const list = user.emailAddresses ?? [];
  const primary = primaryId ? list.find((e) => e.id === primaryId)?.emailAddress : null;
  return primary ?? list[0]?.emailAddress ?? null;
}

@Injectable()
export class ClerkAuthVerifier implements AuthPort {
  private readonly secretKey: string;
  private readonly clerkClient: ReturnType<typeof createClerkClient>;

  constructor() {
    this.secretKey = loadEnv().CLERK_SECRET_KEY;
    this.clerkClient = createClerkClient({ secretKey: this.secretKey });
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

      let email = emailFromJwtPayload(record);

      if (!email) {
        try {
          const user = await this.clerkClient.users.getUser(sub);
          email = emailFromClerkUser(user);
        } catch {
          email = null;
        }
      }

      if (!email) {
        throw new UnauthorizedException(
          "Invalid token: missing email (add email to the Clerk session token under Sessions → Customize session token, or ensure the user has an email in Clerk)",
        );
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
