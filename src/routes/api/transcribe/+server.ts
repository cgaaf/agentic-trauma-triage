import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";
import { isOpenAIMockMode } from "$lib/server/config.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MEDICAL_PROMPT =
  "EMS trauma report. Terms: GCS, SBP, HR, RR, SpO2, MVC, MCC, LOC, " +
  "pneumothorax, hemothorax, flail chest, pelvic fracture, femur fracture, " +
  "TBI, intubated, tourniquet, bilateral, lateral, proximal, distal.";

const MOCK_NARRATIVE =
  "45-year-old male involved in a high-speed MVC, " +
  "unrestrained driver. GCS 12, SBP 88, HR 120, RR 28. " +
  "Obvious deformity to the left femur with significant swelling. " +
  "Complaining of chest pain with decreased breath sounds on the left side. " +
  "Two large-bore IVs established, one liter normal saline bolus initiated.";

export const POST: RequestHandler = async ({ request }) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("audio");
  if (!file || !(file instanceof File)) {
    return json({ error: 'Missing "audio" file field' }, { status: 400 });
  }

  if (file.size === 0) {
    return json({ error: "Audio file is empty" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return json({ error: "Audio file exceeds 10 MB limit" }, { status: 400 });
  }

  if (isOpenAIMockMode()) {
    await new Promise((r) => setTimeout(r, 800));
    return json({ text: MOCK_NARRATIVE });
  }

  try {
    const { getOpenAIClient, TRANSCRIPTION_MODEL } = await import("$lib/server/llm/openai.js");
    const client = getOpenAIClient();

    const transcription = await client.audio.transcriptions.create({
      file,
      model: TRANSCRIPTION_MODEL,
      prompt: MEDICAL_PROMPT,
    });

    return json({ text: transcription.text });
  } catch (err) {
    console.error("[transcribe] OpenAI API error:", err);
    return json(
      { error: "Transcription failed. Please try again or type your report manually." },
      { status: 502 },
    );
  }
};
