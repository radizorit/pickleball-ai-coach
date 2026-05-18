import "./boot-env.js";
import "reflect-metadata";

import { Logger, ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { loadEnv } from "./env.js";

async function bootstrap() {
  const env = loadEnv();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(new Logger());
  app.use(helmet());

  app.enableCors({
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: false,
  });

  // `/v1/*` for all routes via URI versioning. We deliberately don't also
  // set a global prefix — `enableVersioning` with `URI` already prepends
  // `v1`. Adding both produces `/v1/v1/...` and silently 404s.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "v",
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // OpenAPI: served at /docs (interactive) and /docs-json (machine-readable
  // for future client codegen).
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Pickleball Assistant API")
    .setDescription("REST API for the Pickleball Assistant platform.")
    .setVersion("0.1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header", name: "Authorization" },
      "access-token",
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
  });

  app.enableShutdownHooks();

  await app.listen(env.PORT, "0.0.0.0");
  Logger.log(`API ready on http://localhost:${env.PORT}/v1 (docs at /docs)`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error("Fatal: API failed to start", err);
  process.exit(1);
});
