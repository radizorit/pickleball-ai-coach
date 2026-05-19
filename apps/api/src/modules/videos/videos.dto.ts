import { ApiProperty } from "@nestjs/swagger";

import { PROCESSING_STATUSES, VIDEO_PRIVACY } from "@pickleball/shared/constants";
import type { VideoDTO, VideoPresignedReadDTO } from "@pickleball/shared";

export class VideoResponseDto implements VideoDTO {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  userId!: string;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  organizationId!: string | null;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "When set, playback uses YouTube embed (no signed S3 source URL).",
  })
  youtubeUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  originalFilename!: string | null;

  @ApiProperty({ type: String, nullable: true })
  contentType!: string | null;

  @ApiProperty({ type: String, nullable: true })
  storageProvider!: string | null;

  @ApiProperty({ type: String, nullable: true })
  storageBucket!: string | null;

  @ApiProperty({ type: String, nullable: true })
  storageObjectKey!: string | null;

  @ApiProperty({ type: String, nullable: true })
  thumbnailObjectKey!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  durationSeconds!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  fps!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  fileSizeBytes!: number | null;

  @ApiProperty({ enum: PROCESSING_STATUSES })
  processingStatus!: VideoDTO["processingStatus"];

  @ApiProperty({ type: String, nullable: true })
  failureMessage!: string | null;

  @ApiProperty({ enum: VIDEO_PRIVACY })
  privacy!: VideoDTO["privacy"];

  @ApiProperty({ type: String, nullable: true })
  matchType!: VideoDTO["matchType"];

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  recordedAt!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}

export class VideoPresignedUploadResponseDto {
  @ApiProperty({
    type: "object",
    properties: {
      method: { type: "string", example: "PUT" },
      url: { type: "string" },
      requiredHeaders: { type: "object", additionalProperties: { type: "string" } },
      expiresAt: { type: "string", format: "date-time" },
    },
  })
  upload!: {
    method: "PUT";
    url: string;
    requiredHeaders: Record<string, string>;
    expiresAt: string;
  };

  @ApiProperty({ type: () => VideoResponseDto })
  video!: VideoResponseDto;
}

export class VideoPresignedReadResponseDto implements VideoPresignedReadDTO {
  @ApiProperty({ type: String, description: "Time-limited signed GET URL" })
  url!: string;

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt!: string;
}
