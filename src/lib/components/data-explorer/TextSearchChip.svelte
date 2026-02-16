<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import X from "@lucide/svelte/icons/x";

	let {
		label,
		placeholder = `Search ${label.toLowerCase()}…`,
		value = $bindable(),
		onclear,
	}: {
		label: string;
		placeholder?: string;
		value: string;
		onclear?: () => void;
	} = $props();

	let active = $derived(value.trim() !== "");

	let chipLabel = $derived.by(() => {
		const trimmed = value.trim();
		if (!trimmed) return label;
		if (trimmed.length <= 20) return `${label}: ${trimmed}`;
		return `${label}: ${trimmed.slice(0, 20)}…`;
	});
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				variant={active ? "secondary" : "outline"}
				size="sm"
				class="h-7 gap-1 text-xs"
				{...props}
			>
				{#if active}
					<span class="bg-primary size-1.5 rounded-full"></span>
				{/if}
				{chipLabel}
				{#if active && onclear}
					<button
						type="button"
						class="hover:bg-muted -mr-1 ml-0.5 rounded-sm p-0.5"
						onclick={(e) => { e.stopPropagation(); onclear(); }}
						aria-label="Clear {label} filter"
					>
						<X class="size-3" />
					</button>
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-72" align="start">
		<Input type="text" {placeholder} class="h-8 text-xs" bind:value />
	</Popover.Content>
</Popover.Root>
