import { Global, Module } from "@nestjs/common";

import { loadEnv } from "../env.js";

import { NoopObjectStorage } from "./noop-object-storage.js";
import { OBJECT_STORAGE_PORT } from "./object-storage.port.js";
import { S3ObjectStorage } from "./s3-object-storage.js";

function isS3Configured(): boolean {
  const env = loadEnv();
  return !!(
    env.S3_BUCKET &&
    env.S3_ACCESS_KEY_ID &&
    env.S3_SECRET_ACCESS_KEY &&
    (env.S3_REGION || env.S3_ENDPOINT)
  );
}

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE_PORT,
      useFactory: () => {
        if (isS3Configured()) {
          return new S3ObjectStorage(loadEnv());
        }
        return new NoopObjectStorage();
      },
    },
  ],
  exports: [OBJECT_STORAGE_PORT],
})
export class StorageModule {}
