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

function hasValidAudioHeader(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  if (view.length < 4) return false;
  // WebM EBML magic
  if (view[0]===0x1a && view[1]===0x45 && view[2]===0xdf && view[3]===0xa3) return true;
  // OggS
  if (view[0]===0x4f && view[1]===0x67 && view[2]===0x67 && view[3]===0x53) return true;
  // MP4 ftyp box at offset 4
  if (buffer.byteLength>=8 && view[4]===0x66 && view[5]===0x74 && view[6]===0x79 && view[7]===0x70) return true;
  // RIFF/WAV
  if (view[0]===0x52 && view[1]===0x49 && view[2]===0x46 && view[3]===0x46) return true;
  return false;
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
  if (audioFile.size < 6000) {
    return NextResponse.json({ text: '' });
  }

  const rawBytes = await audioFile.arrayBuffer();
  if (!hasValidAudioHeader(rawBytes)) {
    console.warn(`[transcribe] Invalid header, skipping (${audioFile.size} bytes)`);
    return NextResponse.json({ text: '' });
  }

  const groqFormData = new FormData();
  const normalizedAudioFile = await normalizeAudioFile(audioFile);
  groqFormData.append('file', normalizedAudioFile, normalizedAudioFile.name);
  groqFormData.append('model', 'whisper-large-v3');
  groqFormData.append('response_format', 'json');
  groqFormData.append('language', 'en');
  
  // Use previous context to reduce hallucinations
  if (prompt && prompt.trim()) {
    groqFormData.append('prompt', prompt.trim().slice(0, 800));
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

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        return NextResponse.json(
          { error: 'Rate limited', retryAfter: retryAfter ? Number(retryAfter) : 10 },
          { status: 429 }
        );
      }

      const looksLikeSilence = /empty|silence|silent|no speech|too short/i.test(message);
      if (res.status === 400 && looksLikeSilence) {
        return NextResponse.json({ text: '' });
      }

      return NextResponse.json({ error: message || 'Transcription failed' }, { status: res.status });
    }

    const result = await res.json();
    let text = result.text ?? '';

    // FIX: Detect if Whisper copied the prompt instead of transcribing
    // This happens when output is suspiciously similar to the input prompt
    if (prompt && text) {
      const normalizeStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedText = normalizeStr(text.trim());
      const normalizedPrompt = normalizeStr(prompt.trim());
      
      // If output is more than 70% contained within the prompt, it's a copy
      if (normalizedPrompt.length > 20 && normalizedText.length > 10) {
        if (normalizedPrompt.includes(normalizedText) || 
            normalizedText === normalizedPrompt) {
          console.warn('[transcribe] Whisper copied prompt, discarding:', text);
          return NextResponse.json({ text: '' });
        }
      }
    }

    // FIX: Detect repeated word/phrase pattern (catches "January January January")
    // Split into words, check if any single word makes up >50% of the output (lowered from 60%)
    if (text && text.trim().split(/\s+/).length >= 3) {
      const words = text.trim().toLowerCase().split(/\s+/);
      const freq: Record<string, number> = {};
      for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
      const maxFreq = Math.max(...Object.values(freq));
      if (maxFreq / words.length > 0.5) {
        console.warn('[transcribe] Repeated word hallucination, discarding:', text);
        return NextResponse.json({ text: '' });
      }
    }

    // FIX: Detect repeated phrase pattern (catches multi-word loops like
    // "quarterly rain review was up 15% compared to last year" x3)
    if (text) {
      const trimmed = text.trim();
      // Try splitting into 2, 3, and 4 equal parts and check if they're identical
      for (const parts of [2, 3, 4]) {
        const chunkSize = Math.floor(trimmed.length / parts);
        if (chunkSize < 10) continue;
        const first = trimmed.slice(0, chunkSize).trim().toLowerCase();
        const allSame = Array.from({ length: parts - 1 }, (_, i) =>
          trimmed.slice((i + 1) * chunkSize, (i + 2) * chunkSize).trim().toLowerCase()
        ).every(c => c.startsWith(first.slice(0, 20)));
        if (allSame) {
          console.warn('[transcribe] Repeated phrase hallucination, discarding:', text);
          return NextResponse.json({ text: '' });
        }
      }
    }

    // Filter common Whisper hallucinations in quiet rooms
    const hallucinations = [
      // Filler word loops (the main culprit)
      /^(\s*(so|okay|ok|and|or|the|a|uh|um|hmm|hm|ah|oh|hey|hi|bye|yes|no|yeah|nah|well|like|you|i|we|they|it|is|are|was|were|be|been|being)\s*[,.\-!?]*\s*){1,6}$/i,
      
      // Punctuation only
      /^[\s.,\-!?…]+$/,

      // Single characters or numbers
      /^.{0,2}$/,

      // Common repeated phrases (catches "I'm sorry, I'm sorry" etc)
      /^(i'?m\s+(sorry|afraid|not\s+sure)[,.\s]*){2,}$/i,
      /^(that's\s+(right|correct|true)[,.\s]*){2,}$/i,
      /^(you['\s]+(know|see)[,.\s]*){2,}$/i,

      // Common Whisper silence hallucinations
      /^thank you[.\s]*$/i,
      /^thanks for watching[.\s]*$/i,
      /^you\.?$/i,
      /^and\.?$/i,
      /^or\.?$/i,
      /^the\.?$/i,
      /^so\.?$/i,
      /^okay\.?$/i,
      /^ok\.?$/i,
      /^uh\.?$/i,
      /^um\.?$/i,
      /^mm-hmm\.?$/i,
      /^hmm+\.?$/i,

      // Repeated word pattern e.g. "So, so, so" / "And. And. And."
      /^(\w+[\s,.\-]*)\1{2,}$/i,

      // Subtitle/caption artifacts
      /^\[.*\]$/,
      /^\(.*\)$/,
      /^subtitles by/i,
      /^transcribed by/i,
    ];

    // Also add a minimum word check — reject single word responses under 3 chars
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1 && words[0].length <= 3) {
      text = '';
    }

    if (hallucinations.some((h) => h.test(text.trim()))) {
      text = '';
    }

    return NextResponse.json({ text });
  } catch (err: unknown) {
    console.error('Whisper error:', err);
    return NextResponse.json({ error: 'Network error during transcription' }, { status: 502 });
  }
}
