import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { SuggestedShotEventDTO } from "@pickleball/shared";
import { zUpdateSuggestedShotBody } from "@pickleball/shared/zod";

import { AuthGuard } from "../../auth/auth.guard.js";
import { CurrentAuth } from "../../auth/current-auth.decorator.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { SuggestedShotEventResponseDto } from "./suggested-shot-events.dto.js";
import { SuggestedShotEventsService } from "./suggested-shot-events.service.js";

@ApiTags("suggested-shot-events")
@ApiBearerAuth("access-token")
@UseGuards(AuthGuard)
@Controller("suggested-shot-events")
export class SuggestedShotEventsController {
  constructor(
    @Inject(SuggestedShotEventsService) private readonly suggestedShots: SuggestedShotEventsService,
  ) {}

  @Patch(":id")
  @ApiOkResponse({ type: SuggestedShotEventResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["status"],
      properties: { status: { type: "string", enum: ["rejected"] } },
    },
  })
  reject(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<SuggestedShotEventDTO> {
    const parsed = zUpdateSuggestedShotBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.suggestedShots.rejectSuggestion(auth, id);
  }
}
