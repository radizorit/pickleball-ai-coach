/**
 * Abstraction over durable object storage (R2, S3, GCS, local disk in dev).
 * The upload foundation registers a noop implementation until credentials land.
 */
export const OBJECT_STORAGE_PORT = Symbol("OBJECT_STORAGE_PORT");

export interface ObjectStoragePort {
  /** Stable id for logs / metrics (e.g. `noop`, `r2`). */
  readonly providerId: string;

  /** True when presigned uploads or server-side writes are configured. */
  isUploadConfigured(): boolean;
}
