<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';

	let { activeFilterCount, children }: {
		activeFilterCount: number;
		children: Snippet;
	} = $props();

	let open = $state(true);
</script>

<Collapsible.Root bind:open>
	<div class="flex items-center gap-2">
		<Collapsible.Trigger>
			{#snippet child({ props })}
				<Button variant="outline" size="sm" {...props}>
					Filters
					{#if open}
						<ChevronUp class="ml-1 size-4" />
					{:else}
						<ChevronDown class="ml-1 size-4" />
					{/if}
				</Button>
			{/snippet}
		</Collapsible.Trigger>
		{#if !open && activeFilterCount > 0}
			<Badge variant="secondary">{activeFilterCount} active</Badge>
		{/if}
	</div>
	<Collapsible.Content>
		<div class="mt-4 space-y-4">
			{@render children()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
