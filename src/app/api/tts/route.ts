import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiError";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Azure's free tier is ~500k characters/month — once a calendar month's usage would
// cross this, stop calling Azure entirely and let the client's existing fallback take
// over (same 503 path as "not configured"), rather than silently start incurring
// charges. Configurable since the exact free-tier size depends on the Azure
// subscription itself, not something this code can read at runtime.
const MONTHLY_CHAR_LIMIT = Number(process.env.AZURE_TTS_MONTHLY_CHAR_LIMIT) || 500_000;

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

// Azure's ru-RU neural voice reads "полка"/"полку" with stress on the wrong syllable —
// it comes out sounding like "палка" (a stick). A combining-acute-accent stress mark
// (the usual trick for this) turned out NOT to be honored by this voice in practice, so
// instead these words are pinned to their exact pronunciation via SSML's <phoneme>
// element, which Azure documents as authoritative regardless of the voice's own text
// normalization/stress guessing.
const RU_PHONEME_WORDS: [RegExp, string][] = [
  [/полка/gi, "ˈpolkə"],
  [/полку/gi, "ˈpolku"],
];

// Builds the inner text of a <voice> element: plain text is XML-escaped as usual, but
// known trouble words (ru-RU only) are swapped for a <phoneme> tag instead — those tags
// must NOT be escaped, so this walks the matches instead of running one blind replace.
function toVoiceMarkup(text: string, lang: string): string {
  if (lang !== "ru-RU") return escapeSsml(text);
  const matches: { start: number; end: number; word: string; ph: string }[] = [];
  for (const [pattern, ph] of RU_PHONEME_WORDS) {
    for (const m of text.matchAll(pattern)) {
      matches.push({ start: m.index!, end: m.index! + m[0].length, word: m[0], ph });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  let result = "";
  let lastIndex = 0;
  for (const m of matches) {
    if (m.start < lastIndex) continue; // overlapping match from another pattern — skip
    result += escapeSsml(text.slice(lastIndex, m.start));
    result += `<phoneme alphabet="ipa" ph="${m.ph}">${escapeSsml(m.word)}</phoneme>`;
    lastIndex = m.end;
  }
  result += escapeSsml(text.slice(lastIndex));
  return result;
}

interface Segment {
  text: string;
  lang?: string;
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const body = await req.json();
    const defaultLocale = typeof body.locale === "string" ? body.locale : "ru";

    // Either a flat `text` (single voice, the whole thing in the UI locale) or
    // `segments` — a list of {text, lang} pairs stitched into one SSML document with
    // one <voice> per segment, so e.g. a product name can always be read in Estonian
    // (it's an Estonian name, regardless of what language the rest of the UI is in)
    // while the surrounding instruction stays in whatever language the user picked.
    let segments: Segment[];
    if (Array.isArray(body.segments)) {
      segments = body.segments.filter(
        (s: unknown): s is Segment => !!s && typeof (s as Segment).text === "string" && (s as Segment).text.trim().length > 0
      );
    } else if (typeof body.text === "string" && body.text.trim()) {
      segments = [{ text: body.text }];
    } else {
      segments = [];
    }
    if (segments.length === 0) {
      return NextResponse.json({ error: "text or segments required" }, { status: 400 });
    }

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) {
      // Not configured — the client falls back to the browser's own voice in this case.
      return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
    }

    const charCount = segments.reduce((sum, s) => sum + s.text.length, 0);
    const yearMonth = new Date().toISOString().slice(0, 7); // "2026-08"
    const usage = await prisma.ttsUsage.findUnique({ where: { yearMonth } });
    if ((usage?.charactersUsed ?? 0) + charCount > MONTHLY_CHAR_LIMIT) {
      // Same fallback path as "not configured" — the client already knows how to
      // handle this by switching to the browser voice for the rest of this request.
      return NextResponse.json({ error: "Monthly TTS budget used up" }, { status: 503 });
    }

    const rootLang = (VOICE_BY_LOCALE[defaultLocale] ?? VOICE_BY_LOCALE.ru).lang;
    const voices = segments
      .map((seg) => {
        const v = VOICE_BY_LOCALE[seg.lang ?? defaultLocale] ?? VOICE_BY_LOCALE.ru;
        return `<voice xml:lang="${v.lang}" name="${v.voice}">${toVoiceMarkup(seg.text, v.lang)}</voice>`;
      })
      .join("");
    const ssml = `<speak version="1.0" xml:lang="${rootLang}">${voices}</speak>`;

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

    // Record spend only after Azure actually accepted the request — a failed call
    // above never reaches here, so it never counts against the budget.
    await prisma.ttsUsage.upsert({
      where: { yearMonth },
      create: { yearMonth, charactersUsed: charCount },
      update: { charactersUsed: { increment: charCount } },
    });

    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e) {
    return handleApiError(e);
  }
}
