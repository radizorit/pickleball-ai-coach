import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { WorkerEnv } from "./env.js";

export function createS3Client(env: WorkerEnv): S3Client {
  const region = env.S3_REGION ?? (env.S3_ENDPOINT ? "auto" : "us-east-1");
  const endpoint = env.S3_ENDPOINT;
  const forcePathStyle = Boolean(endpoint);

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle,
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

export async function uploadJpegFile(params: {
  client: S3Client;
  bucket: string;
  key: string;
  filePath: string;
}): Promise<void> {
  const { readFile } = await import("node:fs/promises");
  const body = await readFile(params.filePath);
  await params.client.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      Body: body,
      ContentType: "image/jpeg",
    }),
  );
}
