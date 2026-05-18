import type { User } from "@pickleball/db/schema";
import type { UserDTO } from "@pickleball/shared";
import { Injectable } from "@nestjs/common";

import { getDb, upsertUserFromExternalAuth } from "@pickleball/db";

import type { AuthContext } from "../../auth/auth.types.js";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toUserDTO(row: User): UserDTO {
  return {
    id: row.id,
    externalAuthId: row.externalAuthId,
    externalAuthProvider: row.externalAuthProvider,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    defaultOrgId: row.defaultOrgId,
    createdAt: toIso(row.createdAt),
  };
}

@Injectable()
export class UsersService {
  async getMe(auth: AuthContext): Promise<UserDTO> {
    const db = getDb();
    const row = await upsertUserFromExternalAuth(db, {
      externalAuthProvider: auth.provider,
      externalAuthId: auth.externalAuthId,
      email: auth.email,
      name: auth.name,
      avatarUrl: auth.avatarUrl,
    });
    return toUserDTO(row);
  }
}
