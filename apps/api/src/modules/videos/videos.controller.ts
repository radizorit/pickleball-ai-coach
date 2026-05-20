import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type {
  RallyConsistencyStatsDTO,
  ShotEventDTO,
  SuggestedShotEventDTO,
  SuggestedShotRegenerateSummaryDTO,
  SuggestedShotStatsDTO,
  VideoDTO,
  VideoPlayerDTO,
  VideoRallyDTO,
  VideoTrainingExportDTO,
  VideoPresignedReadDTO,
  VideoPresignedUploadDTO,
} from "@pickleball/shared";
import {
  SHOT_OUTCOMES,
  SHOT_SIDES,
  SHOT_TYPES,
  SUGGESTED_SHOT_STATUSES,
  VIDEO_PLAYER_SLOTS,
} from "@pickleball/shared/constants";
import {
  zConvertSuggestedShotBatchBody,
  zConvertSuggestedShotBody,
  zCreateRallyBody,
  zCreateShotEventBody,
  zCreateVideoBody,
  zPresignVideoUploadBody,
  zSuggestedShotListFilter,
  zUpsertVideoPlayersBody,
  zVideoReadAsset,
} from "@pickleball/shared/zod";

import { AuthGuard } from "../../auth/auth.guard.js";
import { CurrentAuth } from "../../auth/current-auth.decorator.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  RallyConsistencyStatsResponseDto,
  VideoPlayerResponseDto,
  VideoRallyResponseDto,
} from "../rallies/rallies.dto.js";
import { RalliesService } from "../rallies/rallies.service.js";
import { ShotEventResponseDto } from "../shot-events/shot-events.dto.js";
import { ShotEventsService } from "../shot-events/shot-events.service.js";
import {
  ConvertSuggestedShotBatchResponseDto,
  ConvertSuggestedShotResponseDto,
  SuggestedShotEventResponseDto,
  SuggestedShotRegenerateSummaryResponseDto,
  SuggestedShotStatsResponseDto,
} from "../suggested-shot-events/suggested-shot-events.dto.js";
import { VideoTrainingExportResponseDto } from "../suggested-shot-events/training-export.dto.js";
import { SuggestedShotEventsService } from "../suggested-shot-events/suggested-shot-events.service.js";
import {
  VideoPresignedReadResponseDto,
  VideoPresignedUploadResponseDto,
  VideoResponseDto,
} from "./videos.dto.js";
import { VideosService } from "./videos.service.js";

