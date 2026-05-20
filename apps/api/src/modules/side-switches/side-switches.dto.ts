import { ApiProperty } from "@nestjs/swagger";
import type { VideoSideSwitchDTO } from "@pickleball/shared";

export class VideoSideSwitchResponseDto implements VideoSideSwitchDTO {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  videoId!: string;

  @ApiProperty({ type: Number })
  timestampSeconds!: number;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  segmentIndex!: number | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
