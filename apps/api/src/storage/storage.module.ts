import { Global, Module } from "@nestjs/common";

import { NoopObjectStorage } from "./noop-object-storage.js";
import { OBJECT_STORAGE_PORT } from "./object-storage.port.js";

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE_PORT,
      useClass: NoopObjectStorage,
    },
  ],
  exports: [OBJECT_STORAGE_PORT],
})
export class StorageModule {}
