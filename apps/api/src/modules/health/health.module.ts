import { Module } from "@nestjs/common";

import { ApiRootController } from "./api-root.controller.js";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [ApiRootController, HealthController],
})
export class HealthModule {}
