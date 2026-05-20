import { ApiProperty } from "@nestjs/swagger";

import { PROCESSING_STATUSES, SHOT_OUTCOMES, SHOT_SIDES, SHOT_TYPES, SUGGESTED_SHOT_SOURCES, SUGGESTED_SHOT_STATUSES } from "@pickleball/shared/constants";
import type { VideoTrainingExportDTO, VideoTrainingExportRow, VideoTrainingExportVideoMeta } from "@pickleball/shared";

export class VideoTrainingExportVideoMetaDto implements VideoTrainingExportVideoMeta {
  @ApiProperty({ type: String, format: "uuid" })
  videoId!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: Number, nullable: true })
  durationSeconds!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  fps!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;

  @ApiProperty({ type: String, nullable: true })
  contentType!: string | null;

  @ApiProperty({ type: String, nullable: true })
  originalFilename!: string | null;

  @ApiProperty({ enum: PROCESSING_STATUSES })
  processingStatus!: VideoTrainingExportVideoMeta["processingStatus"];

  @ApiProperty({ type: String, nullable: true })
  youtubeUrl!: string | null;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  recordedAt!: string | null;
}

export class VideoTrainingExportRowDto implements VideoTrainingExportRow {
  @ApiProperty({ type: String, format: "uuid" })
  suggestionId!: string;

  @ApiProperty({ type: Number })
  suggestionTimestampSeconds!: number;

  @ApiProperty({ type: Number, minimum: 0, maximum: 1 })
  confidence!: number;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  audioPeak!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  motionScore!: number | null;

  @ApiProperty({ enum: SUGGESTED_SHOT_STATUSES })
  suggestionStatus!: VideoTrainingExportRow["suggestionStatus"];

  @ApiProperty({ enum: SUGGESTED_SHOT_SOURCES })
  suggestionSource!: VideoTrainingExportRow["suggestionSource"];

  @ApiProperty({ type: Boolean })
  becameConfirmedShot!: boolean;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  confirmedShotEventId!: string | null;

  @ApiProperty({ enum: SHOT_TYPES, nullable: true })
  confirmedShotType!: VideoTrainingExportRow["confirmedShotType"];

  @ApiProperty({ enum: SHOT_SIDES, nullable: true })
  confirmedSide!: VideoTrainingExportRow["confirmedSide"];

  @ApiProperty({ enum: SHOT_OUTCOMES, nullable: true })
  confirmedOutcome!: VideoTrainingExportRow["confirmedOutcome"];

  @ApiProperty({ type: String, nullable: true })
  pipelineVersion!: string | null;
}

export class VideoTrainingExportResponseDto implements VideoTrainingExportDTO {
  @ApiProperty({ type: String, example: "1" })
  schemaVersion!: string;

  @ApiProperty({ type: String, format: "date-time" })
  exportedAt!: string;

  @ApiProperty({ type: () => VideoTrainingExportVideoMetaDto })
  video!: VideoTrainingExportVideoMetaDto;

  @ApiProperty({ type: () => VideoTrainingExportRowDto, isArray: true })
  rows!: VideoTrainingExportRowDto[];
}
