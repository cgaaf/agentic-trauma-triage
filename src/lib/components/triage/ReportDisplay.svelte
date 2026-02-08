<script lang="ts">
	import { tick } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';

	let { text, expanded = $bindable(false) }: { text: string; expanded?: boolean } = $props();
	let containerEl: HTMLDivElement | undefined = $state();
	let animatedHeight = $state<number | null>(null);

	async function toggle() {
		if (!containerEl) return;

		const startHeight = containerEl.scrollHeight;
		expanded = !expanded;
		await tick();

		const endHeight = containerEl.scrollHeight;
		animatedHeight = startHeight;
		await tick();

		containerEl.offsetHeight; // force reflow
		animatedHeight = endHeight;
	}
</script>

<div
	bind:this={containerEl}
	class="overflow-hidden rounded-lg border bg-muted/30 transition-[height] duration-200 ease-out hover:bg-muted/50"
	style:height={animatedHeight !== null ? `${animatedHeight}px` : 'auto'}
	ontransitionend={(e) => {
		if (e.propertyName === 'height') animatedHeight = null;
	}}
>
	<button
		type="button"
		class="flex w-full items-start gap-3 px-4 py-2.5 text-left"
		aria-expanded={expanded}
		onclick={toggle}
	>
		<span
			class="flex-1 text-sm text-muted-foreground {expanded ? 'whitespace-pre-wrap' : 'truncate'}"
			>{text}</span
		>
		<ChevronDown
			class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 {expanded ? 'rotate-180' : ''}"
		/>
	</button>
</div>
