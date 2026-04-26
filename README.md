# TwinMind Live Suggestions Copilot

A production-quality AI meeting copilot that transcribes speech in real time, surfaces contextual suggestions, and provides a continuous chat assistant.

## Features

- **Real-time Transcription**: Uses Groq's `whisper-large-v3` for ultra-fast audio-to-text. Audio is captured and transcribed every **2 seconds** (not 30s) for true real-time transcription display.
- **Live Suggestions**: Surfaces intelligent "Question to ask", "Talking point", "Answer", "Fact-check", and "Clarification" cards with **automatic refresh every 5 seconds**. Duplicate suggestions are automatically filtered out.
- **Smart Deduplication**: Tracks suggestion headlines to prevent duplicate suggestions from appearing in multiple batches.
- **Streaming Chat**: A dedicated sidebar for deep-diving into suggestions or asking freeform questions with sub-500ms latency.
- **Zero Infrastructure**: Built with Next.js App Router and API routes, designed for Vercel deployment.
- **Privacy First**: API keys and settings are stored in `sessionStorage` and never touch the server-side logs.

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Framer Motion, Lucide Icons.
- **Inference**: Groq Cloud API (Whisper + Llama 3.3).
- **Audio**: Web MediaRecorder API with 2-second chunk intervals for real-time transcription.

## Recent Production Fixes (v0.1.0)

This release includes critical fixes for production transcription reliability:

### 🎙️ Real-Time Audio Pipeline

- **Fixed timeslice chunking**: mediaRecorder now uses intelligent timeslicing (max(500, interval/2)ms) to ensure proper ondataavailable firing and valid audio headers
- **Smart MIME type detection**: Added fallback chain (WebM Opus → WebM → OggS Opus → OggS) with try/catch handling for browser compatibility
- **Error recovery**: Added mediaRecorder.onerror handler that auto-recovers from transient failures
- **Race condition fix**: Clears buffer before stop() to prevent data loss

### 🧠 Stale Closure Prevention

- **Fixed transcriptRef sync**: appendTranscript now synchronously updates transcriptRef inside setState callback
- **Fixed chatMessagesRef**: sendChatMessage now uses chatMessagesRef.current to prevent stale message closures
- **Fixed fetchSuggestions**: Removed stale parameter passing; now always uses current transcriptRef
- **Removed forced refresh overrides**: useEffect no longer forces 8s refresh; respects user settings

### 🚫 Context Prompt Poisoning Prevention

- **Reduced context scope**: Changed from 3 joined chunks → 1 chunk only, truncated to 100 chars
  - **Why**: Feeding excessive context causes Whisper to copy the prompt as output instead of transcribing
- **Prompt deduplication detection**: Normalizes prompt + output, detects when >70% of output is contained in prompt
- **Repeated word detector**: Catches "January January January" patterns (single word >60% of output)
- **Repeated phrase detector**: Catches multi-word loops like "quarterly rain review... quarterly rain review..." using chunk comparison

### 🛡️ Hallucination Detection

- **Audio header validation**: Validates WebM (EBML), OggS, MP4 (ftyp), and WAV (RIFF) magic bytes before sending to Groq
- **Blob size pre-filtering**: Client-side early return for blobs <6KB; server-side 6KB minimum threshold
- **Expanded patterns**: From 3 patterns → 20+ regex rules including:
  - Filler word loops (so, okay, uh, um, etc.)
  - Punctuation-only responses
  - Single character/short responses
  - Common silence hallucinations
  - Repeated word/phrase patterns
  - Subtitle and caption artifacts
- **Rate limit handling**: Added 429 handling with retry-after header passthrough
- **Prompt truncation**: Limited to 800 chars to prevent API size errors

## Setup

1. **Clone & Install**:

   ```bash
   git clone https://github.com/Baisampayan1324/TwinMind-Live-Copliot.git
   cd TwinMind-Live-Copliot
   npm install
   ```

