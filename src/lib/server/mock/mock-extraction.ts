import type { ExtractedFields } from "$lib/types/index.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Regex-based field extraction for mock mode. Simulates Haiku extraction with 500ms delay. */
export async function mockExtract(
  report: string,
): Promise<{ fields: ExtractedFields; isTraumaReport: boolean }> {
  await delay(500);

  const text = report.toLowerCase();

  // Simple relevance check
  const traumaKeywords = [
    "trauma",
    "injury",
    "accident",
    "crash",
    "fall",
    "mvc",
    "mcc",
    "gsw",
    "gcs",
    "sbp",
    "hr",
    "rr",
    "blood pressure",
    "heart rate",
    "intubat",
    "fracture",
    "wound",
    "bleed",
    "burn",
    "penetrating",
    "ejection",
    "ems",
    "ambulance",
    "paramedic",
    "patient",
    "yo",
    "y/o",
    "year old",
  ];
  const isTraumaReport = traumaKeywords.some((kw) => text.includes(kw));

  const extractNumber = (patterns: RegExp[]): number | null => {
    for (const pattern of patterns) {
      const match = report.match(pattern);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  };

  const age = extractNumber([
    /(\d+)\s*(?:yo|y\/o|year[s]?\s*old|yr)/i,
    /age\s*:?\s*(\d+)/i,
    /(\d+)\s*(?:month|mo)\s*old/i,
  ]);

  const sbp = extractNumber([
    /sbp\s*:?\s*(\d+)/i,
    /systolic\s*(?:blood\s*pressure)?\s*:?\s*(\d+)/i,
    /bp\s*:?\s*(\d+)\s*\//i,
    /(\d+)\s*\/\s*\d+\s*(?:mmhg|mm\s*hg)/i,
  ]);

  const hr = extractNumber([
    /hr\s*:?\s*(\d+)/i,
    /heart\s*rate\s*:?\s*(\d+)/i,
    /pulse\s*:?\s*(\d+)/i,
  ]);

  const rr = extractNumber([/rr\s*:?\s*(\d+)/i, /resp(?:iratory)?\s*rate\s*:?\s*(\d+)/i]);

  const gcs = extractNumber([
    /gcs\s*:?\s*(\d+)/i,
    /glasgow\s*(?:coma\s*(?:scale|score))?\s*:?\s*(\d+)/i,
  ]);

  // Extract mechanism keywords
  const mechanisms = [
    "mvc",
    "mcc",
    "fall",
    "crash",
    "gsw",
    "stabbing",
    "pedestrian",
    "ejection",
    "bicycle",
  ];
  const foundMechanism = mechanisms.find((m) => text.includes(m));

  return {
    fields: {
      age,
      sbp,
      hr,
      rr,
      gcs,
      airwayStatus: text.includes("intubat") ? "Intubated" : null,
      breathingStatus: null,
      mechanism: foundMechanism ?? null,
      injuries: null,
      additionalContext: null,
    },
    isTraumaReport,
  };
}
