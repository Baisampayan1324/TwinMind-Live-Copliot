import { NextRequest, NextResponse } from 'next/server';
import { TranscriptChunk, ChatMessage } from '@/types';

interface RequestBody {
  messages: ChatMessage[];
  transcript: TranscriptChunk[];
  prompt: string;
  contextWindow: number;
  isSuggestionClick?: boolean;
  suggestionHeadline?: string;
  detailedAnswerPrompt?: string;
}

function formatTranscript(chunks: TranscriptChunk[]): string {
  return chunks.map((c) => `[${c.timestamp}] ${c.text}`).join('\n') || 'No transcript yet.';
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { messages, transcript, prompt, contextWindow, isSuggestionClick, suggestionHeadline, detailedAnswerPrompt } = body;

  const recentTranscript = formatTranscript(transcript.slice(-contextWindow));
  const fullTranscript = formatTranscript(transcript);

  // Build system message: detailed answer for suggestion clicks, free chat otherwise
  let systemContent: string;
  if (isSuggestionClick && suggestionHeadline && detailedAnswerPrompt) {
    systemContent = detailedAnswerPrompt
      .replace('{{suggestion}}', suggestionHeadline)
      .replace('{{full_transcript}}', fullTranscript)
      .replace('{{transcript}}', recentTranscript);
  } else {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    systemContent = prompt
      .replace('{{transcript}}', recentTranscript)
      .replace('{{question}}', lastUserMsg?.content ?? '');
  }

  const groqMessages = [
    { role: 'system' as const, content: systemContent },
    ...messages.slice(0, -1).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...(messages.length > 0 && messages[messages.length - 1].role === 'user'
      ? [{ role: 'user' as const, content: messages[messages.length - 1].content }]
      : []),
  ];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.6,
        max_tokens: 600,
        stream: true,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      if (res.status === 401) return NextResponse.json({ error: 'Invalid API key — Groq rejected it' }, { status: 401 });
      if (res.status === 429) return NextResponse.json({ error: 'Rate limited', retryAfter: 10 }, { status: 429 });
      return NextResponse.json({ error: error?.error?.message ?? 'Chat failed' }, { status: res.status });
    }

    // Convert Groq's OpenAI-compatible SSE → raw token SSE so client is simple
    const readable = new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        if (!reader) { controller.close(); return; }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const raw = decoder.decode(value);
            for (const line of raw.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                break;
              }
              try {
                const json = JSON.parse(payload);
                const token = json.choices?.[0]?.delta?.content ?? '';
                if (token) {
                  // Send raw string token — simple to parse on client
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(token)}\n\n`));
                }
              } catch {
                // skip malformed chunk
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: 'Network error during chat' }, { status: 502 });
  }
}
