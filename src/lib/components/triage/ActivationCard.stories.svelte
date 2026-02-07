<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent } from 'storybook/test';
	import ActivationCard from './ActivationCard.svelte';
	import {
		level1Deterministic,
		level1Llm,
		level2Match,
		level3Match,
		level1Justification,
		level2Justification,
		level3Justification,
		standardTriageJustification,
		sampleReasoning,
	} from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/ActivationCard',
		component: ActivationCard,
		tags: ['autodocs'],
		argTypes: {
			level: {
				control: { type: 'select' },
				options: ['Level 1', 'Level 2', 'Level 3', 'Standard Triage'],
			},
			justification: {
				control: { type: 'text' },
			},
			matches: {
				control: { type: 'object' },
			},
			agentReasoning: {
				control: { type: 'text' },
			},
		},
	});
</script>

<Story
	name="Level1"
	args={{
		level: 'Level 1',
		justification: level1Justification,
		matches: [level1Deterministic, level1Llm],
		agentReasoning: sampleReasoning,
	}}
/>

<Story
	name="Level2"
	args={{
		level: 'Level 2',
		justification: level2Justification,
		matches: [level2Match],
		agentReasoning: sampleReasoning,
	}}
/>

<Story
	name="Level3"
	args={{
		level: 'Level 3',
		justification: level3Justification,
		matches: [level3Match],
		agentReasoning: sampleReasoning,
	}}
/>

<Story
	name="StandardTriage"
	args={{
		level: 'Standard Triage',
		justification: standardTriageJustification,
		matches: [],
	}}
/>

<Story
	name="CriteriaExpanded"
	args={{
		level: 'Level 1',
		justification: level1Justification,
		matches: [level1Deterministic, level1Llm],
		agentReasoning: sampleReasoning,
	}}
	play={async ({ canvasElement }) => {
		const buttons = canvasElement.querySelectorAll('button');
		const detailsBtn = buttons[0];
		if (detailsBtn) {
			await userEvent.click(detailsBtn);
		}
	}}
/>

<Story
	name="FullyExpanded"
	args={{
		level: 'Level 1',
		justification: level1Justification,
		matches: [level1Deterministic, level1Llm],
		agentReasoning: sampleReasoning,
	}}
	play={async ({ canvasElement }) => {
		const buttons = canvasElement.querySelectorAll('button');
		for (const button of buttons) {
			await userEvent.click(button);
		}
		const reasoningText = canvasElement.querySelector('.whitespace-pre-wrap');
		await expect(reasoningText).toBeTruthy();
	}}
/>
