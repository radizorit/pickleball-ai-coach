import { Injectable } from "@nestjs/common";

import type { ObjectStoragePort } from "./object-storage.port.js";

@Injectable()
export class NoopObjectStorage implements ObjectStoragePort {
  readonly providerId = "noop";

  isUploadConfigured(): boolean {
    return false;
  }
}
