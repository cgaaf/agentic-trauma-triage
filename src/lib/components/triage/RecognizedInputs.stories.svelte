<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RecognizedInputs from './RecognizedInputs.svelte';
	import {
		allFieldsPresent,
		partialFields,
		minimalFields,
		sampleWarnings,
	} from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/RecognizedInputs',
		component: RecognizedInputs,
		tags: ['autodocs'],
	});
</script>

<Story name="AllFieldsPresent" args={{ fields: allFieldsPresent, warnings: [] }} />

<Story name="PartialFields" args={{ fields: partialFields, warnings: [] }} />

<Story name="MinimalFields" args={{ fields: minimalFields, warnings: [] }} />

<Story
	name="WithWarnings"
	args={{
		fields: {
			...allFieldsPresent,
			sbp: 240,
			hr: 210,
		},
		warnings: sampleWarnings,
	}}
/>
