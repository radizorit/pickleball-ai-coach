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
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { ShotEventDTO } from "@pickleball/shared";
import { SHOT_OUTCOMES, SHOT_SIDES, SHOT_TYPES, VIDEO_PLAYER_SLOTS } from "@pickleball/shared/constants";
import { zUpdateShotEventBody } from "@pickleball/shared/zod";

import { AuthGuard } from "../../auth/auth.guard.js";
import { CurrentAuth } from "../../auth/current-auth.decorator.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { ShotEventResponseDto } from "./shot-events.dto.js";
import { ShotEventsService } from "./shot-events.service.js";

@ApiTags("shot-events")
@ApiBearerAuth("access-token")
@UseGuards(AuthGuard)
@Controller("shot-events")
export class ShotEventsController {
  constructor(@Inject(ShotEventsService) private readonly shotEvents: ShotEventsService) {}

  @Patch(":eventId")
  @ApiOkResponse({ type: ShotEventResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        timestampSeconds: { type: "number", minimum: 0 },
        shotType: { type: "string", enum: [...SHOT_TYPES] },
        side: { type: "string", enum: [...SHOT_SIDES] },
        outcome: { type: "string", enum: [...SHOT_OUTCOMES] },
        note: { type: "string", nullable: true },
        rallyId: { type: "string", format: "uuid", nullable: true },
        playerSlot: { type: "string", enum: [...VIDEO_PLAYER_SLOTS], nullable: true },
        endsRally: { type: "boolean" },
      },
    },
  })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @Body() body: unknown,
  ): Promise<ShotEventDTO> {
    const parsed = zUpdateShotEventBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.shotEvents.updateEvent(auth, eventId, parsed.data);
  }

  @Delete(":eventId")
  @ApiOkResponse({ schema: { type: "object", properties: { ok: { type: "boolean" } } } })
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
  ): Promise<{ ok: true }> {
    await this.shotEvents.deleteEvent(auth, eventId);
    return { ok: true };
  }
}
