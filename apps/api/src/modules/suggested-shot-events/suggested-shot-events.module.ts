import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module.js";
import { SuggestedShotEventsController } from "./suggested-shot-events.controller.js";
import { SuggestedShotEventsService } from "./suggested-shot-events.service.js";

@Module({
  imports: [UsersModule],
  controllers: [SuggestedShotEventsController],
  providers: [SuggestedShotEventsService],
  exports: [SuggestedShotEventsService],
})
export class SuggestedShotEventsModule {}
