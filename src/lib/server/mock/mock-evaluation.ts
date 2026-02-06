import type { CriterionMatch } from '$lib/types/index.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mock LLM evaluation: returns empty matches with mock reasoning note. Simulates Sonnet with 500ms delay. */
export async function mockEvaluate(): Promise<{
	matches: CriterionMatch[];
	hybridConfirmations: number[];
	reasoning: string;
}> {
	await delay(500);

	return {
		matches: [],
		hybridConfirmations: [],
		reasoning: '[MOCK MODE] LLM evaluation was not performed. In production, Claude Sonnet would analyze mechanism of injury, anatomical injuries, and other qualitative criteria here.',
	};
}
