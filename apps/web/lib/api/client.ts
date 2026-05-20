/**
 * Minimal REST client for the `@pickleball/api` service.
 *
 * When `getToken` is provided (Clerk session JWT), requests include
 * `Authorization: Bearer …` for protected Nest routes.
 */
import type {
  ApiError,
  HealthResponse,
  ShotEventDTO,
  SuggestedShotEventDTO,
  SuggestedShotRegenerateSummaryDTO,
  SuggestedShotStatsDTO,
  UserDTO,
  VideoDTO,
  VideoPresignedReadDTO,
  VideoPresignedUploadDTO,
  VideoTrainingExportDTO,
} from "@pickleball/shared";
import type {
  ConvertSuggestedShotBatchBody,
  ConvertSuggestedShotBody,
  CreateShotEventBody,
  CreateVideoBody,
  PresignVideoUploadBody,
  UpdateShotEventBody,
  UpdateSuggestedShotBody,
} from "@pickleball/shared/zod";

export type GetTokenFn = () => Promise<string | null>;

export interface ApiClientOptions {
  getToken?: GetTokenFn;
}

function resolveBaseUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(payload: ApiError) {
    super(payload.message);
    this.name = "ApiClientError";
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const { getToken } = options;

  async function authHeaders(): Promise<Record<string, string>> {
    if (!getToken) return {};
    const token = await getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  async function request<T>(
    path: string,
    init?: RequestInit & { signal?: AbortSignal },
  ): Promise<T> {
    const base = resolveBaseUrl();
    const url = `${base.replace(/\/$/, "")}${path}`;
    const extra = await authHeaders();

    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...extra,
        ...init?.headers,
      },
      credentials: "omit",
    });

    const text = await res.text();
    const body = text ? (JSON.parse(text) as unknown) : null;

    if (!res.ok) {
      const err = (body ?? {
        statusCode: res.status,
        code: "unknown_error",
        message: res.statusText,
      }) as ApiError;
      throw new ApiClientError(err);
    }

    return body as T;
  }

  return {
    health: () => request<HealthResponse>("/v1/health"),
    me: () => request<UserDTO>("/v1/me"),
    mePing: () => request<{ ok: true; externalAuthId: string }>("/v1/me/ping"),
    videosList: () => request<VideoDTO[]>("/v1/videos"),
    videosGet: (id: string) => request<VideoDTO>(`/v1/videos/${encodeURIComponent(id)}`),
    videosCreate: (body: CreateVideoBody) =>
      request<VideoDTO>("/v1/videos", { method: "POST", body: JSON.stringify(body) }),
    videosPresignUpload: (id: string, body: PresignVideoUploadBody) =>
      request<VideoPresignedUploadDTO>(`/v1/videos/${encodeURIComponent(id)}/presign`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    videosCompleteUpload: (id: string) =>
      request<VideoDTO>(`/v1/videos/${encodeURIComponent(id)}/complete-upload`, {
        method: "POST",
      }),
    /** Short-lived signed GET for `<video src>` / `<img src>` (never use raw object keys in the browser). */
    videosReadUrl: (id: string, asset: "source" | "thumbnail") =>
      request<VideoPresignedReadDTO>(
        `/v1/videos/${encodeURIComponent(id)}/read-url?asset=${encodeURIComponent(asset)}`,
      ),
    videosShotEventsList: (videoId: string) =>
      request<ShotEventDTO[]>(`/v1/videos/${encodeURIComponent(videoId)}/shot-events`),
    videosShotEventsCreate: (videoId: string, body: CreateShotEventBody) =>
      request<ShotEventDTO>(`/v1/videos/${encodeURIComponent(videoId)}/shot-events`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    videosSuggestedShotEventsList: (
      videoId: string,
      status?: "suggested" | "accepted" | "rejected" | "all",
    ) => {
      const st = status ?? "suggested";
      const q = st === "suggested" ? "" : `?status=${encodeURIComponent(st)}`;
      return request<SuggestedShotEventDTO[]>(
        `/v1/videos/${encodeURIComponent(videoId)}/suggested-shot-events${q}`,
      );
    },
    videosSuggestedShotEventsStats: (videoId: string) =>
      request<SuggestedShotStatsDTO>(
        `/v1/videos/${encodeURIComponent(videoId)}/suggested-shot-events/stats`,
      ),
    videosSuggestedShotEventsRegenerate: (videoId: string) =>
      request<SuggestedShotRegenerateSummaryDTO>(
        `/v1/videos/${encodeURIComponent(videoId)}/suggested-shot-events/regenerate`,
        { method: "POST" },
      ),
    videosTrainingExport: (videoId: string) =>
      request<VideoTrainingExportDTO>(
        `/v1/videos/${encodeURIComponent(videoId)}/training-export`,
      ),
    videosSuggestedShotEventsConvertBatch: (videoId: string, body: ConvertSuggestedShotBatchBody) =>
      request<{ converted: ShotEventDTO[]; skipped: number }>(
        `/v1/videos/${encodeURIComponent(videoId)}/suggested-shot-events/convert-batch`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    videosSuggestedShotEventConvert: (
      videoId: string,
      suggestionId: string,
      body?: ConvertSuggestedShotBody,
    ) =>
      request<{ shot: ShotEventDTO; suggestion: SuggestedShotEventDTO }>(
        `/v1/videos/${encodeURIComponent(videoId)}/suggested-shot-events/${encodeURIComponent(suggestionId)}/convert`,
        { method: "POST", body: JSON.stringify(body ?? {}) },
      ),
    suggestedShotEventsReject: (suggestionId: string, body: UpdateSuggestedShotBody) =>
      request<SuggestedShotEventDTO>(`/v1/suggested-shot-events/${encodeURIComponent(suggestionId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    shotEventsUpdate: (eventId: string, body: UpdateShotEventBody) =>
      request<ShotEventDTO>(`/v1/shot-events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    shotEventsDelete: (eventId: string) =>
      request<{ ok: true }>(`/v1/shot-events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      }),
  };
}

/** Anonymous client (public `/v1/health` only). */
export const api = createApiClient();
