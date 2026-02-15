<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import X from "@lucide/svelte/icons/x";
	import TriStateToggle from "./TriStateToggle.svelte";
	import type { NullFilterState } from "$lib/types/database.js";

	let {
		label,
		nullState = $bindable(),
		searchValue = $bindable(undefined),
		searchPlaceholder = "Search…",
		onnullchange,
		onclear,
	}: {
		label: string;
		nullState: NullFilterState;
		searchValue?: string;
		searchPlaceholder?: string;
		onnullchange?: (v: NullFilterState) => void;
		onclear?: () => void;
	} = $props();

	let hasSearch = $derived(searchValue !== undefined);
	let active = $derived(nullState !== "all");

	let chipLabel = $derived.by(() => {
		if (nullState === "has_value") {
			if (hasSearch && searchValue!.trim()) {
				const trimmed = searchValue!.trim();
				if (trimmed.length <= 20) return `${label}: ${trimmed}`;
				return `${label}: ${trimmed.slice(0, 20)}…`;
			}
			return `${label}: has value`;
		}
		if (nullState === "is_empty") return `${label}: empty`;
		return label;
	});

	function onTriStateChange(v: NullFilterState) {
		if (v !== "has_value" && hasSearch) {
			searchValue = "";
		}
		nullState = v;
		onnullchange?.(v);
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
	<Popover.Content class={hasSearch ? "w-72" : "w-auto"} align="start">
		<TriStateToggle {label} value={nullState} onchange={onTriStateChange} />
		{#if hasSearch && nullState === "has_value"}
			<Separator class="my-3" />
			<Input
				type="text"
				placeholder={searchPlaceholder}
				class="h-8 text-xs"
				bind:value={searchValue}
			/>
		{/if}
	</Popover.Content>
</Popover.Root>
