<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PhaseTransitionHarness from './_storybook/PhaseTransitionHarness.svelte';
	import {
		level1MvcScenario,
		geriatricLevel2Scenario,
		standardTriageScenario,
		errorRecoveryScenario,
	} from './_storybook/phase-scenarios.js';

	const { Story } = defineMeta({
		title: 'Triage/PhaseTransition',
		component: PhaseTransitionHarness,
		parameters: {
			layout: 'fullscreen',
		},
		argTypes: {
			scenario: { control: false },
		},
	});
</script>

<Story name="Level1MVC" args={{ scenario: level1MvcScenario }} />

<Story name="GeriatricLevel2" args={{ scenario: geriatricLevel2Scenario }} />

<Story name="StandardTriage" args={{ scenario: standardTriageScenario }} />

<Story name="ErrorRecovery" args={{ scenario: errorRecoveryScenario }} />
