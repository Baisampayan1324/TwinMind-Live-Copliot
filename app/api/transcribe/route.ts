import { NextRequest, NextResponse } from 'next/server';

function inferAudioType(file: File): { type: string; extension: string } {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const source = `${name} ${type}`;

  if (source.includes('webm')) return { type: 'audio/webm', extension: 'webm' };
  if (source.includes('ogg')) return { type: 'audio/ogg', extension: 'ogg' };
  if (source.includes('mp4') || source.includes('m4a')) return { type: 'audio/mp4', extension: 'm4a' };
  if (source.includes('mpeg') || source.includes('mp3')) return { type: 'audio/mpeg', extension: 'mp3' };
  if (source.includes('wav')) return { type: 'audio/wav', extension: 'wav' };

  return { type: 'audio/webm', extension: 'webm' };
}

async function normalizeAudioFile(file: File): Promise<File> {
  const { type, extension } = inferAudioType(file);
  const bytes = await file.arrayBuffer();
  return new File([bytes], `audio.${extension}`, { type });
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('X-Groq-Key') ?? req.headers.get('x-groq-key');
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
  const normalizedAudioFile = await normalizeAudioFile(audioFile);
  groqFormData.append('file', normalizedAudioFile, normalizedAudioFile.name);
  groqFormData.append('model', 'whisper-large-v3');
  groqFormData.append('response_format', 'json');
  groqFormData.append('language', 'en');
  
  // Use previous context to reduce hallucinations
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
      const message = (error as { error?: { message?: string } })?.error?.message ?? '';

      console.error(`Groq Transcription Error (${res.status}):`, message);

      const looksLikeSilence = /empty|silence|silent|no speech|too short/i.test(message);
      if (res.status === 400 && looksLikeSilence) {
        return NextResponse.json({ text: '' });
      }

      return NextResponse.json({ error: message || 'Transcription failed' }, { status: res.status });
    }

    const result = await res.json();
    let text = result.text ?? '';

    // Filter common Whisper hallucinations in quiet rooms
    const hallucinations = [/^thank you[.\s]*$/i, /^thanks for watching[.\s]*$/i, /^you$/i];
    if (hallucinations.some(h => h.test(text.trim()))) {
      text = '';
    }

    return NextResponse.json({ text });
  } catch (err: unknown) {
    console.error('Whisper error:', err);
    return NextResponse.json({ error: 'Network error during transcription' }, { status: 502 });
  }
}
