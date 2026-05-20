import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module.js";
import { RalliesController } from "./rallies.controller.js";
import { RalliesService } from "./rallies.service.js";

@Module({
  imports: [UsersModule],
  controllers: [RalliesController],
  providers: [RalliesService],
  exports: [RalliesService],
})
export class RalliesModule {}
