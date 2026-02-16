<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Toggle } from "$lib/components/ui/toggle/index.js";
	import X from "@lucide/svelte/icons/x";

	let {
		label,
		options,
		selected = $bindable(),
		onclear,
	}: {
		label: string;
		options: string[];
		selected: string[];
		onclear?: () => void;
	} = $props();

	let active = $derived(selected.length > 0);

	let chipLabel = $derived.by(() => {
		if (selected.length === 0) return label;
		if (selected.length <= 2) return `${label}: ${selected.join(", ")}`;
		return `${label}: ${selected.length} selected`;
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
	<Popover.Content class="w-auto" align="start">
		<div class="flex flex-wrap gap-1.5">
			{#each options as option (option)}
				<Toggle
					variant="outline"
					size="sm"
					pressed={selected.includes(option)}
					onPressedChange={(pressed) => {
						if (pressed) {
							selected = [...selected, option];
						} else {
							selected = selected.filter((s) => s !== option);
						}
					}}
				>
					{option}
				</Toggle>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
