<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';

	let { children, data } = $props();
</script>

<ModeWatcher />
<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
