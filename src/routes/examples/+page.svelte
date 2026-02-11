<script lang="ts">
	import type { ExampleWithCriterion, NullFilterState } from "$lib/types/database.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import TextSearchChip from "$lib/components/data-explorer/TextSearchChip.svelte";
	import ResultsCount from "$lib/components/data-explorer/ResultsCount.svelte";
	import ExamplesTable from "$lib/components/data-explorer/ExamplesTable.svelte";
	import ExampleCriterionSheet from "$lib/components/data-explorer/ExampleCriterionSheet.svelte";
	import VitalFilterChip from "$lib/components/data-explorer/VitalFilterChip.svelte";
	import CategoryFilterChip from "$lib/components/data-explorer/CategoryFilterChip.svelte";
	import NullFilterChip from "$lib/components/data-explorer/NullFilterChip.svelte";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";

	let { data } = $props();

	// ─── Helpers ────────────────────────────────────────────────────
	function parseRange(param: string | null): [number, number] | null {
		if (!param) return null;
		const parts = param.split(",").map(Number);
		if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
			return [parts[0], parts[1]] as [number, number];
		}
		return null;
	}

	const nullFilterColumns = [
		"gender",
		"descriptors",
		"gcs",
		"systolic_bp",
		"heart_rate",
		"respiratory_rate",
		"oxygen_saturation",
		"pregnancy_in_weeks",
		"airway",
		"breathing",
		"criteria_id",
	];

	function initNullFilters(): Record<string, NullFilterState> {
		const filters: Record<string, NullFilterState> = {};
		for (const col of nullFilterColumns) {
			const param = page.url.searchParams.get(`null_${col}`);
			filters[col] = param === "has_value" || param === "is_empty" ? param : "all";
		}
		// Backward compat: if URL has vital range param but no null_* param, auto-set to "has_value"
		if (page.url.searchParams.has("gcs") && filters.gcs === "all") filters.gcs = "has_value";
		if (page.url.searchParams.has("sbp") && filters.systolic_bp === "all")
			filters.systolic_bp = "has_value";
		if (page.url.searchParams.has("hr") && filters.heart_rate === "all")
			filters.heart_rate = "has_value";
		if (page.url.searchParams.has("rr") && filters.respiratory_rate === "all")
			filters.respiratory_rate = "has_value";
		if (page.url.searchParams.has("spo2") && filters.oxygen_saturation === "all")
			filters.oxygen_saturation = "has_value";
		return filters;
	}

	// ─── Filter state (initialized from URL params) ─────────────────
	let gcsRange: [number, number] = $state(parseRange(page.url.searchParams.get("gcs")) ?? [3, 15]);
	let sbpRange: [number, number] = $state(
		parseRange(page.url.searchParams.get("sbp")) ?? [60, 200],
	);
	let hrRange: [number, number] = $state(
		parseRange(page.url.searchParams.get("hr")) ?? [40, 180],
	);
	let rrRange: [number, number] = $state(
		parseRange(page.url.searchParams.get("rr")) ?? [10, 30],
	);
	let spo2Range: [number, number] = $state(
		parseRange(page.url.searchParams.get("spo2")) ?? [90, 100],
	);

	let airway: string = $state(page.url.searchParams.get("airway") ?? "");
	let breathing: string = $state(page.url.searchParams.get("breathing") ?? "");
	let search: string = $state(page.url.searchParams.get("search") ?? "");
	let criterionSearch: string = $state(page.url.searchParams.get("criterion_search") ?? "");
	let descriptorsSearch: string = $state(page.url.searchParams.get("descriptors_search") ?? "");

	let nullFilters: Record<string, NullFilterState> = $state(initNullFilters());

	// Vital active states derived from nullFilters
	let gcsActive = $derived(nullFilters.gcs === "has_value");
	let sbpActive = $derived(nullFilters.systolic_bp === "has_value");
	let hrActive = $derived(nullFilters.heart_rate === "has_value");
	let rrActive = $derived(nullFilters.respiratory_rate === "has_value");
	let spo2Active = $derived(nullFilters.oxygen_saturation === "has_value");

	// Category options
	const airwayOptions = [
		{ value: "patent", label: "patent" },
		{ value: "intubated", label: "intubated" },
		{ value: "extraglottic", label: "extraglottic" },
		{ value: "compromised", label: "compromised" },
	];

	const breathingOptions = [
		{ value: "Breathing Independently", label: "Breathing Independently" },
		{ value: "Bagging", label: "Bagging" },
		{ value: "Ventilator", label: "Ventilator" },
	];

	// ─── Derived filtering ──────────────────────────────────────────
	let filteredExamples = $derived.by(() => {
		let result = data.examples;

		// Vital range filters (only when active, exclude NULLs)
		if (gcsActive) {
			result = result.filter(
				(e) => e.gcs !== null && e.gcs >= gcsRange[0] && e.gcs <= gcsRange[1],
			);
		}
		if (sbpActive) {
			result = result.filter(
				(e) =>
					e.systolic_bp !== null &&
					e.systolic_bp >= sbpRange[0] &&
					e.systolic_bp <= sbpRange[1],
			);
		}
		if (hrActive) {
			result = result.filter(
				(e) =>
					e.heart_rate !== null &&
					e.heart_rate >= hrRange[0] &&
					e.heart_rate <= hrRange[1],
			);
		}
		if (rrActive) {
			result = result.filter(
				(e) =>
					e.respiratory_rate !== null &&
					e.respiratory_rate >= rrRange[0] &&
					e.respiratory_rate <= rrRange[1],
			);
		}
		if (spo2Active) {
			result = result.filter(
				(e) =>
					e.oxygen_saturation !== null &&
					e.oxygen_saturation >= spo2Range[0] &&
					e.oxygen_saturation <= spo2Range[1],
			);
		}

		// Select filters
		if (airway) {
			result = result.filter((e) => e.airway === airway);
		}
		if (breathing) {
			result = result.filter((e) => e.breathing === breathing);
		}

		// Text search (mechanism)
		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter((e) => e.mechanism.toLowerCase().includes(q));
		}

		// Text search (criterion description)
		if (criterionSearch.trim()) {
			const q = criterionSearch.toLowerCase();
			result = result.filter((e) => e.criteria?.description?.toLowerCase().includes(q));
		}

		// Text search (descriptors)
		if (descriptorsSearch.trim()) {
			const q = descriptorsSearch.toLowerCase();
			result = result.filter((e) => e.descriptors?.toLowerCase().includes(q));
		}

		// Null filters (skip vitals — already handled by range filters above)
		const vitalCols = new Set(["gcs", "systolic_bp", "heart_rate", "respiratory_rate", "oxygen_saturation"]);
		for (const [col, state] of Object.entries(nullFilters)) {
			if (state === "all") continue;
			if (vitalCols.has(col) && state === "has_value") continue; // handled by range filter
			const key = col as keyof ExampleWithCriterion;
			if (state === "has_value") {
				result = result.filter((e) => {
					if (key === "criteria_id") return e.criteria_id !== null;
					return e[key] !== null && e[key] !== undefined;
				});
			} else {
				result = result.filter((e) => {
					if (key === "criteria_id") return e.criteria_id === null;
					return e[key] === null || e[key] === undefined;
				});
			}
		}

		return result;
	});

	// ─── Active filter count ────────────────────────────────────────
	let activeFilterCount = $derived(
		(airway ? 1 : 0) +
			(breathing ? 1 : 0) +
			(search.trim() ? 1 : 0) +
			(criterionSearch.trim() ? 1 : 0) +
			(descriptorsSearch.trim() ? 1 : 0) +
			Object.values(nullFilters).filter((s) => s !== "all").length,
	);

	// ─── URL sync (debounced) ───────────────────────────────────────
	let syncTimeout: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// Read all filter values to track them
		const _gcsRange = gcsRange;
		const _sbpRange = sbpRange;
		const _hrRange = hrRange;
		const _rrRange = rrRange;
		const _spo2Range = spo2Range;
		const _airway = airway;
		const _breathing = breathing;
		const _search = search;
		const _criterionSearch = criterionSearch;
		const _descriptorsSearch = descriptorsSearch;
		const _nullFilters = nullFilters;

		clearTimeout(syncTimeout);

		syncTimeout = setTimeout(() => {
			const params = new URLSearchParams();

			if (_nullFilters.gcs === "has_value") params.set("gcs", _gcsRange.join(","));
			if (_nullFilters.systolic_bp === "has_value") params.set("sbp", _sbpRange.join(","));
			if (_nullFilters.heart_rate === "has_value") params.set("hr", _hrRange.join(","));
			if (_nullFilters.respiratory_rate === "has_value") params.set("rr", _rrRange.join(","));
			if (_nullFilters.oxygen_saturation === "has_value")
				params.set("spo2", _spo2Range.join(","));
			if (_airway) params.set("airway", _airway);
			if (_breathing) params.set("breathing", _breathing);
			if (_search.trim()) params.set("search", _search.trim());
			if (_criterionSearch.trim()) params.set("criterion_search", _criterionSearch.trim());
			if (_descriptorsSearch.trim()) params.set("descriptors_search", _descriptorsSearch.trim());

			for (const [col, state] of Object.entries(_nullFilters)) {
				if (state !== "all") {
					params.set(`null_${col}`, state);
				}
			}

			const query = params.toString();
			const target = query ? `?${query}` : page.url.pathname;

			goto(target, { replaceState: true, noScroll: true });
		}, 300);

		return () => clearTimeout(syncTimeout);
	});

	// ─── Sheet state ────────────────────────────────────────────────
	let sheetOpen = $state(false);
	let selectedExample = $state<ExampleWithCriterion | null>(null);

	function openSheet(example: ExampleWithCriterion) {
		selectedExample = example;
		sheetOpen = true;
	}

	// ─── Clear all filters ──────────────────────────────────────────
	function clearFilters() {
		gcsRange = [3, 15];
		sbpRange = [60, 200];
		hrRange = [40, 180];
		rrRange = [10, 30];
		spo2Range = [90, 100];
		airway = "";
		breathing = "";
		search = "";
		criterionSearch = "";
		descriptorsSearch = "";
		const reset: Record<string, NullFilterState> = {};
		for (const col of nullFilterColumns) {
			reset[col] = "all";
		}
		nullFilters = reset;
	}
