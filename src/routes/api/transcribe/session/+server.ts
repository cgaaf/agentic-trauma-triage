import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";
import { env } from "$env/dynamic/private";
import { isTranscriptionMockMode } from "$lib/server/config.js";

const DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant";
const DEEPGRAM_MODEL = "nova-3-medical";
const DEEPGRAM_LANGUAGE = "en-US";
const TEMP_TOKEN_TTL_SECONDS = 300;

const EMS_SPOKEN_KEYTERMS = [
  "GCS",
  "SBP",
  "BP",
  "EtOH",
  "GSW",
  "MVC",
  "MCC",
  "ped",
  "peds",
  "pedestrian struck",
  "rollover",
  "ejection",
  "intubated",
  "tourniquet",
] as const;

type DeepgramGrantResponse = {
  access_token?: string;
  expires_in?: number | null;
};

type DeepgramGrantAttempt = {
  ok: boolean;
  status: number;
  statusText: string;
  bodyText: string;
  accessToken: string | null;
};

function normalizeDeepgramApiKey(raw: string | undefined): string {
  if (!raw) return "";

  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return "";

  return trimmed.replace(/^(Token|Bearer)\s+/i, "").trim();
}

function buildDeepgramAuthHeaders(apiKey: string): string[] {
  return [`Token ${apiKey}`, apiKey];
}

async function requestDeepgramGrant(authHeader: string): Promise<DeepgramGrantAttempt> {
  const response = await fetch(DEEPGRAM_GRANT_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: TEMP_TOKEN_TTL_SECONDS }),
  });

  const bodyText = await response.text().catch(() => "");
  let accessToken: string | null = null;

  if (response.ok) {
    try {
      const body = JSON.parse(bodyText) as DeepgramGrantResponse;
      accessToken = body.access_token ?? null;
    } catch {
      accessToken = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    bodyText,
    accessToken,
  };
}

function summarizeDeepgramGrantError(attempts: DeepgramGrantAttempt[]): string {
  const primary = attempts[0];
  if (!primary) {
    return "Failed to create transcription session.";
  }

  if (primary.status === 401 || primary.status === 403) {
    return "Deepgram authentication failed. Check DEEPGRAM_API_KEY and ensure it has Member role or higher.";
  }

  if (primary.status >= 500) {
    return "Deepgram temporary token service is unavailable. Please try again.";
  }

  return `Deepgram token grant failed (${primary.status} ${primary.statusText}).`;
}

export const POST: RequestHandler = async () => {
  if (isTranscriptionMockMode()) {
    return json({
      mock: true,
      provider: "deepgram",
      temporary_token: null,
      model: DEEPGRAM_MODEL,
      language: DEEPGRAM_LANGUAGE,
      keyterms: [...EMS_SPOKEN_KEYTERMS],
    });
  }

  try {
    const apiKey = normalizeDeepgramApiKey(env.DEEPGRAM_API_KEY);
    if (!apiKey) {
      return json(
        { error: "DEEPGRAM_API_KEY is missing or invalid in server environment." },
        { status: 500 },
      );
    }

    const attempts: DeepgramGrantAttempt[] = [];
    const headersToTry = buildDeepgramAuthHeaders(apiKey);

    let accessToken: string | null = null;
    for (const authHeader of headersToTry) {
      const attempt = await requestDeepgramGrant(authHeader);
      attempts.push(attempt);

      if (attempt.ok && attempt.accessToken) {
        accessToken = attempt.accessToken;
        break;
      }
    }

    if (!accessToken) {
      console.error(
        "[transcribe/session] Deepgram token grant failed:",
        attempts.map((attempt) => ({
          status: attempt.status,
          statusText: attempt.statusText,
          body: attempt.bodyText,
        })),
      );

      return json({ error: summarizeDeepgramGrantError(attempts) }, { status: 502 });
    }

    return json({
      mock: false,
      provider: "deepgram",
      temporary_token: accessToken,
      model: DEEPGRAM_MODEL,
      language: DEEPGRAM_LANGUAGE,
      keyterms: [...EMS_SPOKEN_KEYTERMS],
    });
  } catch (err) {
    console.error("[transcribe/session] Deepgram API error:", err);
    return json(
      { error: "Failed to create transcription session. Please try again." },
      { status: 502 },
    );
  }
};
