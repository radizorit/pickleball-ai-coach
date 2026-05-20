import { ApiProperty } from "@nestjs/swagger";

import { RALLY_END_REASONS, VIDEO_PLAYER_SLOTS } from "@pickleball/shared/constants";
import type {
  RallyConsistencyStatsDTO,
  SuggestedRallyDTO,
  VideoPlayerDTO,
  VideoRallyDTO,
} from "@pickleball/shared";
import { SUGGESTED_SHOT_STATUSES } from "@pickleball/shared/constants";

export class VideoPlayerResponseDto implements VideoPlayerDTO {
  @ApiProperty({ type: String, format: "uuid" })
  videoId!: string;

  @ApiProperty({ enum: VIDEO_PLAYER_SLOTS })
  slot!: VideoPlayerDTO["slot"];

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;
}

export class VideoRallyResponseDto implements VideoRallyDTO {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  videoId!: string;

  @ApiProperty({ type: Number })
  startTimeSeconds!: number;

  @ApiProperty({ type: Number, nullable: true })
  endTimeSeconds!: number | null;

  @ApiProperty({ enum: VIDEO_PLAYER_SLOTS, nullable: true })
  winningPlayerSlot!: VideoRallyDTO["winningPlayerSlot"];

  @ApiProperty({ enum: RALLY_END_REASONS, nullable: true })
  endReason!: VideoRallyDTO["endReason"];

  @ApiProperty({ type: Number })
  shotCount!: number;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}

/** Plain object schema — avoids Swagger circular refs from `Record<VideoPlayerSlot, number>`. */
class PlayerSlotCountMapSchema {
  @ApiProperty({ type: Number })
  player_1!: number;

  @ApiProperty({ type: Number })
  player_2!: number;

  @ApiProperty({ type: Number })
  player_3!: number;

  @ApiProperty({ type: Number })
  player_4!: number;
}

export class SuggestedRallyResponseDto implements SuggestedRallyDTO {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  videoId!: string;

  @ApiProperty({ type: Number })
  proposalIndex!: number;

  @ApiProperty({ type: Number })
  startTimeSeconds!: number;

  @ApiProperty({ type: Number })
  endTimeSeconds!: number;

  @ApiProperty({ type: Number })
  confidence!: number;

  @ApiProperty({ enum: SUGGESTED_SHOT_STATUSES })
  status!: SuggestedRallyDTO["status"];

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}

export class AcceptSuggestedRallyResponseDto {
  @ApiProperty({ type: () => VideoRallyResponseDto })
  rally!: VideoRallyDTO;

  @ApiProperty({ type: () => SuggestedRallyResponseDto })
  suggestion!: SuggestedRallyDTO;
}

export class RallyConsistencyStatsResponseDto implements RallyConsistencyStatsDTO {
  @ApiProperty({ type: Number })
  closedRallyCount!: number;

  @ApiProperty({ type: Number })
  openRallyCount!: number;

  @ApiProperty({ type: Number, nullable: true })
  averageRallyLength!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  longestRallyLength!: number | null;

  @ApiProperty({ type: [Number] })
  shotsBeforeError!: number[];

  @ApiProperty({ type: [Number] })
  shotsBeforeWinner!: number[];

  @ApiProperty({ type: () => PlayerSlotCountMapSchema })
  playerWinnerCounts!: RallyConsistencyStatsDTO["playerWinnerCounts"];

  @ApiProperty({ type: () => PlayerSlotCountMapSchema })
  playerErrorCounts!: RallyConsistencyStatsDTO["playerErrorCounts"];
}
