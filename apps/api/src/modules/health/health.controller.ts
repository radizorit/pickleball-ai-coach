import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import type { HealthResponse } from "@pickleball/shared";

import { HealthResponseDto } from "./health.dto.js";

const startedAt = Date.now();

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  get(): HealthResponse {
    return {
      status: "ok",
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0",
      uptimeSeconds: (Date.now() - startedAt) / 1000,
      timestamp: new Date().toISOString(),
    };
  }
}
