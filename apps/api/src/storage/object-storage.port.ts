/**
 * Abstraction over durable object storage (R2, S3, GCS, local disk in dev).
 */
export const OBJECT_STORAGE_PORT = Symbol("OBJECT_STORAGE_PORT");

export interface PresignedPutRequest {
  objectKey: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds: number;
}

export interface PresignedPutResult {
  method: "PUT";
  url: string;
  /** Headers the browser must send with the PUT (signed). */
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface PresignedGetRequest {
  objectKey: string;
  expiresInSeconds: number;
  /** Optional S3 override so browsers get a correct `Content-Type` on GET. */
  responseContentType?: string;
}

export interface PresignedGetResult {
  method: "GET";
  url: string;
  expiresAt: string;
}

export interface ObjectStoragePort {
  /** Stable id for logs / metrics (e.g. `noop`, `r2`, `s3`). */
  readonly providerId: string;

  /** True when presigned uploads are available. */
  isUploadConfigured(): boolean;

  presignPut(req: PresignedPutRequest): Promise<PresignedPutResult>;

  /** Short-lived URL for private reads (browser `<video>` / `<img>`). */
  presignGet(req: PresignedGetRequest): Promise<PresignedGetResult>;

  /** Returns object size in bytes, or null if missing / inaccessible. */
  headObject(objectKey: string): Promise<{ contentLength: number } | null>;
}
