import { Module } from "@nestjs/common";

import { ShotEventsModule } from "../shot-events/shot-events.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { UsersModule } from "../users/users.module.js";
import { VideosController } from "./videos.controller.js";
import { VideosService } from "./videos.service.js";

@Module({
  imports: [UsersModule, StorageModule, ShotEventsModule],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
