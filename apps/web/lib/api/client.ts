/**
 * Minimal REST client for the `@pickleball/api` service.
 *
 * When `getToken` is provided (Clerk session JWT), requests include
 * `Authorization: Bearer …` for protected Nest routes.
 */
import type { ApiError, HealthResponse, UserDTO } from "@pickleball/shared";

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
  };
}

/** Anonymous client (public `/v1/health` only). */
export const api = createApiClient();