@ApiTags("videos")
@ApiBearerAuth("access-token")
@UseGuards(AuthGuard)
@Controller("videos")
export class VideosController {
  constructor(
    @Inject(VideosService) private readonly videosService: VideosService,
    @Inject(RalliesService) private readonly rallies: RalliesService,
    @Inject(ShotEventsService) private readonly shotEvents: ShotEventsService,
    @Inject(SuggestedShotEventsService) private readonly suggestedShots: SuggestedShotEventsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: VideoResponseDto, isArray: true })
  list(@CurrentAuth() auth: AuthContext): Promise<VideoDTO[]> {
    return this.videosService.listForUser(auth);
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
        youtubeUrl: {
          type: "string",
          format: "uri",
          description: "When set, creates a YouTube-embed-only video (ready immediately; no upload).",
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
    return this.videosService.create(auth, parsed.data);
  }

  @Post(":id/presign")
  @ApiOkResponse({ type: VideoPresignedUploadResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["contentType", "fileSizeBytes", "originalFilename"],
      properties: {
        contentType: {
          type: "string",
          enum: ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
        },
        fileSizeBytes: { type: "integer", minimum: 1 },
        originalFilename: { type: "string", minLength: 1, maxLength: 512 },
      },
    },
  })
  presign(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<VideoPresignedUploadDTO> {
    const parsed = zPresignVideoUploadBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.videosService.presignUpload(auth, id, parsed.data);
  }

  @Post(":id/complete-upload")
  @ApiOkResponse({ type: VideoResponseDto })
  complete(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<VideoDTO> {
    return this.videosService.completeUpload(auth, id);
  }

  @Get(":id/read-url")
  @ApiQuery({
    name: "asset",
    required: true,
    enum: ["source", "thumbnail"],
    description: "`source` = original upload; `thumbnail` = poster JPEG (only when `ready`).",
  })
  @ApiOkResponse({ type: VideoPresignedReadResponseDto })
  presignRead(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("asset") assetRaw: string,
  ): Promise<VideoPresignedReadDTO> {
    const parsed = zVideoReadAsset.safeParse(assetRaw);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Invalid or missing asset query (use source or thumbnail).",
        details: parsed.error.flatten(),
      });
    }
    return this.videosService.presignReadForUser(auth, id, parsed.data);
  }

  @Get(":id/players")
  @ApiOkResponse({ type: VideoPlayerResponseDto, isArray: true })
  listPlayers(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<VideoPlayerDTO[]> {
    return this.rallies.listPlayers(auth, id);
  }

  @Put(":id/players")
  @ApiOkResponse({ type: VideoPlayerResponseDto, isArray: true })
  upsertPlayers(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<VideoPlayerDTO[]> {
    const parsed = zUpsertVideoPlayersBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.rallies.upsertPlayers(auth, id, parsed.data);
  }

  @Get(":id/rallies")
  @ApiOkResponse({ type: VideoRallyResponseDto, isArray: true })
  listRallies(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<VideoRallyDTO[]> {
    return this.rallies.listRallies(auth, id);
  }

  @Post(":id/rallies")
  @ApiOkResponse({ type: VideoRallyResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["startTimeSeconds"],
      properties: {
        startTimeSeconds: { type: "number", minimum: 0 },
        endTimeSeconds: { type: "number", minimum: 0, nullable: true },
      },
    },
  })
  createRally(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<VideoRallyDTO> {
    const parsed = zCreateRallyBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.rallies.createRally(auth, id, parsed.data);
  }

  @Get(":id/rally-consistency")
  @ApiOkResponse({ type: RallyConsistencyStatsResponseDto })
  rallyConsistency(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<RallyConsistencyStatsDTO> {
    return this.rallies.consistencyForVideo(auth, id);
  }

  @Get(":id/shot-events")
  @ApiOkResponse({ type: ShotEventResponseDto, isArray: true })
  listShotEvents(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<ShotEventDTO[]> {
    return this.shotEvents.listForVideo(auth, id);
  }

  @Post(":id/shot-events")
  @ApiOkResponse({ type: ShotEventResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["timestampSeconds", "shotType", "side", "outcome"],
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
  createShotEvent(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<ShotEventDTO> {
    const parsed = zCreateShotEventBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.shotEvents.createForVideo(auth, id, parsed.data);
  }

  @Get(":id/suggested-shot-events/stats")
  @ApiOkResponse({ type: SuggestedShotStatsResponseDto })
  suggestedShotEventsStats(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<SuggestedShotStatsDTO> {
    return this.suggestedShots.statsForVideo(auth, id);
  }

  @Post(":id/suggested-shot-events/regenerate")
  @ApiOkResponse({ type: SuggestedShotRegenerateSummaryResponseDto })
  regenerateSuggestedShotEvents(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<SuggestedShotRegenerateSummaryDTO> {
    return this.suggestedShots.regenerateForVideo(auth, id);
  }

  @Post(":id/suggested-shot-events/convert-batch")
  @ApiOkResponse({ type: ConvertSuggestedShotBatchResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["minConfidence"],
      properties: { minConfidence: { type: "number", minimum: 0, maximum: 1 } },
    },
  })
  convertSuggestedShotEventsBatch(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<{ converted: ShotEventDTO[]; skipped: number }> {
    const parsed = zConvertSuggestedShotBatchBody.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.suggestedShots.convertBatch(auth, id, parsed.data);
  }

  @Get(":id/suggested-shot-events")
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filter by suggestion status. Omit for `suggested` only.",
    enum: [...SUGGESTED_SHOT_STATUSES, "all"],
  })
  @ApiOkResponse({ type: SuggestedShotEventResponseDto, isArray: true })
  listSuggestedShotEvents(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("status") statusRaw?: string,
  ): Promise<SuggestedShotEventDTO[]> {
    const effective = statusRaw === undefined || statusRaw === "" ? "suggested" : statusRaw;
    const parsed = zSuggestedShotListFilter.safeParse(effective);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Invalid status filter",
        details: parsed.error.flatten(),
      });
    }
    return this.suggestedShots.listForVideo(auth, id, parsed.data);
  }

  @Post(":id/suggested-shot-events/:suggestionId/convert")
  @ApiOkResponse({ type: ConvertSuggestedShotResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        shotType: { type: "string", enum: [...SHOT_TYPES] },
        side: { type: "string", enum: [...SHOT_SIDES] },
        outcome: { type: "string", enum: [...SHOT_OUTCOMES] },
        note: { type: "string", nullable: true },
      },
    },
  })
  convertSuggestedShotEvent(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("suggestionId", new ParseUUIDPipe()) suggestionId: string,
    @Body() body: unknown,
  ): Promise<{ shot: ShotEventDTO; suggestion: SuggestedShotEventDTO }> {
    const parsed = zConvertSuggestedShotBody.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    return this.suggestedShots.convertSuggestion(auth, id, suggestionId, parsed.data);
  }

  @Get(":id/training-export")
  @ApiOkResponse({ type: VideoTrainingExportResponseDto })
  trainingExport(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<VideoTrainingExportDTO> {
    return this.suggestedShots.trainingExportForVideo(auth, id);
  }

  @Get(":id")
  @ApiOkResponse({ type: VideoResponseDto })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<VideoDTO> {
    return this.videosService.getForUser(auth, id);
  }
}
