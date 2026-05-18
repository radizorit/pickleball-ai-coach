import { ApiProperty } from "@nestjs/swagger";

import type { HealthResponse } from "@pickleball/shared";

/**
 * Class-based DTO purely so `@nestjs/swagger` can introspect the OpenAPI
 * schema. The runtime shape is identical to `HealthResponse` from shared.
 */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ["ok"] })
  status!: "ok";

  /** Explicit `type` avoids Swagger mis-inferring `service` as a circular class ref. */
  @ApiProperty({ type: String, example: "api" })
  service!: string;

  @ApiProperty({ type: String, example: "0.1.0" })
  version!: string;

  @ApiProperty({ type: Number, example: 12.34 })
  uptimeSeconds!: number;

  @ApiProperty({ type: String, format: "date-time" })
  timestamp!: string;
}
