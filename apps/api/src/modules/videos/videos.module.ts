import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module.js";
import { VideosController } from "./videos.controller.js";
import { VideosService } from "./videos.service.js";

@Module({
  imports: [UsersModule],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
