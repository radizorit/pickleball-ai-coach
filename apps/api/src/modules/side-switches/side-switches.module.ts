import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module.js";
import { SideSwitchesController } from "./side-switches.controller.js";
import { SideSwitchesService } from "./side-switches.service.js";

@Module({
  imports: [UsersModule],
  controllers: [SideSwitchesController],
  providers: [SideSwitchesService],
  exports: [SideSwitchesService],
})
export class SideSwitchesModule {}
