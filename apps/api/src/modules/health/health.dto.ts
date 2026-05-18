import { ApiProperty } from "@nestjs/swagger";

import type { HealthResponse } from "@pickleball/shared";

/**
 * Class-based DTO purely so `@nestjs/swagger` can introspect the OpenAPI
 * schema. The runtime shape is identical to `HealthResponse` from shared.
 */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ["ok"] })
  status!: "ok";

  @ApiProperty()
  service!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  uptimeSeconds!: number;

  @ApiProperty({ format: "date-time" })
  timestamp!: string;
}
