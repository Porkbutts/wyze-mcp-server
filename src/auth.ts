// Wyze Authentication Module
import crypto from "crypto";
import axios, { AxiosError } from "axios";
import {
  AUTH_BASE_URL,
  API_BASE_URL,
  AUTH_API_KEY,
  APP_NAME,
  APP_VER,
  APP_VERSION,
  PHONE_ID,
  SC,
  SV,
  PHONE_SYSTEM_TYPE,
  TOKEN_REFRESH_INTERVAL,
} from "./constants.js";
import type { WyzeCredentials, WyzeTokens, WyzeLoginResponse, WyzeApiResponse } from "./types.js";

// Triple MD5 hash for password
export function hashPassword(password: string): string {
  let hash = password;
  for (let i = 0; i < 3; i++) {
    hash = crypto.createHash("md5").update(hash).digest("hex");
  }
  return hash;
}

// Token storage
let currentTokens: WyzeTokens | null = null;
let credentials: WyzeCredentials | null = null;

export function setCredentials(creds: WyzeCredentials): void {
  credentials = creds;
}

export function getTokens(): WyzeTokens | null {
  return currentTokens;
}

export function isTokenExpired(): boolean {
  if (!currentTokens) return true;
  return Date.now() >= currentTokens.expiresAt;
}

export function isTokenNearExpiry(): boolean {
  if (!currentTokens) return true;
  // Refresh if within 1 hour of expiry
  return Date.now() >= currentTokens.expiresAt - 60 * 60 * 1000;
}

// Login to Wyze API
export async function login(): Promise<WyzeTokens> {
  if (!credentials) {
    throw new Error("Credentials not set. Call setCredentials first.");
  }

  const hashedPassword = hashPassword(credentials.password);
  const nonce = Date.now().toString();

  try {
    const response = await axios.post<WyzeApiResponse<WyzeLoginResponse>>(
      `${AUTH_BASE_URL}/api/user/login`,
      {
        email: credentials.email,
        password: hashedPassword,
        nonce,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": AUTH_API_KEY,
          keyid: credentials.keyId,
          apikey: credentials.apiKey,
        },
        timeout: 30000,
      }
    );

    const data = response.data;

    // The API can return tokens directly or wrapped in a data object
    // Direct format: { access_token, refresh_token, ... }
    // Wrapped format: { code: 1, data: { access_token, refresh_token, ... } }
    const dataAny = data as unknown as Record<string, unknown>;

    // Check if tokens are directly in response or wrapped
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    if (dataAny.access_token) {
      // Direct response format
      accessToken = dataAny.access_token as string;
      refreshToken = dataAny.refresh_token as string;
    } else if (data.data?.access_token) {
      // Wrapped response format
      accessToken = data.data.access_token;
      refreshToken = data.data.refresh_token;
    }

    // Check for errors (wrapped format only)
    if (!accessToken) {
      if (data.code !== "1" && data.code !== 1) {
        // Check for MFA requirement
        if (data.data?.mfa_options && data.data.mfa_options.length > 0) {
          throw new Error(
            `MFA is required for this account. MFA options: ${data.data.mfa_options.join(", ")}. ` +
              "MFA is not yet supported. Please disable MFA or use a different authentication method."
          );
        }
        const errorMsg = data.msg || dataAny.message || dataAny.description || JSON.stringify(data);
        throw new Error(`Login failed (code ${data.code}): ${errorMsg}`);
      }
    }

    if (!accessToken || !refreshToken) {
      throw new Error("Login failed: No access token in response");
    }

    currentTokens = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + TOKEN_REFRESH_INTERVAL,
    };

    return currentTokens;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Axios error:", error.response?.status, error.response?.data);
      if (error.response?.status === 401) {
        throw new Error("Invalid credentials. Please check your email, password, API key, and key ID.");
      }
      const responseData = error.response?.data as Record<string, unknown> | undefined;
      const errorMsg = responseData?.msg || responseData?.message || responseData?.description || error.message;
      throw new Error(`Login request failed (${error.response?.status}): ${errorMsg}`);
    }
    throw error;
  }
}

// Refresh access token
export async function refreshToken(): Promise<WyzeTokens> {
  if (!currentTokens) {
    return login();
  }

  if (!credentials) {
    throw new Error("Credentials not set. Call setCredentials first.");
  }

  try {
    const response = await axios.post<WyzeApiResponse<WyzeLoginResponse>>(
      `${API_BASE_URL}/app/user/refresh_token`,
      {
        refresh_token: currentTokens.refreshToken,
        app_name: APP_NAME,
        app_ver: APP_VER,
        app_version: APP_VERSION,
        phone_id: PHONE_ID,
        phone_system_type: PHONE_SYSTEM_TYPE,
        sc: SC,
        sv: SV,
        ts: Date.now(),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": AUTH_API_KEY,
          keyid: credentials.keyId,
          apikey: credentials.apiKey,
        },
        timeout: 30000,
      }
    );

    const data = response.data;

    if (data.code !== "1" && data.code !== 1) {
      // Token refresh failed, try full login
      console.error("Token refresh failed, attempting full login");
      return login();
    }

    currentTokens = {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: Date.now() + TOKEN_REFRESH_INTERVAL,
    };

    return currentTokens;
  } catch (error) {
    // On refresh failure, try full login
    console.error("Token refresh error, attempting full login:", error);
    return login();
  }
}

// Ensure we have a valid token
export async function ensureValidToken(): Promise<string> {
  if (!currentTokens || isTokenExpired()) {
    await login();
  } else if (isTokenNearExpiry()) {
    await refreshToken();
  }

  if (!currentTokens) {
    throw new Error("Failed to obtain access token");
  }

  return currentTokens.accessToken;
}

// Initialize authentication from environment variables
export function initAuthFromEnv(): void {
  const email = process.env.WYZE_EMAIL;
  const password = process.env.WYZE_PASSWORD;
  const apiKey = process.env.WYZE_API_KEY;
  const keyId = process.env.WYZE_KEY_ID;

  if (!email) {
    throw new Error("WYZE_EMAIL environment variable is required");
  }
  if (!password) {
    throw new Error("WYZE_PASSWORD environment variable is required");
  }
  if (!apiKey) {
    throw new Error("WYZE_API_KEY environment variable is required");
  }
  if (!keyId) {
    throw new Error("WYZE_KEY_ID environment variable is required");
  }

  setCredentials({ email, password, apiKey, keyId });
}
