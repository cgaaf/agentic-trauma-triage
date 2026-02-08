import type {
  ExtractedFields,
  PlausibilityWarning,
  CriterionMatch,
  FinalActivationLevel,
  SSEEvent,
} from "$lib/types/index.js";

export type TriagePhase =
  | "idle"
  | "extracting"
  | "evaluating_vitals"
  | "analyzing_mechanism"
  | "complete"
  | "error";

class TriageState {
  phase = $state<TriagePhase>("idle");
  extractedFields = $state<ExtractedFields | null>(null);
  plausibilityWarnings = $state<PlausibilityWarning[]>([]);
  deterministicMatches = $state<CriterionMatch[]>([]);
  llmMatches = $state<CriterionMatch[]>([]);
  allMatches = $state<CriterionMatch[]>([]);
  activationLevel = $state<FinalActivationLevel | null>(null);
  justification = $state<string>("");
  agentReasoning = $state<string>("");
  missingFieldWarnings = $state<string[]>([]);
  errorMessage = $state<string>("");
  canRetry = $state(false);
  report = $state("");

  #abortController: AbortController | null = null;

  get isLoading(): boolean {
    return this.phase !== "idle" && this.phase !== "complete" && this.phase !== "error";
  }

  get hasResults(): boolean {
    return this.activationLevel !== null;
  }

  get hasError(): boolean {
    return this.phase === "error" || this.errorMessage !== "";
  }

  get hasDeterministicResults(): boolean {
    return this.deterministicMatches.length > 0;
  }

  reset() {
    this.cancel();
    this.phase = "idle";
    this.extractedFields = null;
    this.plausibilityWarnings = [];
    this.deterministicMatches = [];
    this.llmMatches = [];
    this.allMatches = [];
    this.activationLevel = null;
    this.justification = "";
    this.agentReasoning = "";
    this.missingFieldWarnings = [];
    this.errorMessage = "";
    this.canRetry = false;
    this.report = "";
  }

  cancel() {
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
  }

  async submitReport(report: string) {
    this.cancel();

    // Reset results but keep phase tracking
    this.extractedFields = null;
    this.plausibilityWarnings = [];
    this.deterministicMatches = [];
    this.llmMatches = [];
    this.allMatches = [];
    this.activationLevel = null;
    this.justification = "";
    this.agentReasoning = "";
    this.missingFieldWarnings = [];
    this.errorMessage = "";
    this.canRetry = false;
    this.report = report;
    this.phase = "extracting";

    this.#abortController = new AbortController();

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
        signal: this.#abortController.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "Request failed" }));
        this.errorMessage = errorBody.error ?? "Request failed";
        this.phase = "error";
        return;
      }

      if (!response.body) {
        this.errorMessage = "No response body received";
        this.phase = "error";
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          if (!json) continue;

          let event: SSEEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }
          this.#handleEvent(event);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      this.errorMessage = error instanceof Error ? error.message : "Connection failed";
      this.phase = "error";
    }
  }

  #handleEvent(event: SSEEvent) {
    switch (event.type) {
      case "phase":
        if (event.phase === "complete") {
          this.phase = "complete";
        } else {
          this.phase = event.phase;
        }
        break;

      case "extraction":
        this.extractedFields = event.data;
        this.plausibilityWarnings = event.warnings;
        break;

      case "deterministic":
        this.deterministicMatches = event.matches;
        break;

      case "llm_evaluation":
        this.llmMatches = event.matches;
        this.agentReasoning = event.reasoning;
        break;

      case "result":
        this.allMatches = event.data.criteriaMatches;
        this.activationLevel = event.data.activationLevel;
        this.justification = event.data.justification;
        this.agentReasoning = event.data.agentReasoning;
        this.missingFieldWarnings = event.data.missingFieldWarnings;
        break;

      case "error":
        this.errorMessage = event.message;
        this.canRetry = event.canRetry;
        if (!this.hasDeterministicResults) {
          this.phase = "error";
        }
        break;
    }
  }
}

export const triageState = new TriageState();
