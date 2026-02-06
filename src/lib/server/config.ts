import { env } from '$env/dynamic/private';

/** Returns true when the app should use mock LLM calls instead of real Anthropic API. */
export function isMockMode(): boolean {
	if (env.MOCK_MODE === 'true') return true;
	const key = env.ANTHROPIC_API_KEY;
	return !key || key === '' || key === 'sk-placeholder' || key === 'your-api-key-here';
}
