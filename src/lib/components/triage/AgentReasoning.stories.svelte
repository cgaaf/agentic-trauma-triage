<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent } from 'storybook/test';
	import AgentReasoning from './AgentReasoning.svelte';
	import { sampleReasoning } from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/AgentReasoning',
		component: AgentReasoning,
		tags: ['autodocs'],
	});
</script>

<Story name="Collapsed" args={{ reasoning: sampleReasoning }} />

<Story
	name="Expanded"
	args={{ reasoning: sampleReasoning }}
	play={async ({ canvasElement }) => {
		const button = canvasElement.querySelector('button');
		if (button) {
			await userEvent.click(button);
			const reasoningText = canvasElement.querySelector('.whitespace-pre-wrap');
			await expect(reasoningText).toBeTruthy();
		}
	}}
/>

<Story name="Empty" args={{ reasoning: '' }} />
