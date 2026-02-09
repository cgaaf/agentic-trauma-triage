<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn, expect, userEvent, within } from 'storybook/test';
	import ReportInput from './ReportInput.svelte';
	import { sampleReport } from './_storybook/mock-data.js';

	/**
	 * Stubs fetch and getUserMedia so AudioRecorder enters mock mode
	 * without hitting real APIs. Returns a cleanup function.
	 */
	function mockTranscriptionAPIs(options: { rejectMic?: boolean } = {}) {
		const { rejectMic = false } = options;
		const origFetch = globalThis.fetch;
		const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

		globalThis.fetch = async (input, init) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			if (url.includes('/api/transcribe/session')) {
				return new Response(JSON.stringify({ client_secret: null, mock: true }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return origFetch(input, init);
		};

		navigator.mediaDevices.getUserMedia = async (constraints) => {
			if (rejectMic) {
				const err = new DOMException('Permission denied', 'NotAllowedError');
				throw err;
			}
			return new MediaStream();
		};

		return () => {
			globalThis.fetch = origFetch;
			navigator.mediaDevices.getUserMedia = origGetUserMedia;
		};
	}

	const { Story } = defineMeta({
		title: 'Triage/ReportInput',
		component: ReportInput,
		tags: ['autodocs'],
		args: {
			onsubmit: fn(),
		},
	});
</script>

<Story name="Empty" args={{ value: '', loading: false }} />

<Story name="WithValue" args={{ value: sampleReport, loading: false }} />

<Story name="Loading" args={{ value: sampleReport, loading: true }} />

<Story
	name="SubmitInteraction"
	args={{ value: sampleReport, loading: false }}
	play={async ({ canvasElement, args }) => {
		const button = canvasElement.querySelector('button:not([disabled])');
		if (button) {
			await userEvent.click(button);
			await expect(args.onsubmit).toHaveBeenCalled();
		}
	}}
/>

<Story name="IdleCentered">
	{#snippet children()}
		<div class="flex min-h-[600px] flex-col items-center justify-center">
			<div class="w-full max-w-2xl">
				<h1 class="mb-6 text-center text-3xl font-semibold tracking-tight">
					Enter your report.
				</h1>
				<ReportInput value="" loading={false} />
			</div>
		</div>
	{/snippet}
</Story>

<Story
	name="MockTranscription"
	args={{ value: '', loading: false }}
	parameters={{ test: { timeout: 15_000 } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const cleanup = mockTranscriptionAPIs();
		try {
			const micButton = canvas.getByRole('button', { name: 'Record audio' });
			await userEvent.click(micButton);
			await canvas.findByRole('button', { name: 'Stop recording' });
		} finally {
			cleanup();
		}
	}}
/>

<Story name="RealTranscription">
	{#snippet children()}
		<div
			class="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
		>
			<p class="font-medium">Prerequisites</p>
			<ul class="mt-1 list-inside list-disc space-y-1">
				<li>
					SvelteKit dev server must be running (<code
						class="rounded bg-amber-100 px-1 dark:bg-amber-900">pnpm dev</code
					>)
				</li>
				<li>
					Default proxy target: <code class="rounded bg-amber-100 px-1 dark:bg-amber-900"
						>localhost:5173</code
					>
				</li>
				<li>
					To change: <code class="rounded bg-amber-100 px-1 dark:bg-amber-900"
						>STORYBOOK_API_TARGET=http://host:port pnpm storybook</code
					>
				</li>
			</ul>
		</div>
		<ReportInput value="" loading={false} />
	{/snippet}
</Story>

<Story
	name="MicrophoneDenied"
	args={{ value: '', loading: false }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const cleanup = mockTranscriptionAPIs({ rejectMic: true });
		try {
			const micButton = canvas.getByRole('button', { name: 'Record audio' });
			await userEvent.click(micButton);
			const errorText = await canvas.findByText(/microphone access denied/i);
			await expect(errorText).toBeInTheDocument();
		} finally {
			cleanup();
		}
	}}
/>
