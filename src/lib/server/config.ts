import { env } from "$env/dynamic/private";

const MOCK_KEY_PLACEHOLDERS = new Set([
  "sk-placeholder",
  "your-api-key-here",
  "insert-anthropic-api-key",
  "insert-deepgram-api-key",
]);

function isMissingApiKey(key: string | undefined): boolean {
  return !key || key === "" || MOCK_KEY_PLACEHOLDERS.has(key);
}

/** Returns true when the app should use mock LLM calls instead of real Anthropic API. */
export function isMockMode(): boolean {
  if (env.MOCK_MODE === "true") return true;
  return isMissingApiKey(env.ANTHROPIC_API_KEY);
}

/** Returns true when speech transcription should use mock responses. */
export function isTranscriptionMockMode(): boolean {
  if (env.MOCK_MODE === "true") return true;
  return isMissingApiKey(env.DEEPGRAM_API_KEY);
}

/** Backward-compatible alias for legacy imports. */
export function isOpenAIMockMode(): boolean {
  return isTranscriptionMockMode();
}
