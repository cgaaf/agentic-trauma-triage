<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown } from '@lucide/svelte';

	let { reasoning }: { reasoning: string } = $props();
	let open = $state(false);
</script>

{#if reasoning}
	<div>
		<Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" onclick={() => (open = !open)}>
			<ChevronDown class="size-4 transition-transform {open ? 'rotate-180' : ''}" />
			Agent Reasoning
		</Button>
		{#if open}
			<div class="mt-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
				{reasoning}
			</div>
		{/if}
	</div>
{/if}
