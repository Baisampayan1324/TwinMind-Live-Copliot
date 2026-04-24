'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/lib/useSession';
import MicPanel from '@/components/MicPanel';
import SuggestionsPanel from '@/components/SuggestionsPanel';
import ChatPanel from '@/components/ChatPanel';
import SettingsModal from '@/components/SettingsModal';
import { Download, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const session = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-open settings if no API key on mount
  useEffect(() => {
    if (!session.settings.apiKey) {
      setSettingsOpen(true);
    }
  }, [session.settings.apiKey]);

  // Auto-dismiss errors after 5s
  useEffect(() => {
    if (!session.error) return;
    const t = setTimeout(session.clearError, 5000);
    return () => clearTimeout(t);
  }, [session.error, session.clearError]);

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-950">
      {/* Header */}
      <header className="h-14 border-b border-neutral-900 flex items-center justify-between px-6 bg-neutral-950/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-emerald-600 flex items-center justify-center rounded-sm">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-white">
            TwinMind <span className="text-emerald-500">Live</span>
          </h1>
          <span className="hidden sm:inline text-[10px] text-neutral-600 bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
            Meeting Copilot
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={session.exportSession}
            disabled={session.transcript.length === 0 && session.chatMessages.length <= 1}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 bg-neutral-900/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderRadius: '2px' }}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 bg-neutral-900/50 transition-all"
            style={{ borderRadius: '2px' }}
          >
            Settings
            {!session.settings.apiKey && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </header>

      {/* Error Toast */}
      {session.error && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`mx-4 mt-3 shrink-0 flex items-center gap-3 px-4 py-3 text-sm border ${
            session.error.column === 'global'
              ? 'bg-red-950/50 border-red-900/60 text-red-300'
              : 'bg-amber-950/50 border-amber-900/60 text-amber-300'
          }`}
          style={{ borderRadius: '2px' }}
        >
          <span className="flex-1">{session.error.message}</span>
          <button onClick={session.clearError} className="text-current opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </motion.div>
      )}

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Mic & Transcript */}
        <section className="w-1/4 min-w-[280px] border-r border-neutral-900">
          <MicPanel
            isRecording={session.isRecording}
            isMicPending={session.isMicPending}
            isTranscribing={session.isTranscribing}
            transcript={session.transcript}
            onStart={session.startRecording}
            onStop={session.stopRecording}
            onManualRefresh={session.manualRefresh}
          />
        </section>

        {/* Column 2: Suggestions */}
        <section className="flex-1 border-r border-neutral-900">
          <SuggestionsPanel
            batches={session.suggestionBatches}
            isLoading={session.isLoadingSuggestions}
            onRefresh={session.manualRefresh}
            onSuggestionClick={session.clickSuggestion}
            hasTranscript={session.transcript.length > 0}
          />
        </section>

        {/* Column 3: Chat */}
        <section className="w-1/3 min-w-[320px]">
          <ChatPanel
            messages={session.chatMessages}
            isStreaming={session.isStreamingChat}
            onSendMessage={session.sendChatMessage}
          />
        </section>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        settings={session.settings}
        onSave={session.updateSettings}
        onClose={() => {
          if (!session.settings.apiKey) return; // prevent closing without a key
          setSettingsOpen(false);
        }}
      />
    </main>
  );
}
