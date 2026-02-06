<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ProgressSteps from './ProgressSteps.svelte';

	const { Story } = defineMeta({
		title: 'Triage/ProgressSteps',
		component: ProgressSteps,
		tags: ['autodocs'],
		argTypes: {
			phase: {
				control: { type: 'select' },
				options: ['idle', 'extracting', 'evaluating_vitals', 'analyzing_mechanism', 'complete'],
			},
		},
	});
</script>

<Story name="Extracting" args={{ phase: 'extracting' }} />

<Story name="EvaluatingVitals" args={{ phase: 'evaluating_vitals' }} />

<Story name="AnalyzingMechanism" args={{ phase: 'analyzing_mechanism' }} />

<Story name="Complete" args={{ phase: 'complete' }} />

<Story name="Idle" args={{ phase: 'idle' }} />
