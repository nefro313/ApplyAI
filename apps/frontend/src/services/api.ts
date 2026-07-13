import type {
  ApplyChangesRequestBody,
  EmailDraftPayload,
  EmailDraftRequestBody,
  InterviewPrep,
  PipelineProgress,
  PipelineRequestBody,
  PipelineResult,
  PipelineReview,
  PipelineSummary,
  RecruiterReview,
  ResumeRisks,
  ResumeUploadResponse,
  ScrapeJDResponse,
  SkillRoadmap,
  StartPipelineResponse,
} from "@applyai/types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// User-facing copy. We never surface the raw backend payload (FastAPI
// `{"detail": ...}`, stack traces, rate-limit internals, etc.) — those can leak
// implementation details and read as scary to a candidate. Instead we map the
// HTTP status / failure class to a calm, reassuring message and log the real
// thing to the console for debugging.
const FRIENDLY = {
  network: "Can't reach the server. Check your connection and try again.",
  timeout: "The server took too long to respond. Please try again.",
  unauthorized: "Your session has expired. Please sign in again.",
  forbidden: "You don't have access to this. Please sign in again.",
  notFound: "We couldn't find what you were looking for.",
  rateLimited:
    "You're doing that a bit too fast. Please wait a moment and try again.",
  server: "Our servers are busy right now. Please try again in a moment.",
  generic: "Something went wrong. Please try again.",
} as const;

// Shown when a background pipeline reports `overall_status === "failed"`. The
// doc may carry a raw internal `error` string — we never render that directly.
export const PIPELINE_FAILED_MESSAGE =
  "We hit a snag while tailoring your application. Please try again.";

/** Map an HTTP status to safe, user-facing copy. */
export function friendlyHttpError(status: number): string {
  if (status === 401) return FRIENDLY.unauthorized;
  if (status === 403) return FRIENDLY.forbidden;
  if (status === 404) return FRIENDLY.notFound;
  if (status === 408 || status === 504) return FRIENDLY.timeout;
  if (status === 429) return FRIENDLY.rateLimited;
  if (status >= 500) return FRIENDLY.server;
  return FRIENDLY.generic;
}

/** Map a thrown fetch/runtime error (no HTTP response) to user-facing copy. */
export function friendlyNetworkError(e: unknown): string {
  if (e instanceof DOMException && e.name === "AbortError")
    return FRIENDLY.timeout;
  // Browsers throw a TypeError ("Failed to fetch") when the request never
  // reaches the server — offline, DNS failure, CORS, server down.
  return FRIENDLY.network;
}

// Auth token is set by AuthProvider whenever the Firebase user / token changes.
// Keeping it module-scoped lets API helpers stay parameter-free. This cached
// value is the synchronous fallback used by `withAuth` when the async
// `_tokenGetter` is unavailable or throws. Regular requests prefer
// `_tokenGetter`, which returns a *fresh* token (Firebase auto-refreshes it on
// demand) so long-open pages never send an expired token and hit 401.
let _authToken: string | null = null;
let _tokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

/** Registered by AuthProvider; resolves a guaranteed-fresh Firebase ID token. */
export function setAuthTokenGetter(
  getter: (() => Promise<string | null>) | null,
): void {
  _tokenGetter = getter;
}

async function withAuth(init?: RequestInit): Promise<RequestInit> {
  const headers = new Headers(init?.headers ?? {});
  let token = _authToken;
  if (_tokenGetter) {
    try {
      token = (await _tokenGetter()) ?? _authToken;
    } catch {
      // Fall back to the cached token if the refresh call throws.
    }
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

async function jsonFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, await withAuth(init));
    if (!res.ok) {
      // Keep the raw payload for developers, but never show it to the user.
      const raw = await res.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[api] ${path} → ${res.status} ${res.statusText}`, raw);
      }
      return { data: null, error: friendlyHttpError(res.status) };
    }
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[api] ${path} → request failed`, e);
    }
    return { data: null, error: friendlyNetworkError(e) };
  }
}

export async function uploadResume(
  file: File,
): Promise<ApiResult<ResumeUploadResponse>> {
  const fd = new FormData();
  fd.append("file", file);
  return jsonFetch<ResumeUploadResponse>("/api/v1/upload-resume", {
    method: "POST",
    body: fd,
  });
}

export async function scrapeJd(url: string): Promise<ApiResult<ScrapeJDResponse>> {
  return jsonFetch<ScrapeJDResponse>("/api/v1/scrape-jd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function startPipeline(
  body: PipelineRequestBody,
): Promise<ApiResult<StartPipelineResponse>> {
  return jsonFetch<StartPipelineResponse>("/api/v1/pipeline/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getPipelineStatus(
  id: string,
): Promise<ApiResult<PipelineProgress>> {
  return jsonFetch<PipelineProgress>(`/api/v1/pipeline/${id}/status`);
}

export async function getPipelineResult(
  id: string,
): Promise<ApiResult<PipelineResult>> {
  return jsonFetch<PipelineResult>(`/api/v1/pipeline/${id}/result`);
}

export async function getPipelineReview(
  id: string,
): Promise<ApiResult<PipelineReview>> {
  return jsonFetch<PipelineReview>(`/api/v1/pipeline/${id}/review`);
}

export async function applyChanges(
  id: string,
  body: ApplyChangesRequestBody,
): Promise<ApiResult<StartPipelineResponse>> {
  return jsonFetch<StartPipelineResponse>(
    `/api/v1/pipeline/${id}/apply-changes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function draftEmail(
  body: EmailDraftRequestBody,
): Promise<ApiResult<EmailDraftPayload>> {
  return jsonFetch<EmailDraftPayload>("/api/v1/draft-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listMyPipelines(): Promise<ApiResult<PipelineSummary[]>> {
  return jsonFetch<PipelineSummary[]>("/api/v1/me/pipelines");
}

export async function deletePipeline(
  id: string,
): Promise<ApiResult<{ pipeline_id: string; status: string }>> {
  return jsonFetch<{ pipeline_id: string; status: string }>(
    `/api/v1/pipeline/${id}`,
    { method: "DELETE" },
  );
}

export async function generateInterviewPrep(
  id: string,
): Promise<ApiResult<InterviewPrep>> {
  return jsonFetch<InterviewPrep>(`/api/v1/pipeline/${id}/interview-prep`, {
    method: "POST",
  });
}

export async function getSkillRoadmap(
  id: string,
): Promise<ApiResult<SkillRoadmap>> {
  return jsonFetch<SkillRoadmap>(`/api/v1/pipeline/${id}/skill-roadmap`, {
    method: "POST",
  });
}

export async function getRecruiterReview(
  id: string,
): Promise<ApiResult<RecruiterReview>> {
  return jsonFetch<RecruiterReview>(`/api/v1/pipeline/${id}/recruiter-review`, {
    method: "POST",
  });
}

export async function getResumeRisks(
  id: string,
): Promise<ApiResult<ResumeRisks>> {
  return jsonFetch<ResumeRisks>(`/api/v1/pipeline/${id}/resume-risks`, {
    method: "POST",
  });
}
