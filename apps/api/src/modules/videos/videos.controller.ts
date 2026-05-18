import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { VideoDTO } from "@pickleball/shared";
import { zCreateVideoBody } from "@pickleball/shared/zod";

import { AuthGuard } from "../../auth/auth.guard.js";
import { CurrentAuth } from "../../auth/current-auth.decorator.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { VideoResponseDto } from "./videos.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest injects VideosService by class reference
import { VideosService } from "./videos.service.js";

@ApiTags("videos")
@ApiBearerAuth("access-token")
@UseGuards(AuthGuard)
@Controller("videos")
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  @ApiOkResponse({ type: VideoResponseDto, isArray: true })
  list(@CurrentAuth() auth: AuthContext): Promise<VideoDTO[]> {
    return this.videos.listForUser(auth);
  }

  @Post()
  @ApiOkResponse({ type: VideoResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", nullable: true },
        privacy: { type: "string", enum: ["private", "unlisted", "shared"] },
        originalFilename: { type: "string", nullable: true },
        contentType: {
          type: "string",
          nullable: true,
          enum: ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
        },
      },
    },
  })
  create(@CurrentAuth() auth: AuthContext, @Body() body: unknown): Promise<VideoDTO> {
    const parsed = zCreateVideoBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.videos.create(auth, parsed.data);
  }

  @Get(":id")
  @ApiOkResponse({ type: VideoResponseDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<VideoDTO> {
    return this.videos.getForUser(auth, id);
  }
}
