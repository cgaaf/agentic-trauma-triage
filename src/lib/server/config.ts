import { env } from "$env/dynamic/private";

const MOCK_KEY_PLACEHOLDERS = new Set([
  "sk-placeholder",
  "your-api-key-here",
  "insert-anthropic-api-key",
  "insert-openai-api-key",
]);

function isMissingApiKey(key: string | undefined): boolean {
  return !key || key === "" || MOCK_KEY_PLACEHOLDERS.has(key);
}

/** Returns true when the app should use mock LLM calls instead of real Anthropic API. */
export function isMockMode(): boolean {
  if (env.MOCK_MODE === "true") return true;
  return isMissingApiKey(env.ANTHROPIC_API_KEY);
}

/** Returns true when OpenAI transcription should use mock responses. */
export function isOpenAIMockMode(): boolean {
  if (env.MOCK_MODE === "true") return true;
  return isMissingApiKey(env.OPENAI_API_KEY);
}
