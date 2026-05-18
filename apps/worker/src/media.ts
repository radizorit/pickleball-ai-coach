import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import type { WorkerEnv } from "./env.js";

export type VideoProbeMeta = {
  durationSeconds: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
};

type FfprobeJson = {
  format?: { duration?: string };
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
    r_frame_rate?: string;
    duration?: string;
  }>;
};

function parseRationalFps(raw: string | undefined): number | null {
  if (!raw || raw === "0/0") return null;
  const parts = raw.split("/");
  if (parts.length === 1) {
    const n = Number(parts[0]);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return Math.round(a / b);
}

function pickVideoStream(streams: FfprobeJson["streams"]): NonNullable<FfprobeJson["streams"]>[number] | undefined {
  if (!streams?.length) return undefined;
  return streams.find((s) => s.codec_type === "video") ?? streams[0];
}

function runCapture(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function ffprobeVideoMeta(env: WorkerEnv, inputPath: string): Promise<VideoProbeMeta> {
  const { code, stdout, stderr } = await runCapture(env.FFPROBE_BIN, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    "-select_streams",
    "v:0",
    inputPath,
  ]);
  if (code !== 0) {
    throw new Error(`ffprobe failed (${code}): ${stderr.slice(0, 2000)}`);
  }
  const parsed = JSON.parse(stdout) as FfprobeJson;
  const stream = pickVideoStream(parsed.streams);
  const formatDur = parsed.format?.duration != null ? Number(parsed.format.duration) : NaN;
  const streamDur = stream?.duration != null ? Number(stream.duration) : NaN;
  const durationRaw = Number.isFinite(formatDur) ? formatDur : streamDur;
  const durationSeconds =
    Number.isFinite(durationRaw) && durationRaw >= 0 ? Math.max(0, Math.round(durationRaw)) : null;

  const fpsRaw = stream?.avg_frame_rate || stream?.r_frame_rate;
  const fps = parseRationalFps(fpsRaw);

  const width = stream?.width != null && Number.isFinite(stream.width) ? stream.width : null;
  const height = stream?.height != null && Number.isFinite(stream.height) ? stream.height : null;

  return { durationSeconds, fps, width, height };
}

export async function ffmpegThumbnailJpeg(params: {
  env: WorkerEnv;
  inputPath: string;
  outputPath: string;
  seekSeconds: number;
}): Promise<void> {
  const seek = Math.max(0, params.seekSeconds);
  const { code, stderr } = await runCapture(params.env.FFMPEG_BIN, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(seek),
    "-i",
    params.inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    params.outputPath,
  ]);
  if (code !== 0) {
    throw new Error(`ffmpeg thumbnail failed (${code}): ${stderr.slice(0, 2000)}`);
  }
  await readFile(params.outputPath);
}
