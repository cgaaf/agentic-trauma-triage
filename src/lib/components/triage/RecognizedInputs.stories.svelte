<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RecognizedInputs from './RecognizedInputs.svelte';
	import {
		allFieldsPresent,
		partialFields,
		minimalFields,
		sampleWarnings,
		sampleMissingFieldWarnings,
	} from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/RecognizedInputs',
		component: RecognizedInputs,
		tags: ['autodocs'],
	});

	/** All vitals missing but clinical fields populated */
	const allVitalsMissing = {
		age: null,
		sbp: null,
		hr: null,
		rr: null,
		gcs: null,
		airwayStatus: 'Patent, maintained with jaw thrust',
		breathingStatus: 'Tachypneic, decreased breath sounds on left',
		mechanism: 'High-speed MVC with rollover, unrestrained driver',
		injuries: ['Left femur fracture', 'Left-sided flail chest', 'Scalp laceration'],
		additionalContext: null,
	};
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
			rr: null,
			gcs: null,
		},
		warnings: sampleWarnings,
		missingFieldWarnings: sampleMissingFieldWarnings,
	}}
/>

<Story
	name="MissingFieldsOnly"
	args={{
		fields: {
			...allFieldsPresent,
			rr: null,
			gcs: null,
		},
		warnings: [],
		missingFieldWarnings: sampleMissingFieldWarnings,
	}}
/>

<Story name="AllVitalsMissing" args={{ fields: allVitalsMissing, warnings: [] }} />
