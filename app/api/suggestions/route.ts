import { NextRequest, NextResponse } from 'next/server';
import { TranscriptChunk, Suggestion } from '@/types';

interface RequestBody {
  transcript: TranscriptChunk[];
  contextWindow: number;
  prompt: string;
}

const ALLOWED_TYPES = new Set<Suggestion['type']>([
  'Question to ask',
  'Talking point',
  'Answer',
  'Fact-check',
  'Clarification',
]);

function formatTranscript(chunks: TranscriptChunk[]): string {
  return chunks.map((c) => `[${c.timestamp}] ${c.text}`).join('\n');
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function normalizeType(typeValue: unknown): Suggestion['type'] {
  const type = String(typeValue ?? '').trim();
  if (ALLOWED_TYPES.has(type as Suggestion['type'])) {
    return type as Suggestion['type'];
  }

  const lower = type.toLowerCase();
  if (lower.includes('question')) return 'Question to ask';
  if (lower.includes('talk')) return 'Talking point';
  if (lower.includes('answer')) return 'Answer';
  if (lower.includes('fact')) return 'Fact-check';
  if (lower.includes('clarif')) return 'Clarification';
  return 'Talking point';
}

function extractSuggestions(parsed: unknown): Suggestion[] {
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null
    ? (
        (parsed as { suggestions?: unknown[] }).suggestions ??
        (parsed as { items?: unknown[] }).items ??
        (parsed as { data?: unknown[] }).data ??
        []
      )
    : [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null;

      const obj = item as {
        type?: unknown;
        headline?: unknown;
        title?: unknown;
        preview?: unknown;
        description?: unknown;
      };

      const headline = String(obj.headline ?? obj.title ?? '').trim();
      const preview = String(obj.preview ?? obj.description ?? '').trim();
      if (!headline || !preview) return null;

      const normalized: Suggestion = {
        type: normalizeType(obj.type),
        headline,
        preview,
      };

      return normalized;
    })
    .filter((s): s is Suggestion => s !== null)
    .slice(0, 3);
}

async function callGroq(apiKey: string, prompt: string): Promise<Suggestion[] | null> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = Object.assign(err, { status: res.status });
    throw error;
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  const cleaned = stripMarkdownFences(raw);

  try {
    const parsed = JSON.parse(cleaned);
    const suggestions = extractSuggestions(parsed);
    return suggestions.length > 0 ? suggestions : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('X-Groq-Key') ?? req.headers.get('x-groq-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Groq API key' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { transcript, contextWindow, prompt } = body;

  if (!Array.isArray(transcript) || transcript.length === 0) {
    return NextResponse.json({ error: 'No transcript to generate suggestions from' }, { status: 400 });
  }

  const recentChunks = transcript.slice(-contextWindow);
  const transcriptText = formatTranscript(recentChunks);
  const filledPrompt = prompt
    .replace('{{context_window}}', String(contextWindow))
    .replace('{{transcript}}', transcriptText);

  try {
    // First attempt
    let suggestions = await callGroq(apiKey, filledPrompt);

    // Retry once with stricter JSON instruction if first attempt failed
    if (!suggestions) {
      const retryPrompt = filledPrompt + '\n\nIMPORTANT: Return ONLY a valid JSON array with exactly 3 objects. No markdown, no preamble.';
      suggestions = await callGroq(apiKey, retryPrompt);
    }

    if (!suggestions) {
      return NextResponse.json({ error: 'Failed to parse suggestions after retry' }, { status: 500 });
    }

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    if (error?.status === 401) return NextResponse.json({ error: 'Invalid API key — Groq rejected it' }, { status: 401 });
    if (error?.status === 429) return NextResponse.json({ error: 'Rate limited', retryAfter: 10 }, { status: 429 });
    console.error('Suggestions error:', error);
    return NextResponse.json({ error: error?.message ?? 'Suggestion generation failed' }, { status: 502 });
  }
}
