<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ReportDisplay from './ReportDisplay.svelte';
	import {
		sampleReport,
		geriatricReport,
		standardTriageReport,
	} from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/ReportDisplay',
		component: ReportDisplay,
		tags: ['autodocs'],
	});
</script>

<Story name="Collapsed" args={{ text: sampleReport }} />

<Story name="ShortText" args={{ text: '45-year-old male, minor laceration to left forearm.' }} />

<Story name="GeriatricReport" args={{ text: geriatricReport }} />

<Story name="StandardTriage" args={{ text: standardTriageReport }} />

<Story name="Expanded" args={{ text: sampleReport, expanded: true }} />
