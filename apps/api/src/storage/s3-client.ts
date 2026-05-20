import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { ApiEnv } from "../env.js";

export function isS3Configured(env: ApiEnv): boolean {
  return Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

export function createS3ClientFromApiEnv(env: ApiEnv): S3Client {
  if (!isS3Configured(env)) {
    throw new Error("S3 is not configured");
  }
  const region = env.S3_REGION ?? (env.S3_ENDPOINT ? "auto" : "us-east-1");
  return new S3Client({
    region,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: Boolean(env.S3_ENDPOINT),
  });
}

export async function downloadObjectToFile(params: {
  client: S3Client;
  bucket: string;
  key: string;
  destPath: string;
}): Promise<void> {
  const { createWriteStream } = await import("node:fs");
  const { pipeline } = await import("node:stream/promises");

  const out = await params.client.send(
    new GetObjectCommand({ Bucket: params.bucket, Key: params.key }),
  );
  if (!out.Body) {
    throw new Error("GetObject returned empty body");
  }
  await pipeline(out.Body as NodeJS.ReadableStream, createWriteStream(params.destPath));
}
