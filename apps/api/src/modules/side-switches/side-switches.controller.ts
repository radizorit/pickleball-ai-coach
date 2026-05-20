import { Controller, Delete, Inject, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../../auth/auth.guard.js";
import { CurrentAuth } from "../../auth/current-auth.decorator.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { SideSwitchesService } from "./side-switches.service.js";

@ApiTags("side-switches")
@ApiBearerAuth("access-token")
@UseGuards(AuthGuard)
@Controller("side-switches")
export class SideSwitchesController {
  constructor(@Inject(SideSwitchesService) private readonly sideSwitches: SideSwitchesService) {}

  @Delete(":id")
  @ApiOkResponse({ schema: { type: "object", properties: { ok: { type: "boolean" } } } })
  remove(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<{ ok: true }> {
    return this.sideSwitches.deleteById(auth, id);
  }
}
