import { ApiProperty } from "@nestjs/swagger";

import { SUGGESTED_SHOT_SOURCES, SUGGESTED_SHOT_STATUSES } from "@pickleball/shared/constants";
import type {
  SuggestedShotEventDTO,
  SuggestedShotRegenerateSummaryDTO,
  SuggestedShotStatsDTO,
} from "@pickleball/shared";

import { ShotEventResponseDto } from "../shot-events/shot-events.dto.js";

export class SuggestedShotEventResponseDto implements SuggestedShotEventDTO {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  videoId!: string;

  @ApiProperty({ type: Number })
  timestampSeconds!: number;

  @ApiProperty({ type: Number, minimum: 0, maximum: 1 })
  confidence!: number;

  @ApiProperty({ enum: SUGGESTED_SHOT_SOURCES })
  source!: SuggestedShotEventDTO["source"];

  @ApiProperty({ enum: SUGGESTED_SHOT_STATUSES })
  status!: SuggestedShotEventDTO["status"];

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  audioPeak!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  motionScore!: number | null;

  @ApiProperty({ type: Object, nullable: true })
  debugMetadata!: SuggestedShotEventDTO["debugMetadata"];

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}

export class SuggestedShotStatsResponseDto implements SuggestedShotStatsDTO {
  @ApiProperty({ type: Number })
  suggested!: number;

  @ApiProperty({ type: Number })
  accepted!: number;

  @ApiProperty({ type: Number })
  rejected!: number;

  @ApiProperty({ type: Number, nullable: true })
  avgConfidenceSuggested!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  avgConfidenceAccepted!: number | null;
}

export class ConvertSuggestedShotResponseDto {
  @ApiProperty({ type: () => ShotEventResponseDto })
  shot!: ShotEventResponseDto;

  @ApiProperty({ type: () => SuggestedShotEventResponseDto })
  suggestion!: SuggestedShotEventResponseDto;
}

export class SuggestedShotRegenerateSummaryResponseDto implements SuggestedShotRegenerateSummaryDTO {
  @ApiProperty({ type: Number })
  generatedCount!: number;

  @ApiProperty({ type: Number, minimum: 0, maximum: 1 })
  averageConfidence!: number;

  @ApiProperty({ type: Number })
  pendingCount!: number;

  @ApiProperty({ type: Number })
  acceptedCount!: number;

  @ApiProperty({ type: Number })
  rejectedCount!: number;
}

export class ConvertSuggestedShotBatchResponseDto {
  @ApiProperty({ type: () => ShotEventResponseDto, isArray: true })
  converted!: ShotEventResponseDto[];

  @ApiProperty({ type: Number })
  skipped!: number;
}