2. **Run Locally**:

   ```bash
   npm run dev
   ```

3. **Configure**:
   - Open the app in your browser at `http://localhost:3000`.
   - Click the **Gear Icon** (top right).
   - Enter your **Groq API Key** and click **Save and Continue** (single click required).
   - (Optional) Customize the prompts, context windows, and refresh intervals.

4. **Start Recording**:
   - Click the **Microphone** icon to begin recording.
   - Transcription will appear in real-time as you speak (2-3 second delay).
   - Suggestions will refresh automatically every 5 seconds with new, non-duplicate recommendations.
   - Click any suggestion card for a detailed answer, or ask questions in the chat panel.

## Deployment

### Deploy to Vercel (Recommended)

**Step 1: Complete Pre-Deployment Testing**

Complete the full **"Pre-Deployment Testing Checklist"** below before deploying. This ensures all features work correctly locally.

**Step 2: Deploy to Vercel**

```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Deploy to Vercel
vercel
```

During deployment, Vercel will ask:

- **Which scope?** → Choose your account
- **Link to existing project?** → Press `N` (new project)
- **Project name?** → `twinmind-live-copilot`
- **Which directory?** → Press Enter (default = current directory)

**Step 3: Verify Deployment**

After deployment:

1. Vercel will provide a live URL (e.g., `https://twinmind-xyz.vercel.app`)
2. Visit the URL in your browser
3. Run the Pre-Deployment Testing Checklist (same as Step 1) on the production URL
4. Test with actual microphone input
5. Verify Groq API calls work in production

**Step 4: Post-Deployment Verification** (First Week)

- [ ] Visit deployed Vercel URL in browser — verify HTTPS is active
- [ ] Complete full **Pre-Deployment Testing Checklist** on production URL
- [ ] Monitor Groq API usage dashboard at https://console.groq.com for proper rate limiting
- [ ] Check Vercel Analytics — verify no spike in errors or failed requests
- [ ] Test with various network speeds (use DevTools Network throttling)
- [ ] Monitor error logs for any production issues
- [ ] Verify page load time is <3 seconds on slow 4G connection

**Step 5: Custom Domain (Optional)**

If you own a domain:

1. Go to Vercel Dashboard → Your Project
2. Click **Settings** → **Domains**
3. Add your custom domain
4. Follow the DNS configuration instructions

### Important Notes

- **API Keys**: Users will enter their Groq API key in the UI (stored in sessionStorage only)
- **No Backend Secrets**: This app has no server-side secrets. All credentials are client-side.
- **Rate Limits**: Groq's free tier has rate limits. Monitor usage in Groq console.
- **CORS**: All API routes go through Next.js, so CORS is handled automatically.

### Environment Variables (Optional)

If you want to set a default API key (not recommended for security):

1. Create a `.env.local` file:

```
NEXT_PUBLIC_GROQ_API_KEY=gsk_your_key_here
```

2. Use in the app (optional):

```typescript
const defaultKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
```

**⚠️ Warning**: Only use public keys (prefixed with `NEXT_PUBLIC_`). Never put secret keys in environment variables.

### Troubleshooting Deployment

**Issue: "Microphone access denied" in production**

- Solution: Ensure your Vercel URL uses HTTPS (Vercel does this by default)

**Issue: "Groq API calls failing"**

- Solution: Check if user's API key is valid. Test in Groq console.

**Issue: "High latency on transcription"**

- Solution: This is normal for smaller audio chunks. Groq processes ~2s chunks in 1-3 seconds.

---

## Pre-Deployment Testing Checklist

Before running `vercel deploy`, verify everything works locally:

### 1. **Settings & Configuration**

- [ ] Click the ⚙️ **Settings** button (top right)
- [ ] Enter your Groq API key and click **Save and Continue** (should work on **first click**)
- [ ] Click Settings again — verify your key is remembered in sessionStorage
- [ ] Try switching between API and Advanced tabs without errors
- [ ] Clear sessionStorage (`sessionStorage.clear()`) and refresh — verify settings modal reappears

