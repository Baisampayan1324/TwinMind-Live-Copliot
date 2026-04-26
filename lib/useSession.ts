import { useState, useCallback, useRef, useEffect } from 'react';
import { TranscriptChunk, SuggestionBatch, Suggestion, ChatMessage, Settings, SessionExport } from '@/types';
import { DEFAULT_SUGGESTION_PROMPT, DEFAULT_DETAIL_PROMPT, DEFAULT_CHAT_PROMPT } from './prompts';
import * as audioCapture from '@/lib/audioCapture';

const SESSION_STORAGE_KEY = 'twinmind_settings';

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
  detailPrompt: DEFAULT_DETAIL_PROMPT,
  chatPrompt: DEFAULT_CHAT_PROMPT,
  suggestionContextWindow: 5,
  chatContextWindow: 10,
  refreshInterval: 5,
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowISO(): string {
  return new Date().toISOString();
}

function mimeTypeToExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  if (lower.includes('wav')) return 'wav';
  return 'webm';
}

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    return {
      ...merged,
      refreshInterval: Math.max(5, Number(merged.refreshInterval) || DEFAULT_SETTINGS.refreshInterval),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export interface SessionError {
  column: 'transcript' | 'suggestions' | 'chat' | 'global';
  message: string;
  retryAfter?: number;
}

export function useSession() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isRecording, setIsRecording] = useState(false);
  const [isMicPending, setIsMicPending] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const recentSuggestionKeysRef = useRef<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm TwinMind. Start recording and I'll surface live suggestions as your meeting progresses. Click any suggestion card for a detailed answer, or ask me anything directly.",
      timestamp: nowISO(),
    },
  ]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [activeStreams, setActiveStreams] = useState<number>(0);
  const isStreamingChat = activeStreams > 0;
  const [error, setError] = useState<SessionError | null>(null);
  const lastSuggestionBatchKeyRef = useRef<string>('');

  // Refs to always have latest values inside callbacks
  const transcriptRef = useRef<TranscriptChunk[]>([]);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  transcriptRef.current = transcript;
  chatMessagesRef.current = chatMessages;
  settingsRef.current = settings;

  // Load settings from sessionStorage on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
  }, []);

  const saveSettings = useCallback((next: Settings) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<Settings>) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          ...partial,
          refreshInterval: Math.max(2, Number(partial.refreshInterval ?? prev.refreshInterval) || 5),
        };
        saveSettings(next);
        return next;
      });
    },
    [saveSettings]
  );

  const clearError = useCallback(() => setError(null), []);

  // ─── Transcription ─────────────────────────────────────────────────────────
  const transcribeBlob = useCallback(
    async (blob: Blob, contextPrompt?: string): Promise<string | null> => {
    const s = settingsRef.current;
    if (!s.apiKey) return null;

    setIsTranscribing(true);
    const fd = new FormData();
    const ext = mimeTypeToExtension(blob.type || 'audio/webm');
    fd.append('audio', blob, `audio.${ext}`);
    if (contextPrompt) {
      fd.append('prompt', contextPrompt);
    }

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'X-Groq-Key': s.apiKey },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError({ column: 'transcript', message: `Rate limited. Retrying in ${data.retryAfter ?? 10}s.`, retryAfter: data.retryAfter });
        } else if (res.status === 401) {
          setError({ column: 'global', message: 'Invalid API key. Please check your Groq key in Settings.' });
        } else {
          setError({ column: 'transcript', message: data.error ?? 'Transcription failed' });
        }
        return null;
      }
      return data.text ?? '';
    } catch {
      setError({ column: 'transcript', message: 'Network error during transcription.' });
      return null;
    } finally {
      setIsTranscribing(false);
    }
    },
    []
  );

  const appendTranscript = useCallback((text: string): TranscriptChunk | null => {
    if (!text.trim()) return null;
    const chunk: TranscriptChunk = {
      id: genId(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      text: text.trim(),
    };
    setTranscript((prev) => {
      const next = [...prev, chunk];
      transcriptRef.current = next;
      return next;
    });
    return chunk;
  }, []);

  // ─── Suggestions ───────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async () => {
    const s = settingsRef.current;
    const t = transcriptRef.current;
    if (!s.apiKey || t.length === 0) return;

    setIsLoadingSuggestions(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Groq-Key': s.apiKey,
        },
        body: JSON.stringify({
          transcript: t,
          contextWindow: s.suggestionContextWindow,
          prompt: s.suggestionPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError({ column: 'suggestions', message: `Rate limited. Retrying in ${data.retryAfter ?? 10}s.`, retryAfter: data.retryAfter });
        } else if (res.status === 401) {
          setError({ column: 'global', message: 'Invalid API key. Please check your Groq key in Settings.' });
        } else {
          setError({ column: 'suggestions', message: data.error ?? 'Failed to get suggestions' });
        }
        return;
      }
      const batch: SuggestionBatch = {
        batchId: genId(),
        generatedAt: nowISO(),
        suggestions: data.suggestions,
      };
      const batchKey = batch.suggestions.map((s) => `${s.type}::${s.headline}`).join('||');
      if (!batchKey || batchKey === lastSuggestionBatchKeyRef.current) {
        return;
      }

      lastSuggestionBatchKeyRef.current = batchKey;
      recentSuggestionKeysRef.current = [...batch.suggestions.map((s) => `${s.type}::${s.headline}`), ...recentSuggestionKeysRef.current].slice(0, 30);
      setSuggestionBatches((prev) => [batch, ...prev]);
    } catch {
      setError({ column: 'suggestions', message: 'Network error fetching suggestions.' });
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // ─── Recording ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.apiKey) {
      setError({ column: 'global', message: 'Please set your Groq API key in Settings first.' });
      return;
    }

    setIsMicPending(true);
    try {
      const intervalMs = Math.max(2, Number(s.refreshInterval) || 5) * 1000;
      await audioCapture.startCapture(
        async (blob: Blob) => {
          // Skip near-silence blobs early
          if (blob.size < 6000) return;
          
          // Use only the LAST chunk as prompt (not 3), and truncate to 100 chars.
          // Feeding too much context causes Whisper to copy the prompt as output.
          const lastChunk = transcriptRef.current.slice(-1)[0]?.text ?? '';
          const contextHint = lastChunk.slice(-100); // last 100 chars only
          const text = await transcribeBlob(blob, contextHint || undefined);
          if (text) {
            const newChunk = appendTranscript(text);
            if (newChunk) {
              await fetchSuggestions();
            }
          }
        },
        intervalMs
      );
      setIsRecording(true);
      setError(null);
    } catch (err: unknown) {
      const e = err as Error;
      setError({ column: 'global', message: e.message });
    } finally {
      setIsMicPending(false);
    }
  }, [transcribeBlob, appendTranscript, fetchSuggestions]);

  const stopRecording = useCallback(async () => {
    audioCapture.stopCapture();
    setIsRecording(false);
  }, []);

  // Manual refresh: flush current audio buffer → transcribe → suggest
  const manualRefresh = useCallback(async () => {
    audioCapture.flushBuffer();
    await fetchSuggestions();
  }, [fetchSuggestions]);

  // ─── Chat ──────────────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(
    async (text: string, opts?: { isSuggestionClick?: boolean; suggestionHeadline?: string }) => {
      const s = settingsRef.current;
      const t = transcriptRef.current;
      if (!s.apiKey || !text.trim()) return;

      const streamId = genId();
      const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: nowISO() };
      const assistantMsg: ChatMessage = { 
        role: 'assistant', 
        content: '', 
        timestamp: nowISO(),
        id: streamId 
      };

      setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
      setActiveStreams(n => n + 1);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Groq-Key': s.apiKey,
          },
          body: JSON.stringify({
            messages: [...chatMessagesRef.current, userMsg],
            transcript: t,
            prompt: s.chatPrompt,
            contextWindow: s.chatContextWindow,
            isSuggestionClick: opts?.isSuggestionClick ?? false,
            suggestionHeadline: opts?.suggestionHeadline,
            detailPrompt: s.detailPrompt,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError({ column: 'chat', message: data.error ?? 'Chat failed' });
          setChatMessages((prev) => prev.filter(m => m.id !== streamId));
          return;
        }

        // Stream SSE tokens
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        let accumulated = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const raw = decoder.decode(value);
          const lines = raw.split('\n').filter((l) => l.startsWith('data: '));
          for (const line of lines) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') break;
            try {
              // Handle both raw-string tokens and OpenAI-format SSE
              let token = '';
              try {
                token = JSON.parse(payload) as string;
              } catch {
                const json = JSON.parse(payload);
                token = json.choices?.[0]?.delta?.content ?? '';
              }
              accumulated += token;
              setChatMessages((prev) => {
                const idx = prev.findIndex(m => m.id === streamId);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], content: accumulated };
                return next;
              });
            } catch {
              // malformed SSE chunk, skip
            }
          }
        }
      } catch {
        setError({ column: 'chat', message: 'Network error during chat.' });
      } finally {
        setActiveStreams(n => Math.max(0, n - 1));
      }
    },
    []
  );

  const clickSuggestion = useCallback(
    (suggestion: Suggestion) => {
      sendChatMessage(suggestion.headline, {
        isSuggestionClick: true,
        suggestionHeadline: suggestion.headline,
      });
    },
    [sendChatMessage]
  );

  // ─── Export ────────────────────────────────────────────────────────────────
  const exportSession = useCallback(() => {
    const data = {
      exportedAt: nowISO(),
      transcript,
      suggestionBatches,
      chat: chatMessages,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, suggestionBatches, chatMessages]);

  return {
    settings,
    isRecording,
    transcript,
    interimTranscript,
    suggestionBatches,
    chatMessages,
    isTranscribing,
    isLoadingSuggestions,
    isStreamingChat,
    isMicPending,
    error,
    clearError,
    startRecording,
    stopRecording,
    manualRefresh,
    sendChatMessage,
    clickSuggestion,
    updateSettings,
    exportSession,
  };
}

