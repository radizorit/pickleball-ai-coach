import { Module } from "@nestjs/common";

import { ShotEventsModule } from "../shot-events/shot-events.module.js";
import { UsersModule } from "../users/users.module.js";
import { SuggestedShotEventsController } from "./suggested-shot-events.controller.js";
import { SuggestedShotEventsService } from "./suggested-shot-events.service.js";

@Module({
  imports: [UsersModule, ShotEventsModule],
  controllers: [SuggestedShotEventsController],
  providers: [SuggestedShotEventsService],
  exports: [SuggestedShotEventsService],
})
export class SuggestedShotEventsModule {}
