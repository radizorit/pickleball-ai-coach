import { Module } from "@nestjs/common";

import { RalliesModule } from "../rallies/rallies.module.js";
import { ShotEventsModule } from "../shot-events/shot-events.module.js";
import { SideSwitchesModule } from "../side-switches/side-switches.module.js";
import { SuggestedShotEventsModule } from "../suggested-shot-events/suggested-shot-events.module.js";
import { StorageModule } from "../../storage/storage.module.js";
import { UsersModule } from "../users/users.module.js";
import { VideosController } from "./videos.controller.js";
import { VideosService } from "./videos.service.js";

@Module({
  imports: [
    UsersModule,
    StorageModule,
    RalliesModule,
    ShotEventsModule,
    SideSwitchesModule,
    SuggestedShotEventsModule,
  ],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
