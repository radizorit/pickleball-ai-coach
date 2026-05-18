import { ApiProperty } from "@nestjs/swagger";

import type { UserDTO } from "@pickleball/shared";

export class UserResponseDto implements UserDTO {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  externalAuthId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  externalAuthProvider!: string | null;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: String, format: "uuid", nullable: true })
  defaultOrgId!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