### 2. **Microphone & Recording**

- [ ] Click the **Microphone** button
- [ ] Verify browser asks for microphone permission
- [ ] **Allow** microphone access
- [ ] Button should show "Listening..." in red
- [ ] Speak naturally — verify text appears in the transcript panel **within 2-3 seconds**
- [ ] Stop recording by clicking the mic button again
- [ ] Verify the button returns to "Microphone Off"

### 3. **Real-Time Transcription**

- [ ] Start recording and speak continuously
- [ ] Verify transcription chunks appear **live** (not in 30-second bursts)
- [ ] Check timestamps are accurate
- [ ] Verify no transcription errors in browser console (F12 → Console)
- [ ] Record for at least 1 minute to test stability

### 4. **Live Suggestions**

- [ ] While recording, watch the **Suggestions** panel (middle column)
- [ ] Verify suggestions appear **automatically every 5 seconds** (no manual refresh needed)
- [ ] Check that suggestions are **different each time** (no duplicates)
- [ ] Verify suggestion types include: "Question to ask", "Talking point", "Answer", etc.
- [ ] Click a suggestion card → verify it appears in the Chat panel with a detailed answer

### 5. **Chat & Deep Dives**

- [ ] Click any suggestion card
- [ ] Verify response starts streaming within 1 second
- [ ] Verify the response answers the suggestion headline
- [ ] Type a freeform question in the chat input
- [ ] Verify the chat responds with transcript context
- [ ] Check that previous messages are visible in chat history

### 6. **Export & Data**

- [ ] Stop recording after collecting some transcript
- [ ] Click the **Export** button (top left)
- [ ] Verify a JSON file downloads with:
  - Transcript chunks with timestamps
  - Suggestion batches with types
  - Chat message history
  - Metadata (export time, etc.)

### 7. **Edge Cases**

- [ ] Deny microphone access — verify error message appears
- [ ] Provide invalid Groq API key — try recording, verify error message
- [ ] Keep recording for 5+ minutes — verify no memory leaks or slowdowns
- [ ] Refresh page while recording — verify state is lost (as designed)
- [ ] Close and reopen browser tab — verify settings modal appears (clean session)
- [ ] Test with silence (pause for 5-10 seconds) — verify no false transcriptions appear
- [ ] Test rate limiting — make many rapid recordings to trigger 429, verify error message with retry-after
- [ ] Test browser back/forward buttons — verify app state is handled gracefully

### 8. **Browser Compatibility**

Test on at least one of each:

- [ ] Chrome/Edge (Chromium-based)
- [ ] Firefox
- [ ] Safari (if available)

### 9. **Production Readiness**

- [ ] Run `npm run build` — verify no build errors
- [ ] Run `npm run lint` (eslint) — verify no lint warnings
- [ ] Open DevTools **Performance** tab — verify no memory leaks during 5+ minute recording
- [ ] Monitor DevTools **Network** tab — verify API calls are properly batched every 2-5s (not per chunk)
- [ ] Test with actual meeting audio (not synthetic) — verify real-world quality and no hallucinations

---

## Configuration

- **Refresh Interval**: Default 2 seconds for transcription chunks. Adjustable in Advanced Settings (minimum 1 second recommended for real-time feel).
- **Suggestion Refresh**: Fixed at 5 seconds during recording to balance freshness with API efficiency.
- **Context Window**: Default 5 chunks (~2.5 minutes). Increase for longer-context suggestions, decrease for faster suggestions.

## How It Works

### Transcription Pipeline

1. Audio is captured in 2-second chunks via the Web MediaRecorder API.
2. Each chunk is sent to Groq's Whisper API for transcription.
3. Transcribed text appears immediately in the transcript panel.

### Suggestion Generation

