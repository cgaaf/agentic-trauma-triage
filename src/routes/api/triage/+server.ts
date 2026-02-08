import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";
import { runPipeline } from "$lib/server/pipeline.js";

export const POST: RequestHandler = async ({ request }) => {
  let body: { report?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const MAX_REPORT_LENGTH = 50_000;

  const report = body.report;
  if (!report || typeof report !== "string" || report.trim().length === 0) {
    return json({ error: 'Missing or empty "report" field' }, { status: 400 });
  }

  if (report.length > MAX_REPORT_LENGTH) {
    return json(
      { error: `Report exceeds maximum length of ${MAX_REPORT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const pipeline = runPipeline(report.trim());

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of pipeline) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (error) {
        console.error("[triage] Pipeline error:", error);
        const errorEvent = {
          type: "error",
          message: "An error occurred during triage processing",
          phase: "unknown",
          canRetry: true,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
