import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('X-Groq-Key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Groq API key' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const audioFile = formData.get('audio') as File | null;
  const prompt = formData.get('prompt') as string | null;
  if (!audioFile) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  // Reject tiny blobs — likely silence or a failed capture
  if (audioFile.size < 1000) {
    return NextResponse.json({ text: '' });
  }

  const groqFormData = new FormData();
  groqFormData.append('file', audioFile, 'audio.webm');
  groqFormData.append('model', 'whisper-large-v3');
  groqFormData.append('response_format', 'json');
  groqFormData.append('language', 'en');
  if (prompt) {
    groqFormData.append('prompt', prompt);
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqFormData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      // Whisper rejects empty/silent blobs with 400 — treat as empty text
      if (res.status === 400) return NextResponse.json({ text: '' });
      if (res.status === 401) return NextResponse.json({ error: 'Invalid API key — Groq rejected it' }, { status: 401 });
      if (res.status === 429) return NextResponse.json({ error: 'Rate limited', retryAfter: 10 }, { status: 429 });
      return NextResponse.json({ error: error?.error?.message ?? 'Transcription failed' }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json({ text: result.text ?? '' });
  } catch (err: unknown) {
    console.error('Whisper error:', err);
    return NextResponse.json({ error: 'Network error during transcription' }, { status: 502 });
  }
}