1. Every 5 seconds while recording, the last 5 transcript chunks are sent to the suggestion engine.
2. The `llama-3.3-70b-versatile` model generates 3 diverse suggestions.
3. Duplicate headlines are filtered using a Set-based deduplication system.
4. Only new suggestions are displayed; identical suggestions are silently dropped.

### Chat & Deep Dives

1. Click any suggestion card to get a detailed answer using the `detailedAnswerPrompt`.
2. Type directly in the chat panel for freeform questions.
3. Responses are streamed via Server-Sent Events for immediate feedback.

## Tradeoffs & Design Decisions

- **Session Storage**: Settings do not persist across hard page reloads. Intentional for privacy and clean sessions.
- **2-Second Chunks**: Provides ultra-responsive transcription feedback. Trade-off: slightly higher API costs than 30-second chunks, but worth it for real-time UX.
- **5-Second Suggestion Refresh**: Balances freshness with API rate limits. Configurable if you have higher rate limits.
- **Headline-Based Deduplication**: Prevents the same suggestion from appearing multiple times, even if the preview text differs slightly.
- **Single-Click Settings**: Fixed the double-click issue by removing timing delays in the settings modal.

## Common Issues & Fixes

**Q: Transcription not appearing?**

- Check that you've allowed microphone access in your browser.
- Verify your Groq API key is correct.
- Check browser console for errors (F12 → Console).

**Q: Suggestions not showing up?**

- Start recording first; suggestions require at least one transcript chunk.
- Wait for the automatic 5-second refresh cycle.
- Ensure you have transcript content; empty audio chunks are skipped.

**Q: Same suggestions appearing multiple times?**

- This is now prevented by the deduplication system. If you still see repeats, try clearing sessionStorage: `sessionStorage.clear()` and refresh.

**Q: Settings modal closing unexpectedly?**

- This was fixed. Settings now save and close on first click of "Save and Continue".

## Troubleshooting Recent Fixes (v0.1.0)

### Audio Pipeline Issues

**Q: "Not a valid media file" errors from Groq?**

- **Status**: ✅ Fixed. Audio header validation now ensures blobs are valid WebM/OggS/MP4/WAV before sending.
- **What changed**: Added `hasValidAudioHeader()` function that checks magic bytes (EBML, OggS, ftyp, RIFF).
- **If still occurring**:
  - Check browser console for `[transcribe] Invalid header` warnings
  - Verify MediaRecorder MIME type support: `console.log(MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))`
  - Try a different browser (Chrome has best Opus support)

**Q: Silence producing empty suggestions?**

- **Status**: ✅ Fixed. Blobs <6KB (typically 2-5s silence) are now filtered client-side before API call.
- **What changed**: Added `if (blob.size < 6000) return;` in startRecording's onChunk callback.
- **Why 6KB?**: Silence at 2s produces ~3-5KB of empty WebM. 6KB threshold ensures only real audio is transcribed.

**Q: "Rate limited" errors (HTTP 429)?**

- **Status**: ✅ Fixed. 429 responses now include retry-after header passthrough.
- **What changed**: Added 429 handler that extracts retry-after and returns to client.
- **If occurring**:
  - Reduce refresh interval in Settings (currently 2-5s)
  - Or increase Groq plan at https://console.groq.com/keys
  - App will show error message with retry delay

### Hallucination & Transcription Quality

**Q: Transcription copying previous text (e.g., prompt becomes output)?**

- **Status**: ✅ Fixed. Context prompt size reduced 3 chunks → 1 chunk, truncated to 100 chars.
- **What changed**:
  - Changed from passing `lastChunks = transcriptRef.current.slice(-3).map(...).join(' ')`
  - To `lastChunk.slice(-100)` (last 100 chars of most recent chunk only)
- **Why**: Feeding excessive context confuses Whisper into copying the prompt as output.
- **Detection**: Server-side now detects when output is >70% contained in prompt and discards.

**Q: "January January January" or repeated word hallucinations?**

