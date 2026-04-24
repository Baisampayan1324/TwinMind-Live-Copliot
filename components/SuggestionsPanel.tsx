'use client';

import { Suggestion, SuggestionBatch, SuggestionType } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, MessageSquare, HelpCircle, Lightbulb, CheckCircle2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<SuggestionType, { color: string; icon: any }> = {
  'Question to ask': { color: 'blue', icon: HelpCircle },
  'Talking point':   { color: 'emerald', icon: MessageSquare },
  'Answer':          { color: 'green', icon: CheckCircle2 },
  'Fact-check':      { color: 'amber', icon: Search },
  'Clarification':   { color: 'slate', icon: Lightbulb },
};

function SuggestionCard({ suggestion, onClick }: { suggestion: Suggestion; onClick: (s: Suggestion) => void }) {
  const config = TYPE_CONFIG[suggestion.type] ?? TYPE_CONFIG['Talking point'];
  const Icon = config.icon;

  return (
    <motion.button
      onClick={() => onClick(suggestion)}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left bg-neutral-900 border border-neutral-800 p-4 transition-all hover:border-neutral-700 hover:shadow-lg group relative overflow-hidden"
      style={{ borderRadius: '2px' }}
    >
      {/* Left color bar */}
      <div className={cn(
        'absolute top-0 left-0 w-1 h-full',
        config.color === 'blue'    && 'bg-blue-500',
        config.color === 'emerald' && 'bg-emerald-500',
        config.color === 'green'   && 'bg-green-500',
        config.color === 'amber'   && 'bg-amber-500',
        config.color === 'slate'   && 'bg-slate-500',
      )} />

      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border flex items-center gap-1',
          config.color === 'blue'    && 'text-blue-400 border-blue-900/50 bg-blue-500/5',
          config.color === 'emerald' && 'text-emerald-400 border-emerald-900/50 bg-emerald-500/5',
          config.color === 'green'   && 'text-green-400 border-green-900/50 bg-green-500/5',
          config.color === 'amber'   && 'text-amber-400 border-amber-900/50 bg-amber-500/5',
          config.color === 'slate'   && 'text-slate-400 border-slate-900/50 bg-slate-500/5',
        )}>
          <Icon className="w-3 h-3" />
          {suggestion.type}
        </span>
      </div>

      <h4 className="text-sm font-bold text-white mb-2 leading-tight group-hover:text-emerald-400 transition-colors">
        {suggestion.headline}
      </h4>
      <p className="text-xs text-neutral-400 leading-relaxed">
        {suggestion.preview}
      </p>
    </motion.button>
  );
}

interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  isLoading: boolean;
  hasTranscript: boolean;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
}

export default function SuggestionsPanel({ batches, isLoading, hasTranscript, onRefresh, onSuggestionClick }: SuggestionsPanelProps) {
  return (
    <div className="flex flex-col h-full bg-neutral-950">
      <div className="p-6 border-b border-neutral-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Live Suggestions</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading || !hasTranscript}
          className="p-2 text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Refresh suggestions"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth">
        {/* Skeleton while loading first batch */}
        {isLoading && batches.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-neutral-900/50 border border-neutral-800 animate-pulse" style={{ borderRadius: '2px' }} />
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {batches.map((batch, index) => (
            <motion.div
              key={batch.batchId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                  {index === 0 ? 'Latest' : new Date(batch.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="h-px flex-1 bg-neutral-900" />
              </div>

              {batch.suggestions.map((suggestion, sIdx) => (
                <SuggestionCard
                  key={`${batch.batchId}-${sIdx}`}
                  suggestion={suggestion}
                  onClick={onSuggestionClick}
                />
              ))}
            </motion.div>
          ))}
        </AnimatePresence>

        {batches.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-neutral-800 p-8 text-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-neutral-900 flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-neutral-800" />
            </div>
            <p className="text-sm italic">
              {hasTranscript
                ? 'Suggestions will appear after the next transcript chunk.'
                : 'Start recording — suggestions will surface automatically as your meeting progresses.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
