// ─── HTTP Client for Rendex REST API ─────────────────────────────────

import { translateError, httpStatusToContext } from "./errors.js";
import type { RendexRestError } from "./errors.js";

const API_BASE = "https://api.rendex.dev";

export interface ScreenshotParams {
  url: string;
  format?: "png" | "jpeg";
  width?: number;
  height?: number;
  fullPage?: boolean;
  quality?: number;
  delay?: number;
  darkMode?: boolean;
  deviceScaleFactor?: number;
  blockAds?: boolean;
  blockResourceTypes?: ("font" | "image" | "media" | "stylesheet" | "other")[];
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  waitForSelector?: string;
  bestAttempt?: boolean;
}

export interface ScreenshotResponse {
  image: string; // base64
  contentType: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytesSize: number;
  capturedAt: string;
  quality: "full" | "degraded" | "best_attempt";
  waitStrategy: string;
  loadTimeMs: number;
  truncated?: boolean;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    usage?: { credits: number; remaining: number };
  };
}

interface ApiErrorResponse {
  success: false;
  error: RendexRestError;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class RendexClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? API_BASE;
  }

  async screenshot(params: ScreenshotParams): Promise<ScreenshotResponse> {
    const response = await fetch(`${this.baseUrl}/v1/screenshot/json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params),
    });

    const body = (await response.json()) as ApiResponse<ScreenshotResponse>;

    if (!body.success) {
      const context = httpStatusToContext(response.status);
      const message = translateError(body.error);
      throw new RendexApiError(`${context}: ${message}`);
    }

    return body.data;
  }
}

export class RendexApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RendexApiError";
  }
}
