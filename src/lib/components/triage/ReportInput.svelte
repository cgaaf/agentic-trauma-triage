<script lang="ts">
	import { tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import {
		SendHorizonal,
		ChevronDown,
		ClipboardList,
		Stethoscope,
		Zap,
		Sparkles,
		Mic,
		Loader2,
	} from '@lucide/svelte';
	import { exampleReports } from '$lib/data/example-reports.js';
	import { AudioRecorder } from '$lib/audio/recorder.svelte.js';

	let {
		value = $bindable(''),
		loading = false,
		onsubmit,
	}: {
		value?: string;
		loading?: boolean;
		onsubmit?: (report: string) => void;
	} = $props();

	let textareaRef: HTMLTextAreaElement | null = $state(null);
	let whatToIncludeOpen = $state(false);
	let howItWorksOpen = $state(false);

	const recorder = new AudioRecorder();

	recorder.onAutoStop = () => {
		transcribeAndSubmit();
	};

	const showExamples = $derived(!value.trim() && !loading && recorder.isIdle);

	async function selectExample(text: string) {
		const el = textareaRef;
		const startHeight = el?.offsetHeight ?? 0;

		value = text;
		await tick();

		if (el) {
			const endHeight = el.offsetHeight;
			if (startHeight !== endHeight) {
				el.animate(
					[
						{ height: `${startHeight}px`, overflow: 'hidden' },
						{ height: `${endHeight}px`, overflow: 'hidden' },
					],
					{ duration: 300, easing: 'ease-out' },
				);
			}
		}
	}

	function handleSubmit() {
		if (value.trim() && onsubmit) {
			onsubmit(value.trim());
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		}
	}

	async function transcribeAndSubmit() {
		recorder.stop();
		const blob = recorder.getBlob();
		recorder.setTranscribing();

		try {
			const form = new FormData();
			form.append('audio', blob, 'recording.webm');

			const res = await fetch('/api/transcribe', {
				method: 'POST',
				body: form,
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({ error: 'Transcription failed' }));
				throw new Error(body.error ?? `Transcription failed (${res.status})`);
			}

			const { text } = await res.json();
			value = text;
			recorder.reset();
			await tick();
			handleSubmit();
		} catch (err) {
			recorder.error = err instanceof Error ? err.message : 'Transcription failed';
			recorder.reset();
		}
	}

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	$effect(() => {
		return () => recorder.destroy();
	});
</script>

<div class="w-full space-y-3">
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="relative rounded-2xl bg-muted/50 shadow-sm transition-shadow focus-within:shadow-md dark:bg-muted/30"
		onkeydown={handleKeydown}
		role="form"
	>
		<Textarea
			bind:ref={textareaRef}
			bind:value
			placeholder="Describe the patient, their vitals, and what happened..."
			rows={1}
			class="min-h-0 resize-none rounded-2xl border-none bg-transparent pt-4 pb-14 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0"
			disabled={loading || !recorder.isIdle}
		/>
		<div class="absolute bottom-3 right-3 flex items-center gap-2">
			{#if recorder.isRecording}
				<span class="font-mono text-sm tabular-nums text-destructive">
					{formatDuration(recorder.duration)}
				</span>
				<Button
					size="icon"
					variant="destructive"
					class="animate-pulse rounded-full"
					onclick={transcribeAndSubmit}
				>
					<Mic class="size-4" />
					<span class="sr-only">Stop recording</span>
				</Button>
			{:else if recorder.isTranscribing}
				<Button size="icon" class="rounded-full" disabled>
					<Loader2 class="size-4 animate-spin" />
					<span class="sr-only">Transcribing</span>
				</Button>
			{:else if value.trim()}
				<Button
					size="icon"
					class="rounded-full"
					onclick={handleSubmit}
					disabled={loading}
				>
					<SendHorizonal class="size-4" />
					<span class="sr-only">Evaluate</span>
				</Button>
			{:else}
				<Button
					size="icon"
					variant="outline"
					class="rounded-full"
					onclick={() => recorder.start()}
					disabled={loading}
				>
					<Mic class="size-4" />
					<span class="sr-only">Record audio</span>
				</Button>
			{/if}
		</div>
	</div>

	{#if recorder.error}
		<p class="text-sm text-destructive">{recorder.error}</p>
	{/if}

	{#if showExamples}
		<div class="flex flex-wrap items-center justify-center gap-2" transition:slide={{ duration: 200 }}>
			<span class="flex items-center gap-1 text-xs text-muted-foreground">
				<Sparkles class="size-3" />
				Try an example
			</span>
			{#each exampleReports as example (example.label)}
				<button
					type="button"
					class="cursor-pointer rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
					onclick={() => selectExample(example.text)}
					title={example.description}
				>
					{example.label}
				</button>
			{/each}
		</div>
	{/if}

	<div class="flex justify-center gap-3">
		<Collapsible.Root bind:open={whatToIncludeOpen}>
			<Collapsible.Trigger
				class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				What to include
				<ChevronDown
					class="size-3 transition-transform duration-200 {whatToIncludeOpen ? 'rotate-180' : ''}"
				/>
			</Collapsible.Trigger>
		</Collapsible.Root>

		<Collapsible.Root bind:open={howItWorksOpen}>
			<Collapsible.Trigger
				class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				How does this work?
				<ChevronDown
					class="size-3 transition-transform duration-200 {howItWorksOpen ? 'rotate-180' : ''}"
				/>
			</Collapsible.Trigger>
		</Collapsible.Root>
	</div>

	{#if whatToIncludeOpen}
		<div class="mt-1 flex flex-wrap justify-center gap-2">
			<Badge variant="secondary">Age *</Badge>
			<Badge variant="outline">SBP</Badge>
			<Badge variant="outline">HR</Badge>
			<Badge variant="outline">RR</Badge>
			<Badge variant="outline">GCS</Badge>
			<Badge variant="outline">Mechanism</Badge>
			<Badge variant="outline">Injuries</Badge>
		</div>
		<p class="mt-2 text-center text-xs text-muted-foreground">
			* Age is required. More fields lead to a more complete evaluation.
		</p>
	{/if}

	{#if howItWorksOpen}
		<div class="mt-3 grid gap-4 sm:grid-cols-3">
			<div class="flex flex-col items-center gap-2 text-center">
				<div class="flex size-10 items-center justify-center rounded-full bg-muted">
					<ClipboardList class="size-5 text-muted-foreground" />
				</div>
				<p class="text-sm font-medium">Extract</p>
				<p class="text-xs text-muted-foreground">
					Clinical fields are extracted from your narrative
				</p>
			</div>
			<div class="flex flex-col items-center gap-2 text-center">
				<div class="flex size-10 items-center justify-center rounded-full bg-muted">
					<Stethoscope class="size-5 text-muted-foreground" />
				</div>
				<p class="text-sm font-medium">Evaluate</p>
				<p class="text-xs text-muted-foreground">
					137 criteria are checked against the patient data
				</p>
			</div>
			<div class="flex flex-col items-center gap-2 text-center">
				<div class="flex size-10 items-center justify-center rounded-full bg-muted">
					<Zap class="size-5 text-muted-foreground" />
				</div>
				<p class="text-sm font-medium">Activate</p>
				<p class="text-xs text-muted-foreground">
					A recommended trauma activation level is determined
				</p>
			</div>
		</div>
	{/if}
</div>
