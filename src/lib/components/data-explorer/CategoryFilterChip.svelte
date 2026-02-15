<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import X from "@lucide/svelte/icons/x";
	import type { NullFilterState } from "$lib/types/database.js";

	const EMPTY_SENTINEL = "__empty__";

	let {
		label,
		options,
		selected = $bindable(),
		nullState = $bindable(),
		onchange,
		onclear,
	}: {
		label: string;
		options: { value: string; label: string }[];
		selected: string;
		nullState: NullFilterState;
		onchange?: (selected: string, nullState: NullFilterState) => void;
		onclear?: () => void;
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
			onchange?.("", "is_empty");
		} else {
			selected = val;
			nullState = "all";
			onchange?.(val, "all");
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
	<Popover.Content class="w-56" align="start">
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
