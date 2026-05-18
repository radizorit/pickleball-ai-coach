import { Controller, Get, NotImplementedException, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * Stub controller. Documents the future shape of the videos resource on the
 * OpenAPI spec without committing to an implementation yet.
 */
@ApiTags("videos")
@Controller("videos")
export class VideosController {
  @Get()
  list() {
    throw new NotImplementedException(
      "Video listing is not implemented yet (Phase 2: upload + listing).",
    );
  }

  @Get(":id")
  get(@Param("id") _id: string) {
    throw new NotImplementedException(
      "Video detail is not implemented yet (Phase 2: upload + listing).",
    );
  }
}
