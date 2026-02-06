<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Sun, Moon } from '@lucide/svelte';
	import { toggleMode, mode } from 'mode-watcher';

	let { mockMode = false }: { mockMode?: boolean } = $props();
</script>

<header class="border-b bg-card px-4 py-3">
	<div class="mx-auto flex max-w-4xl items-center justify-between">
		<div class="flex items-center gap-3">
			<h1 class="text-xl font-bold tracking-tight">Trauma Triage Agent</h1>
			{#if mockMode}
				<Badge class="bg-purple-600 text-white hover:bg-purple-700">MOCK MODE</Badge>
			{/if}
		</div>
		<Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Toggle dark mode">
			{#if mode.current === 'dark'}
				<Sun class="size-5" />
			{:else}
				<Moon class="size-5" />
			{/if}
		</Button>
	</div>
</header>
