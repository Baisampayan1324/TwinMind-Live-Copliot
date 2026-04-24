import { NextRequest, NextResponse } from 'next/server';
import { TranscriptChunk, Suggestion } from '@/types';

interface RequestBody {
  transcript: TranscriptChunk[];
  contextWindow: number;
  prompt: string;
}

function formatTranscript(chunks: TranscriptChunk[]): string {
  return chunks.map((c) => `[${c.timestamp}] ${c.text}`).join('\n');
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
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
    if (Array.isArray(parsed) && parsed.length === 3) return parsed as Suggestion[];
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('X-Groq-Key');
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
