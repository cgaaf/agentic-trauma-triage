import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

let client: Anthropic | null = null;

export function getClient(): Anthropic {
	if (!client) {
		client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	}
	return client;
}

export const EXTRACTION_MODEL = 'claude-haiku-4-5-20251001';
export const EVALUATION_MODEL = 'claude-sonnet-4-5-20250929';
