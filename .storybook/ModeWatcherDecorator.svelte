<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';

	let { children }: { children: Snippet } = $props();
</script>

<ModeWatcher />
{@render children()}
