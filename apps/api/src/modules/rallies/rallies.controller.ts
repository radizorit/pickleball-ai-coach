import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { VideoRallyDTO } from "@pickleball/shared";
import { zUpdateRallyBody } from "@pickleball/shared/zod";

import { AuthGuard } from "../../auth/auth.guard.js";
import { CurrentAuth } from "../../auth/current-auth.decorator.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { VideoRallyResponseDto } from "./rallies.dto.js";
import { RalliesService } from "./rallies.service.js";

@ApiTags("rallies")
@ApiBearerAuth("access-token")
@UseGuards(AuthGuard)
@Controller("rallies")
export class RalliesController {
  constructor(@Inject(RalliesService) private readonly rallies: RalliesService) {}

  @Patch(":rallyId")
  @ApiOkResponse({ type: VideoRallyResponseDto })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("rallyId", new ParseUUIDPipe()) rallyId: string,
    @Body() body: unknown,
  ): Promise<VideoRallyDTO> {
    const parsed = zUpdateRallyBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.rallies.updateRally(auth, rallyId, parsed.data);
  }

  @Delete(":rallyId")
  @ApiOkResponse({ schema: { type: "object", properties: { ok: { type: "boolean" } } } })
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param("rallyId", new ParseUUIDPipe()) rallyId: string,
  ): Promise<{ ok: true }> {
    await this.rallies.deleteRally(auth, rallyId);
    return { ok: true };
  }
}
