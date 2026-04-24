# TwinMind Live Suggestions Copilot

A production-quality AI meeting copilot that transcribes speech in real time, surfaces contextual suggestions, and provides a continuous chat assistant.

## Features

- **Real-time Transcription**: Uses Groq's `whisper-large-v3` for ultra-fast audio-to-text.
- **Contextual Suggestions**: Surfaces intelligent "Question to ask", "Talking point", "Answer", "Fact-check", and "Clarification" cards every 30 seconds using `llama-3.3-70b-versatile`.
- **Streaming Chat**: A dedicated sidebar for deep-diving into suggestions or asking freeform questions with sub-500ms latency.
- **Zero Infrastructure**: Built with Next.js App Router and API routes, designed for Vercel deployment.
- **Privacy First**: API keys and settings are stored in `sessionStorage` and never touch the server-side logs.

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Framer Motion, Lucide Icons.
- **Inference**: Groq Cloud API (Whisper + Llama 3.3).
- **Audio**: Web MediaRecorder API.

## Setup

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd twinmind
   npm install
   ```

2. **Run Locally**:
   ```bash
   npm run dev
   ```

3. **Configure**:
   - Open the app in your browser.
   - Click the **Gear Icon** (top right).
   - Enter your **Groq API Key**.
   - (Optional) Customize the prompts and context windows.

4. **Start**:
   - Click the **Microphone** icon to begin.

## Deployment

Deploy to Vercel in seconds:

```bash
npx vercel
```

## Prompt Strategy

- **Suggestion Variety**: The system is tuned to avoid repetitive suggestion types (e.g., won't give 3 questions in a row). It adapts to the conversation flow: if a question was asked, it prioritizes "Answer"; if a claim was made, it prioritizes "Fact-check".
- **Context Window**: By default, the last 5 transcript chunks (~2.5 minutes of conversation) are sent to the suggestions engine to maintain relevance without overwhelming the LLM.
- **Streaming UX**: Chat responses are streamed token-by-token using Server-Sent Events (SSE) for immediate feedback.

## Tradeoffs

- **Session Storage**: Settings do not persist across hard page reloads. This is intentional to ensure privacy and "clean slate" sessions.
- **30s Audio Chunks**: Slicing audio every 30s provides a good balance between transcription latency and API overhead.
- **JSON Export**: Provides a portable history of the transcript, suggestions, and chat.

---
Built with ❤️ for high-stakes meetings.
