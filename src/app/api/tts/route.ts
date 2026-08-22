import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";

export const runtime = "nodejs";

// Dedicated Azure neural voices per locale — chosen over a single multilingual voice
// specifically because et-EE and lv-LV need voices actually trained on those languages,
// not a general model attempting them.
const VOICE_BY_LOCALE: Record<string, { lang: string; voice: string }> = {
  ru: { lang: "ru-RU", voice: "ru-RU-SvetlanaNeural" },
  en: { lang: "en-US", voice: "en-US-JennyNeural" },
  et: { lang: "et-EE", voice: "et-EE-AnuNeural" },
  lv: { lang: "lv-LV", voice: "lv-LV-EveritaNeural" },
};

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) {
      // Not configured — the client falls back to the browser's own voice in this case.
      return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
    }

    const voiceConfig = VOICE_BY_LOCALE[body.locale] ?? VOICE_BY_LOCALE.ru;
    const ssml =
      `<speak version="1.0" xml:lang="${voiceConfig.lang}">` +
      `<voice xml:lang="${voiceConfig.lang}" name="${voiceConfig.voice}">${escapeSsml(text)}</voice>` +
      `</speak>`;

    const azureRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
        "User-Agent": "PlanogramsApp",
      },
      body: ssml,
    });

    if (!azureRes.ok) {
      const detail = await azureRes.text().catch(() => "");
      return NextResponse.json({ error: `Azure TTS ${azureRes.status}: ${detail}` }, { status: 502 });
    }

    const audio = await azureRes.arrayBuffer();
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e) {
    return handleApiError(e);
  }
}
