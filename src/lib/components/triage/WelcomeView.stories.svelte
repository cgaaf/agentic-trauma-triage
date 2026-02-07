<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import WelcomeView from './WelcomeView.svelte';

	const { Story } = defineMeta({
		title: 'Triage/WelcomeView',
		component: WelcomeView,
		tags: ['autodocs'],
	});
</script>

<Story name="Default" />
