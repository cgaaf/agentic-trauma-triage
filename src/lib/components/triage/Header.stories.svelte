<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Header from './Header.svelte';

	const { Story } = defineMeta({
		title: 'Triage/Header',
		component: Header,
		tags: ['autodocs'],
	});
</script>

<Story name="Default" args={{ mockMode: false }} />

<Story name="MockMode" args={{ mockMode: true }} />

<Story name="NewTriage" args={{ showNewTriage: true, onNewTriage: () => {} }} />

<Story name="MockModeWithNewTriage" args={{ mockMode: true, showNewTriage: true, onNewTriage: () => {} }} />
