import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module.js";
import { ShotEventsController } from "./shot-events.controller.js";
import { ShotEventsService } from "./shot-events.service.js";

@Module({
  imports: [UsersModule],
  controllers: [ShotEventsController],
  providers: [ShotEventsService],
  exports: [ShotEventsService],
})
export class ShotEventsModule {}
