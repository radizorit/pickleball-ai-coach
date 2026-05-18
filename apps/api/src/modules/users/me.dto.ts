import { ApiProperty } from "@nestjs/swagger";

import type { UserDTO } from "@pickleball/shared";

export class UserResponseDto implements UserDTO {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ nullable: true })
  externalAuthId!: string | null;

  @ApiProperty({ nullable: true })
  externalAuthProvider!: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ format: "uuid", nullable: true })
  defaultOrgId!: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}
