<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import type { NullFilterState } from "$lib/types/database.js";

	const EMPTY_SENTINEL = "__empty__";

	let {
		label,
		options,
		selected = $bindable(),
		nullState = $bindable(),
	}: {
		label: string;
		options: { value: string; label: string }[];
		selected: string;
		nullState: NullFilterState;
	} = $props();

	let active = $derived(selected !== "" || nullState !== "all");

	let chipLabel = $derived.by(() => {
		if (nullState === "is_empty") return `${label}: empty`;
		if (selected) {
			const opt = options.find((o) => o.value === selected);
			return `${label}: ${opt?.label ?? selected}`;
		}
		return label;
	});

	// Combine selected value + nullState into a single Select value
	let selectValue = $derived.by(() => {
		if (nullState === "is_empty") return EMPTY_SENTINEL;
		return selected;
	});

	function onValueChange(v: string | undefined) {
		const val = v ?? "";
		if (val === EMPTY_SENTINEL) {
			selected = "";
			nullState = "is_empty";
		} else {
			selected = val;
			nullState = "all";
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
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-48" align="start">
		<Select.Root type="single" value={selectValue} {onValueChange}>
			<Select.Trigger class="w-full">
				{#if nullState === "is_empty"}
					(Empty)
				{:else if selected}
					{options.find((o) => o.value === selected)?.label ?? selected}
				{:else}
					(All)
				{/if}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">(All)</Select.Item>
				{#each options as opt (opt.value)}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
				<Select.Separator />
				<Select.Item value={EMPTY_SENTINEL}>(Empty)</Select.Item>
			</Select.Content>
		</Select.Root>
	</Popover.Content>
</Popover.Root>
