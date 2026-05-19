import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import type { UserDTO } from "@pickleball/shared";

import { AuthGuard } from "../../auth/auth.guard.js";
import { CurrentAuth } from "../../auth/current-auth.decorator.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { UserResponseDto } from "./me.dto.js";
import { UsersService } from "./users.service.js";

@ApiTags("me")
@ApiBearerAuth("access-token")
@UseGuards(AuthGuard)
@Controller("me")
export class MeController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@CurrentAuth() auth: AuthContext): Promise<UserDTO> {
    return this.users.getMe(auth);
  }

  @Get("ping")
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean", example: true },
        externalAuthId: { type: "string" },
      },
    },
  })
  ping(@CurrentAuth() auth: AuthContext): { ok: true; externalAuthId: string } {
    return { ok: true, externalAuthId: auth.externalAuthId };
  }
}
