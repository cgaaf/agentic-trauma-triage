<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn, expect, userEvent } from 'storybook/test';
	import ReportInput from './ReportInput.svelte';
	import { sampleReport } from './_storybook/mock-data.js';

	const { Story } = defineMeta({
		title: 'Triage/ReportInput',
		component: ReportInput,
		tags: ['autodocs'],
		args: {
			onsubmit: fn(),
		},
	});
</script>

<Story name="Empty" args={{ value: '', loading: false }} />

<Story name="WithValue" args={{ value: sampleReport, loading: false }} />

<Story name="Loading" args={{ value: sampleReport, loading: true }} />

<Story
	name="SubmitInteraction"
	args={{ value: sampleReport, loading: false }}
	play={async ({ canvasElement, args }) => {
		const button = canvasElement.querySelector('button:not([disabled])');
		if (button) {
			await userEvent.click(button);
			await expect(args.onsubmit).toHaveBeenCalled();
		}
	}}
/>
