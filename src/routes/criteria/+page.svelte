<script lang="ts">
	import type { CriteriaRow } from "$lib/types/database.js";
	import FilterPanel from "$lib/components/data-explorer/FilterPanel.svelte";
	import ResultsCount from "$lib/components/data-explorer/ResultsCount.svelte";
	import CriteriaFilters from "$lib/components/data-explorer/CriteriaFilters.svelte";
	import CriteriaTable from "$lib/components/data-explorer/CriteriaTable.svelte";
	import CriteriaExamplesSheet from "$lib/components/data-explorer/CriteriaExamplesSheet.svelte";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";

	let { data } = $props();

	// ─── Filter state (initialized from URL params) ─────────────────
	let levels: string[] = $state(
		page.url.searchParams.get("levels")?.split(",").filter(Boolean) ?? [],
	);
	let categories: string[] = $state(
		page.url.searchParams.get("categories")?.split(",").filter(Boolean) ?? [],
	);
	let age: number | null = $state(
		page.url.searchParams.has("age")
			? parseInt(page.url.searchParams.get("age")!, 10)
			: null,
	);
	let search: string = $state(page.url.searchParams.get("search") ?? "");

	// ─── Derived filtering ──────────────────────────────────────────
	let filteredCriteria = $derived.by(() => {
		let result = data.criteria;

		if (levels.length > 0) {
			result = result.filter((c) => levels.includes(c.activation_level));
		}
		if (categories.length > 0) {
			result = result.filter((c) => categories.includes(c.category));
		}
		if (age !== null) {
			result = result.filter(
				(c) => c.age_min <= age! && (c.age_max === null || c.age_max >= age!),
			);
		}
		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter((c) => c.description.toLowerCase().includes(q));
		}

		return result;
	});

	// ─── Active filter count ────────────────────────────────────────
	let activeFilterCount = $derived(
		(levels.length > 0 ? 1 : 0) +
			(categories.length > 0 ? 1 : 0) +
			(age !== null ? 1 : 0) +
			(search.trim() ? 1 : 0),
	);

	// ─── URL sync (debounced for search, immediate for others) ──────
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// Read all filter values to track them
		const _levels = levels;
		const _categories = categories;
		const _age = age;
		const _search = search;

		clearTimeout(searchTimeout);

		searchTimeout = setTimeout(
			() => {
				const params = new URLSearchParams();

				if (_levels.length > 0) params.set("levels", _levels.join(","));
				if (_categories.length > 0) params.set("categories", _categories.join(","));
				if (_age !== null) params.set("age", String(_age));
				if (_search.trim()) params.set("search", _search.trim());

				const query = params.toString();
				const target = query ? `?${query}` : page.url.pathname;

				goto(target, { replaceState: true, noScroll: true });
			},
			// Debounce 300ms only when search changes; otherwise immediate
			300,
		);

		return () => clearTimeout(searchTimeout);
	});

	// ─── Sheet state ────────────────────────────────────────────────
	let sheetOpen = $state(false);
	let selectedCriterion = $state<CriteriaRow | null>(null);

	function openSheet(criterion: CriteriaRow) {
		selectedCriterion = criterion;
		sheetOpen = true;
	}

	// ─── Clear all filters ──────────────────────────────────────────
	function clearFilters() {
		levels = [];
		categories = [];
		age = null;
		search = "";
	}
</script>

<svelte:head>
	<title>Criteria Explorer</title>
</svelte:head>

<div class="container mx-auto max-w-7xl space-y-4 p-4">
	<h1 class="text-2xl font-bold tracking-tight">Criteria Explorer</h1>

	<FilterPanel {activeFilterCount}>
		<CriteriaFilters bind:levels bind:categories bind:age bind:search />
	</FilterPanel>

	<ResultsCount
		filtered={filteredCriteria.length}
		total={data.criteria.length}
		hasActiveFilters={activeFilterCount > 0}
		onclear={clearFilters}
	/>

	<CriteriaTable criteria={filteredCriteria} onrowclick={openSheet} />

	<CriteriaExamplesSheet criterion={selectedCriterion} bind:open={sheetOpen} />
</div>
