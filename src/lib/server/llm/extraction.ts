import type { ExtractedFields } from '$lib/types/index.js';
import { getClient, EXTRACTION_MODEL } from './anthropic.js';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL } from './prompts.js';

export async function extractFields(report: string): Promise<{
	fields: ExtractedFields;
	isTraumaReport: boolean;
}> {
	const client = getClient();

	const response = await client.messages.create({
		model: EXTRACTION_MODEL,
		max_tokens: 1024,
		system: EXTRACTION_SYSTEM_PROMPT,
		tools: [EXTRACTION_TOOL],
		tool_choice: { type: 'tool', name: 'extract_trauma_fields' },
		messages: [
			{
				role: 'user',
				content: `Extract structured fields from this EMS trauma report:\n\n${report}`,
			},
		],
	});

	const toolBlock = response.content.find(
		(block): block is Extract<(typeof response.content)[number], { type: 'tool_use' }> =>
			block.type === 'tool_use',
	);

	if (!toolBlock) {
		throw new Error('LLM did not return a tool_use response');
	}

	const input = toolBlock.input as Record<string, unknown>;

	return {
		isTraumaReport: input.isTraumaReport as boolean,
		fields: {
			age: (input.age as number) ?? null,
			sbp: (input.sbp as number) ?? null,
			hr: (input.hr as number) ?? null,
			rr: (input.rr as number) ?? null,
			gcs: (input.gcs as number) ?? null,
			airwayStatus: (input.airwayStatus as string) ?? null,
			breathingStatus: (input.breathingStatus as string) ?? null,
			mechanism: (input.mechanism as string) ?? null,
			injuries: (input.injuries as string[]) ?? null,
			additionalContext: (input.additionalContext as string) ?? null,
		},
	};
}
