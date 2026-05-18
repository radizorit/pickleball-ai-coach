import { ApiProperty } from "@nestjs/swagger";

import { PROCESSING_STATUSES, VIDEO_PRIVACY } from "@pickleball/shared/constants";
import type { VideoDTO } from "@pickleball/shared";

export class VideoResponseDto implements VideoDTO {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty({ format: "uuid", nullable: true })
  organizationId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  originalFilename!: string | null;

  @ApiProperty({ nullable: true })
  contentType!: string | null;

  @ApiProperty({ nullable: true })
  storageProvider!: string | null;

  @ApiProperty({ nullable: true })
  storageBucket!: string | null;

  @ApiProperty({ nullable: true })
  storageObjectKey!: string | null;

  @ApiProperty({ nullable: true })
  durationSeconds!: number | null;

  @ApiProperty({ nullable: true })
  fps!: number | null;

  @ApiProperty({ nullable: true })
  width!: number | null;

  @ApiProperty({ nullable: true })
  height!: number | null;

  @ApiProperty({ nullable: true })
  fileSizeBytes!: number | null;

  @ApiProperty({ enum: PROCESSING_STATUSES })
  processingStatus!: VideoDTO["processingStatus"];

  @ApiProperty({ nullable: true })
  failureMessage!: string | null;

  @ApiProperty({ enum: VIDEO_PRIVACY })
  privacy!: VideoDTO["privacy"];

  @ApiProperty({ nullable: true })
  matchType!: VideoDTO["matchType"];

  @ApiProperty({ format: "date-time", nullable: true })
  recordedAt!: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
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
