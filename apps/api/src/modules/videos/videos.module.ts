import { Module } from "@nestjs/common";

import { VideosController } from "./videos.controller.js";

/**
 * Foundation placeholder. Endpoints exist so the OpenAPI surface is real,
 * but they return 501 until the upload flow lands in Phase 2.
 */
@Module({
  controllers: [VideosController],
})
export class VideosModule {}
