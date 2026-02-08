<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent } from 'storybook/test';
	import AdditionalCriteria from './AdditionalCriteria.svelte';
	import {
		singleLevel1Matches,
		mixedLevelMatches,
		llmConfidenceMatches,
		pediatricMatches,
	} from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/AdditionalCriteria',
		component: AdditionalCriteria,
		tags: ['autodocs'],
	});
</script>

<Story name="SingleLevel1Match" args={{ matches: singleLevel1Matches }} />

<Story name="MixedLevels" args={{ matches: mixedLevelMatches }} />

<Story name="WithLLMConfidence" args={{ matches: llmConfidenceMatches }} />

<Story name="PediatricMatches" args={{ matches: pediatricMatches }} />

<Story name="EmptyMatches" args={{ matches: [] }} />

<Story
	name="MixedLevelsExpanded"
	args={{ matches: mixedLevelMatches }}
	play={async ({ canvasElement }) => {
		const button = canvasElement.querySelector('button');
		if (button) {
			await userEvent.click(button);
		}
	}}
/>