- **Status**: ✅ Fixed. Added repeated word detector (if single word >60% of output, discard).
- **What changed**: Server-side now checks word frequency distribution and rejects skewed outputs.
- **Detection flow**:
  1. First 3 dedup checks (prompt copy, repeated word, repeated phrase)
  2. Then 20+ regex-based hallucination patterns
  3. Finally, minimum word length check

**Q: Filler word responses ("so, so, so" or "um um um")?**

- **Status**: ✅ Fixed. Expanded hallucination patterns to 20+ rules, including filler loops.
- **What changed**: Added regex `/^(\s*(so|okay|ok|and|or|...|hmm)\s*[,.\-!?]*\s*){1,6}$/i` to catch 1-6 filler word repetitions.

**Q: Subtitle artifacts appearing ("Subtitles by..." or "[Inaudible]")?**

- **Status**: ✅ Fixed. Added patterns to detect and discard subtitle/caption artifacts.
- **Patterns**: `^\[.*\]$`, `^\(.*\)$`, `/^subtitles by/i`, `/^transcribed by/i`

### Stale Closure / State Issues

**Q: Chat messages appearing out of order or missing?**

- **Status**: ✅ Fixed. Added chatMessagesRef to prevent stale closure in sendChatMessage.
- **What changed**:
  - Added `const chatMessagesRef = useRef<ChatMessage[]>([])`
  - Syncing: `chatMessagesRef.current = chatMessages`
  - Using: `messages: [...chatMessagesRef.current, userMsg]` instead of `[...chatMessages, userMsg]`
- **Why**: React closures capture state at callback creation time; refs always have fresh values.

**Q: Suggestions not updating after transcription?**

- **Status**: ✅ Fixed. Removed stale transcript parameter from fetchSuggestions.
- **What changed**:
  - Changed: `fetchSuggestions([...transcriptRef.current, newChunk])`
  - To: `fetchSuggestions()` which uses `transcriptRef.current` internally
- **Why**: Passing stale arrays caused mismatched suggestion context.

**Q: Manual refresh not working?**

- **Status**: ✅ Fixed. manualRefresh now calls flushBuffer() then fetchSuggestions().
- **What changed**: Removed blob handling from manualRefresh (flushBuffer is now void).
- **Note**: flushBuffer() calls mediaRecorder.requestData() + stop(), which triggers normal onstop → onChunkCb flow.

### Refresh Interval Issues

**Q: Refresh intervals <5s not working?**

- **Status**: ✅ Fixed. Changed Math.max(5) → Math.max(2) to allow 2s minimum.
- **What changed**:
  - In updateSettings: `Math.max(5, ...) → Math.max(2, ...)`
  - In startRecording: `Math.max(5, ...) → Math.max(2, ...)`
- **Why**: Previous code enforced 5s minimum even if user set lower value.
- **Note**: Removed useEffect override that forced 8s refresh; now respects user settings.

---

## Project Structure

```
app/
  ├── page.tsx              # Main dashboard layout
  ├── api/
  │   ├── transcribe/route.ts    # Groq Whisper endpoint
  │   ├── suggestions/route.ts   # Groq LLM endpoint for suggestions
  │   └── chat/route.ts          # Streaming chat responses
  └── globals.css           # Tailwind styles
components/
  ├── MicPanel.tsx          # Mic control & transcript display
  ├── SuggestionsPanel.tsx  # Live suggestions with real-time refresh
  ├── ChatPanel.tsx         # Chat interface
  └── SettingsModal.tsx     # API key & configuration modal
lib/
  ├── audioCapture.ts       # MediaRecorder wrapper (2s chunks)
  ├── useSession.ts         # Core state logic with auto-refresh
  ├── groq.ts              # Groq API utilities
  ├── prompts.ts           # System prompts for suggestions & chat
  └── utils.ts             # UI utilities
types/
  └── index.ts             # TypeScript interfaces
```

---

Built with ❤️ for high-stakes, real-time decision making in meetings.
