<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import X from "@lucide/svelte/icons/x";

	let {
		label,
		value = $bindable(),
		min = 0,
		max = 120,
		placeholder = "e.g. 25",
		onclear,
	}: {
		label: string;
		value: number | null;
		min?: number;
		max?: number;
		placeholder?: string;
		onclear?: () => void;
	} = $props();

	let active = $derived(value !== null);
	let chipLabel = $derived(value !== null ? `${label}: ${value}` : label);

	let inputValue = $state(value !== null ? String(value) : "");

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const val = target.value.trim();
		if (val === "") {
			value = null;
			inputValue = "";
		} else {
			const parsed = parseInt(val, 10);
			if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) {
				value = parsed;
				inputValue = val;
			}
		}
	}
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
	<Popover.Content class="w-48" align="start">
		<Input
			type="number"
			{placeholder}
			{min}
			{max}
			class="h-8 text-xs"
			value={inputValue}
			oninput={handleInput}
		/>
	</Popover.Content>
</Popover.Root>
