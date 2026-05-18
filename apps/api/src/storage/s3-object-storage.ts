import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";

import type { ApiEnv } from "../env.js";

import type {
  ObjectStoragePort,
  PresignedGetRequest,
  PresignedGetResult,
  PresignedPutRequest,
  PresignedPutResult,
} from "./object-storage.port.js";

function storageProviderLabel(env: ApiEnv): "r2" | "s3" {
  const ep = env.S3_ENDPOINT ?? "";
  return ep.includes("r2.cloudflarestorage.com") ? "r2" : "s3";
}

@Injectable()
export class S3ObjectStorage implements ObjectStoragePort {
  readonly providerId: "r2" | "s3";
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly presignUploadExpiresSeconds: number;
  private readonly presignReadExpiresSeconds: number;

  constructor(env: ApiEnv) {
    this.providerId = storageProviderLabel(env);
    const bucket = env.S3_BUCKET;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("S3ObjectStorage constructed without credentials");
    }
    this.bucket = bucket;
    this.presignUploadExpiresSeconds = env.PRESIGNED_UPLOAD_EXPIRES_SECONDS;
    this.presignReadExpiresSeconds = env.PRESIGNED_READ_EXPIRES_SECONDS;

    const region = env.S3_REGION ?? (env.S3_ENDPOINT ? "auto" : "us-east-1");
    const endpoint = env.S3_ENDPOINT;
    const forcePathStyle = Boolean(endpoint);

    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
  }

  isUploadConfigured(): boolean {
    return true;
  }

  async presignPut(req: PresignedPutRequest): Promise<PresignedPutResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: req.objectKey,
      ContentType: req.contentType,
      ContentLength: req.contentLength,
    });

    const expiresIn = Math.min(req.expiresInSeconds, this.presignUploadExpiresSeconds);
    const url = await getSignedUrl(this.client, command, { expiresIn });

    const requiredHeaders: Record<string, string> = {
      "Content-Type": req.contentType,
      "Content-Length": String(req.contentLength),
    };

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return { method: "PUT", url, requiredHeaders, expiresAt };
  }

  async presignGet(req: PresignedGetRequest): Promise<PresignedGetResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: req.objectKey,
      ...(req.responseContentType ? { ResponseContentType: req.responseContentType } : {}),
    });

    const expiresIn = Math.min(req.expiresInSeconds, this.presignReadExpiresSeconds);
    const url = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return { method: "GET", url, expiresAt };
  }

  async headObject(objectKey: string): Promise<{ contentLength: number } | null> {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      const len = out.ContentLength;
      if (typeof len !== "number") return null;
      return { contentLength: len };
    } catch {
      return null;
    }
  }
}
