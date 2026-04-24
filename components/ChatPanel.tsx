'use client';

import { ChatMessage } from '@/types';
import { Send, User, Bot, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
}

export default function ChatPanel({ messages, isStreaming, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isStreaming) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-l border-neutral-900">
      {/* Header */}
      <div className="p-6 border-b border-neutral-900 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Chat Copilot</h2>
          <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">
            GPT-OSS 120B
          </p>
        </div>
        {isStreaming && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                {msg.role === 'assistant' ? (
                  <>
                    <Bot className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Assistant</span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">You</span>
                    <User className="w-3 h-3 text-neutral-500" />
                  </>
                )}
                <span className="text-[8px] text-neutral-700 ml-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={cn(
                  'max-w-[88%] p-4 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-900 text-neutral-200 border border-neutral-800'
                )}
                style={{ borderRadius: '2px' }}
              >
                {msg.content || (msg.role === 'assistant' && <Loader2 className="w-4 h-4 animate-spin opacity-50" />)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-6 border-t border-neutral-900 shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this meeting..."
            className="w-full bg-neutral-900 border border-neutral-800 p-4 pr-12 text-sm text-white focus:border-emerald-500 outline-none transition-colors placeholder:text-neutral-600"
            style={{ borderRadius: '2px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-emerald-400 disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
