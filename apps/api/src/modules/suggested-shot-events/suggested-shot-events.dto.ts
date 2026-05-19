import { ApiProperty } from "@nestjs/swagger";

import { SUGGESTED_SHOT_SOURCES, SUGGESTED_SHOT_STATUSES } from "@pickleball/shared/constants";
import type { SuggestedShotEventDTO } from "@pickleball/shared";

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

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}

export class ConvertSuggestedShotResponseDto {
  @ApiProperty({ type: () => ShotEventResponseDto })
  shot!: ShotEventResponseDto;

  @ApiProperty({ type: () => SuggestedShotEventResponseDto })
  suggestion!: SuggestedShotEventResponseDto;
}
