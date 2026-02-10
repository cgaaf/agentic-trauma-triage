export type DeepgramGrantAttempt = {
  ok: boolean;
  status: number;
  statusText: string;
  bodyText: string;
  accessToken: string | null;
};

export function normalizeDeepgramApiKey(raw: string | undefined): string {
  if (!raw) return "";

  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return "";

  return trimmed.replace(/^(Token|Bearer)\s+/i, "").trim();
}

export function buildDeepgramAuthHeaders(apiKey: string): string[] {
  return [`Token ${apiKey}`, apiKey];
}

export function summarizeDeepgramGrantError(attempts: DeepgramGrantAttempt[]): string {
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
