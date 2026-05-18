import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { serverEnv } from "@/env";
import { createDb, upsertUserFromExternalAuth } from "@pickleball/db";
import { isClerkConfigured } from "@/lib/clerk-config";

interface ClerkEmail {
  id: string;
  email_address: string;
}

interface ClerkUserPayload {
  id: string;
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
}

function primaryEmail(user: ClerkUserPayload): string | null {
  const emails = user.email_addresses ?? [];
  const primaryId = user.primary_email_address_id;
  const primary = emails.find((e) => e.id === primaryId)?.email_address;
  return primary ?? emails[0]?.email_address ?? null;
}

function displayName(user: ClerkUserPayload): string | null {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return null;
}

export async function POST(req: Request) {
  if (!isClerkConfigured()) {
    return NextResponse.json({ message: "Clerk is not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const headerPayload = await headers();

  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ message: "Missing Svix headers" }, { status: 400 });
  }

  let evt: { type: string; data: unknown };
  try {
    const wh = new Webhook(serverEnv.CLERK_WEBHOOK_SECRET);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: unknown };
  } catch {
    return NextResponse.json({ message: "Invalid webhook signature" }, { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const user = evt.data as ClerkUserPayload;
    const email = primaryEmail(user);
    if (!email) {
      return NextResponse.json({ message: "User payload missing email" }, { status: 400 });
    }

    const db = createDb({ url: serverEnv.DATABASE_URL });
    await upsertUserFromExternalAuth(db, {
      externalAuthProvider: "clerk",
      externalAuthId: user.id,
      email,
      name: displayName(user),
      avatarUrl: user.image_url ?? null,
    });
  }

  return NextResponse.json({ received: true });
}
