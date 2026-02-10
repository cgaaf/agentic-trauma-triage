<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Header from './Header.svelte';

	const { Story } = defineMeta({
		title: 'Triage/Header',
		component: Header,
		tags: ['autodocs'],
	});
</script>

<Story name="Default" />

<Story name="NewTriage" args={{ showNewTriage: true, onNewTriage: () => {} }} />
