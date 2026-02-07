<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DisclaimerFooter from './DisclaimerFooter.svelte';

	const { Story } = defineMeta({
		title: 'Triage/DisclaimerFooter',
		component: DisclaimerFooter,
		tags: ['autodocs'],
	});
</script>

<Story name="Default" />
