export interface TranscriptChunk {
  id: string;
  timestamp: string;
  text: string;
}

export type SuggestionType = 'Question to ask' | 'Talking point' | 'Answer' | 'Fact-check' | 'Clarification';

export interface Suggestion {
  type: SuggestionType;
  headline: string;
  preview: string;
}

export interface SuggestionBatch {
  batchId: string;
  generatedAt: string;
  suggestions: Suggestion[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Settings {
  apiKey: string;
  suggestionPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
  suggestionContextWindow: number;
  chatContextWindow: number;
  refreshInterval: number;
}

export interface SessionExport {
  exportedAt: string;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
}
