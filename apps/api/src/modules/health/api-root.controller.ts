import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("meta")
@Controller()
export class ApiRootController {
  /** `GET /v1` — discovery payload (not a data API). */
  @Get()
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        service: { type: "string" },
        version: { type: "string" },
        links: {
          type: "object",
          properties: {
            health: { type: "string" },
            docs: { type: "string" },
            videos: { type: "string" },
          },
        },
      },
    },
  })
  get(): { service: string; version: string; links: Record<string, string> } {
    return {
      service: "pickleball-api",
      version: "1",
      links: {
        health: "/v1/health",
        docs: "/docs",
        videos: "/v1/videos",
      },
    };
  }
}
