<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent } from 'storybook/test';
	import CriteriaMatches from './CriteriaMatches.svelte';
	import {
		singleLevel1Matches,
		mixedLevelMatches,
		llmConfidenceMatches,
		pediatricMatches,
	} from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/CriteriaMatches',
		component: CriteriaMatches,
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
		const buttons = canvasElement.querySelectorAll('button');
		for (const button of buttons) {
			await userEvent.click(button);
		}
	}}
/>
