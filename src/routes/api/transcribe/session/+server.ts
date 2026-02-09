import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";
import { isOpenAIMockMode } from "$lib/server/config.js";

const MEDICAL_PROMPT =
  "EMS trauma report containing common medical abbreviations and acronyms.";

export const POST: RequestHandler = async () => {
  if (isOpenAIMockMode()) {
    return json({ client_secret: null, mock: true });
  }

  try {
    const { getOpenAIClient, TRANSCRIPTION_MODEL } = await import("$lib/server/llm/openai.js");
    const client = getOpenAIClient();

    const session = await client.beta.realtime.transcriptionSessions.create({
      input_audio_format: "pcm16",
      input_audio_transcription: {
        model: TRANSCRIPTION_MODEL,
        language: "en",
        prompt: MEDICAL_PROMPT,
      },
      turn_detection: {
        type: "server_vad",
        silence_duration_ms: 500,
        threshold: 0.5,
      },
    });

    return json({ client_secret: session.client_secret.value });
  } catch (err) {
    console.error("[transcribe/session] OpenAI API error:", err);
    return json(
      { error: "Failed to create transcription session. Please try again." },
      { status: 502 },
    );
  }
};
