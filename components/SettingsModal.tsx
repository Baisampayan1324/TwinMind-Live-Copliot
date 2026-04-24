'use client';

import { useState, useEffect } from 'react';
import { Settings } from '@/types';
import { X, Save, KeyRound, SlidersHorizontal, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  settings: Settings;
  onSave: (settings: Partial<Settings>) => void;
  onClose: () => void;
}

type Tab = 'api' | 'advanced';

export default function SettingsModal({ isOpen, settings, onSave, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('api');
  const [local, setLocal] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  // Sync local copy when settings prop changes
  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleSave = () => {
    if (!local.apiKey.trim()) {
      alert('Please provide a Groq API Key to proceed.');
      return;
    }
    onSave(local);
    onClose();
  };

  const hasKey = !!settings.apiKey;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-xl bg-neutral-950 border border-neutral-800 overflow-hidden"
            style={{ borderRadius: '2px' }}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-900 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Session Configuration</h2>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mt-1">
                  Model: GPT-OSS 120B
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white p-2 transition-colors disabled:opacity-30"
                disabled={!hasKey}
                title={!hasKey ? 'Add an API key first' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-900">
              {(['api', 'advanced'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2',
                    tab === t
                      ? 'text-white border-b-2 border-emerald-500'
                      : 'text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  {t === 'api' ? <KeyRound className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
                  {t === 'api' ? 'API Key' : 'Advanced'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 space-y-5">
              {tab === 'api' && (
                <>
                  {!hasKey && (
                    <div className="flex items-start gap-3 p-4 bg-emerald-950/30 border border-emerald-900/40 text-xs text-emerald-300">
                      <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        A free <strong>Groq API key</strong> is required to use TwinMind Live.{' '}
                        <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="underline">
                          Get one at console.groq.com
                        </a>
                        {' '}— it's free and takes 30 seconds.
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      Groq API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={local.apiKey}
                        onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
                        placeholder="gsk_..."
                        autoComplete="off"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 pr-20"
                        style={{ borderRadius: '2px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase tracking-widest transition-colors"
                      >
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-2">
                      Stored in sessionStorage only — cleared when you close the tab.
                    </p>
                  </div>
                </>
              )}

              {tab === 'advanced' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                        Chunk Interval (s)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={120}
                        value={local.refreshInterval}
                        onChange={(e) => setLocal({ ...local, refreshInterval: Number(e.target.value) })}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 px-4 py-3 text-sm text-white outline-none transition-colors"
                        style={{ borderRadius: '2px' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                        Context Window
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={local.suggestionContextWindow}
                        onChange={(e) => setLocal({ ...local, suggestionContextWindow: Number(e.target.value) })}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 px-4 py-3 text-sm text-white outline-none transition-colors"
                        style={{ borderRadius: '2px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      Suggestion Prompt
                    </label>
                    <textarea
                      rows={5}
                      value={local.suggestionPrompt}
                      onChange={(e) => setLocal({ ...local, suggestionPrompt: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 px-4 py-3 text-xs text-neutral-300 outline-none transition-colors font-mono resize-none"
                      style={{ borderRadius: '2px' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      Detailed Answer Prompt
                    </label>
                    <textarea
                      rows={5}
                      value={local.detailedAnswerPrompt}
                      onChange={(e) => setLocal({ ...local, detailedAnswerPrompt: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-emerald-500 px-4 py-3 text-xs text-neutral-300 outline-none transition-colors font-mono resize-none"
                      style={{ borderRadius: '2px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-neutral-900 flex items-center justify-between">
              <p className="text-[10px] text-neutral-600 uppercase tracking-widest">
                {hasKey ? '✓ API key configured' : '⚠ API key required'}
              </p>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest transition-colors"
                style={{ borderRadius: '2px' }}
              >
                <Save className="w-3.5 h-3.5" />
                Save & Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
