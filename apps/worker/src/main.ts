import "./boot-env.js";

import { createDb } from "@pickleball/db";

import { claimAndProcessOne } from "./process-one.js";
import { loadWorkerEnv } from "./env.js";
import { createS3Client } from "./s3-client.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  createDb({ max: 3 });
  const s3 = createS3Client(env);

  let shuttingDown = false;
  const shutdown = () => {
    shuttingDown = true;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.info(
    `[worker] started poll=${env.WORKER_POLL_INTERVAL_MS}ms staleProcessing=${env.WORKER_STALE_PROCESSING_SECONDS}s`,
  );

  while (!shuttingDown) {
    try {
      const didWork = await claimAndProcessOne({ env, s3 });
      if (!didWork) {
        await sleep(env.WORKER_POLL_INTERVAL_MS);
      }
    } catch (err) {
      console.error("[worker] loop error:", err);
      await sleep(env.WORKER_POLL_INTERVAL_MS);
    }
  }

  console.info("[worker] shutdown");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
