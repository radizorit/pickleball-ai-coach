import { ApiProperty } from "@nestjs/swagger";

import { SHOT_EVENT_SOURCES, SHOT_OUTCOMES, SHOT_SIDES, SHOT_TYPES } from "@pickleball/shared/constants";
import type { ShotEventDTO } from "@pickleball/shared";

export class ShotEventResponseDto implements ShotEventDTO {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  videoId!: string;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  rallyId!: string | null;

  @ApiProperty({ type: Number })
  timestampSeconds!: number;

  @ApiProperty({ enum: SHOT_TYPES })
  shotType!: ShotEventDTO["shotType"];

  @ApiProperty({ enum: SHOT_SIDES })
  side!: ShotEventDTO["side"];

  @ApiProperty({ enum: SHOT_OUTCOMES })
  outcome!: ShotEventDTO["outcome"];

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ enum: SHOT_EVENT_SOURCES })
  source!: ShotEventDTO["source"];

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  suggestedShotEventId!: string | null;

  @ApiProperty({ type: String, format: "uuid" })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}