</script>

<svelte:head>
	<title>Examples Explorer</title>
</svelte:head>

<div class="container mx-auto max-w-[1400px] space-y-4 p-4">
	<h1 class="text-2xl font-bold tracking-tight">Examples Explorer</h1>

	<!-- Chip bar -->
	<div class="flex flex-wrap items-center gap-2">
		<NullFilterChip
			label="Criterion"
			bind:nullState={nullFilters.criteria_id}
			bind:searchValue={criterionSearch}
			searchPlaceholder="Search criteria…"
		/>
		<TextSearchChip label="Mechanism" placeholder="Search mechanism…" bind:value={search} />
		<NullFilterChip
			label="Descriptors"
			bind:nullState={nullFilters.descriptors}
			bind:searchValue={descriptorsSearch}
			searchPlaceholder="Search descriptors…"
		/>
		<NullFilterChip label="Gender" bind:nullState={nullFilters.gender} />
		<VitalFilterChip
			label="GCS"
			min={3}
			max={15}
			bind:nullState={nullFilters.gcs}
			bind:range={gcsRange}
		/>
		<VitalFilterChip
			label="SBP"
			min={0}
			max={300}
			bind:nullState={nullFilters.systolic_bp}
			bind:range={sbpRange}
		/>
		<VitalFilterChip
			label="HR"
			min={0}
			max={250}
			bind:nullState={nullFilters.heart_rate}
			bind:range={hrRange}
		/>
		<VitalFilterChip
			label="RR"
			min={0}
			max={60}
			bind:nullState={nullFilters.respiratory_rate}
			bind:range={rrRange}
		/>
		<CategoryFilterChip
			label="Airway"
			options={airwayOptions}
			bind:selected={airway}
			bind:nullState={nullFilters.airway}
		/>
		<CategoryFilterChip
			label="Breathing"
			options={breathingOptions}
			bind:selected={breathing}
			bind:nullState={nullFilters.breathing}
		/>
		<VitalFilterChip
			label="SpO2"
			min={0}
			max={100}
			bind:nullState={nullFilters.oxygen_saturation}
			bind:range={spo2Range}
		/>
		<NullFilterChip label="Pregnancy" bind:nullState={nullFilters.pregnancy_in_weeks} />

		{#if activeFilterCount > 0}
			<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={clearFilters}>
				Clear all
			</Button>
		{/if}
	</div>

	<ResultsCount
		filtered={filteredExamples.length}
		total={data.examples.length}
		hasActiveFilters={activeFilterCount > 0}
		onclear={clearFilters}
	/>

	<ExamplesTable examples={filteredExamples} onrowclick={openSheet} />

	<ExampleCriterionSheet example={selectedExample} bind:open={sheetOpen} />
</div>
