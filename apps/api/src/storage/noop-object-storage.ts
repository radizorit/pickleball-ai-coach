import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import type {
  ObjectStoragePort,
  PresignedPutRequest,
  PresignedPutResult,
} from "./object-storage.port.js";

@Injectable()
export class NoopObjectStorage implements ObjectStoragePort {
  readonly providerId = "noop";

  isUploadConfigured(): boolean {
    return false;
  }

  async presignPut(_req: PresignedPutRequest): Promise<PresignedPutResult> {
    throw new ServiceUnavailableException(
      "Object storage is not configured (set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_REGION or S3_ENDPOINT).",
    );
  }

  async headObject(_objectKey: string): Promise<{ contentLength: number } | null> {
    return null;
  }
}
