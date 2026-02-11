<script lang="ts">
	import type { ExampleWithCriterion, NullFilterState } from "$lib/types/database.js";
	import FilterPanel from "$lib/components/data-explorer/FilterPanel.svelte";
	import ResultsCount from "$lib/components/data-explorer/ResultsCount.svelte";
	import ExamplesFilters from "$lib/components/data-explorer/ExamplesFilters.svelte";
	import ExamplesTable from "$lib/components/data-explorer/ExamplesTable.svelte";
	import ExampleCriterionSheet from "$lib/components/data-explorer/ExampleCriterionSheet.svelte";
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
		return filters;
	}

	// ─── Filter state (initialized from URL params) ─────────────────
	const initGcs = parseRange(page.url.searchParams.get("gcs"));
	let gcsActive: boolean = $state(initGcs !== null);
	let gcsRange: [number, number] = $state(initGcs ?? [3, 15]);

	const initSbp = parseRange(page.url.searchParams.get("sbp"));
	let sbpActive: boolean = $state(initSbp !== null);
	let sbpRange: [number, number] = $state(initSbp ?? [60, 200]);

	const initHr = parseRange(page.url.searchParams.get("hr"));
	let hrActive: boolean = $state(initHr !== null);
	let hrRange: [number, number] = $state(initHr ?? [40, 180]);

	const initRr = parseRange(page.url.searchParams.get("rr"));
	let rrActive: boolean = $state(initRr !== null);
	let rrRange: [number, number] = $state(initRr ?? [10, 30]);

	const initSpo2 = parseRange(page.url.searchParams.get("spo2"));
	let spo2Active: boolean = $state(initSpo2 !== null);
	let spo2Range: [number, number] = $state(initSpo2 ?? [90, 100]);

	let airway: string = $state(page.url.searchParams.get("airway") ?? "");
	let breathing: string = $state(page.url.searchParams.get("breathing") ?? "");
	let search: string = $state(page.url.searchParams.get("search") ?? "");

	let nullFilters: Record<string, NullFilterState> = $state(initNullFilters());

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

		// Text search (mechanism + descriptors)
		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter(
				(e) =>
					e.mechanism.toLowerCase().includes(q) ||
					(e.descriptors && e.descriptors.toLowerCase().includes(q)),
			);
		}

		// Null filters
		for (const [col, state] of Object.entries(nullFilters)) {
			if (state === "all") continue;
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
		(gcsActive ? 1 : 0) +
			(sbpActive ? 1 : 0) +
			(hrActive ? 1 : 0) +
			(rrActive ? 1 : 0) +
			(spo2Active ? 1 : 0) +
			(airway ? 1 : 0) +
			(breathing ? 1 : 0) +
			(search.trim() ? 1 : 0) +
			Object.values(nullFilters).filter((s) => s !== "all").length,
	);

	// ─── URL sync (debounced) ───────────────────────────────────────
	let syncTimeout: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// Read all filter values to track them
		const _gcsActive = gcsActive;
		const _gcsRange = gcsRange;
		const _sbpActive = sbpActive;
		const _sbpRange = sbpRange;
		const _hrActive = hrActive;
		const _hrRange = hrRange;
		const _rrActive = rrActive;
		const _rrRange = rrRange;
		const _spo2Active = spo2Active;
		const _spo2Range = spo2Range;
		const _airway = airway;
		const _breathing = breathing;
		const _search = search;
		const _nullFilters = nullFilters;

		clearTimeout(syncTimeout);

		syncTimeout = setTimeout(() => {
			const params = new URLSearchParams();

			if (_gcsActive) params.set("gcs", _gcsRange.join(","));
			if (_sbpActive) params.set("sbp", _sbpRange.join(","));
			if (_hrActive) params.set("hr", _hrRange.join(","));
			if (_rrActive) params.set("rr", _rrRange.join(","));
			if (_spo2Active) params.set("spo2", _spo2Range.join(","));
			if (_airway) params.set("airway", _airway);
			if (_breathing) params.set("breathing", _breathing);
			if (_search.trim()) params.set("search", _search.trim());

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
		gcsActive = false;
		gcsRange = [3, 15];
		sbpActive = false;
		sbpRange = [60, 200];
		hrActive = false;
		hrRange = [40, 180];
		rrActive = false;
		rrRange = [10, 30];
		spo2Active = false;
		spo2Range = [90, 100];
		airway = "";
		breathing = "";
		search = "";
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

	<FilterPanel {activeFilterCount}>
		<ExamplesFilters
			bind:gcsActive
			bind:gcsRange
			bind:sbpActive
			bind:sbpRange
			bind:hrActive
			bind:hrRange
			bind:rrActive
			bind:rrRange
			bind:spo2Active
			bind:spo2Range
			bind:airway
			bind:breathing
			bind:search
			bind:nullFilters
		/>
	</FilterPanel>

	<ResultsCount
		filtered={filteredExamples.length}
		total={data.examples.length}
		hasActiveFilters={activeFilterCount > 0}
		onclear={clearFilters}
	/>

	<ExamplesTable examples={filteredExamples} oncriterionclick={openSheet} />

	<ExampleCriterionSheet example={selectedExample} bind:open={sheetOpen} />
</div>
