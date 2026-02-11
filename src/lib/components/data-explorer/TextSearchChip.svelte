<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";

	let {
		label,
		placeholder = `Search ${label.toLowerCase()}…`,
		value = $bindable(),
	}: {
		label: string;
		placeholder?: string;
		value: string;
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
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-56" align="start">
		<Input type="text" {placeholder} class="h-8 text-xs" bind:value />
	</Popover.Content>
</Popover.Root>
