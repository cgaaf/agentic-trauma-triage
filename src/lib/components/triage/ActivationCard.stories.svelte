<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ActivationCard from './ActivationCard.svelte';
	import {
		level1Justification,
		level2Justification,
		level3Justification,
		standardTriageJustification,
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
		},
	});
</script>

<Story name="Level1" args={{ level: 'Level 1', justification: level1Justification }} />

<Story name="Level2" args={{ level: 'Level 2', justification: level2Justification }} />

<Story name="Level3" args={{ level: 'Level 3', justification: level3Justification }} />

<Story
	name="StandardTriage"
	args={{ level: 'Standard Triage', justification: standardTriageJustification }}
/>
