'use client';

import { TranscriptChunk } from '@/types';
import { Mic, MicOff, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MicPanelProps {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: TranscriptChunk[];
  onStart: () => void;
  onStop: () => void;
  onManualRefresh: () => void;
}

export default function MicPanel({ isRecording, isTranscribing, transcript, onStart, onStop, onManualRefresh }: MicPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Mic Header */}
      <div className="p-6 border-b border-neutral-900 flex flex-col items-center gap-4">
        <button
          onClick={isRecording ? onStop : onStart}
          className={cn(
            'relative w-20 h-20 flex items-center justify-center transition-all duration-500',
            isRecording ? 'text-red-500' : 'text-neutral-500'
          )}
        >
          {isRecording && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 bg-red-500 rounded-full"
            />
          )}
          <div className={cn(
            'relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-2 transition-colors',
            isRecording ? 'border-red-500 bg-red-500/10' : 'border-neutral-800 bg-neutral-900'
          )}>
            {isRecording ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
          </div>
        </button>

        <div className="text-center">
          <p className={cn('text-xs font-bold uppercase tracking-widest', isRecording ? 'text-red-500' : 'text-neutral-500')}>
            {isTranscribing ? 'Transcribing...' : isRecording ? 'Listening...' : 'Microphone Off'}
          </p>
          {!isRecording && transcript.length === 0 && (
            <p className="text-xs text-neutral-600 mt-1">Click the mic to begin recording.</p>
          )}
        </div>

        {isRecording && (
          <button
            onClick={onManualRefresh}
            className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-emerald-400 uppercase tracking-widest transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh Now
          </button>
        )}
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-neutral-900">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Transcript</h3>
          <span className="text-[10px] text-neutral-700 uppercase">{transcript.length} chunks</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          <AnimatePresence initial={false}>
            {transcript.map((chunk) => (
              <motion.div
                key={chunk.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-neutral-700 mt-0.5 min-w-[52px]">
                    {chunk.timestamp}
                  </span>
                  <p className="text-sm text-neutral-300 leading-relaxed group-hover:text-white transition-colors">
                    {chunk.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {transcript.length === 0 && !isRecording && (
            <div className="h-full flex flex-col items-center justify-center text-neutral-800 p-8 text-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-neutral-900 flex items-center justify-center">
                <Mic className="w-6 h-6 text-neutral-800" />
              </div>
              <p className="text-sm italic">Session transcript will appear here once you start recording.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
