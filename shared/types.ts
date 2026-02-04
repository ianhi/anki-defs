// Message types for chat
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cardPreview?: CardPreview;
  wordAnalysis?: WordAnalysis;
  sentenceAnalysis?: SentenceAnalysis;
}

export interface CardPreview {
  word: string;
  definition: string;
  exampleSentence: string;
  sentenceTranslation: string;
  alreadyExists: boolean;
  noteId?: number;
}

export interface WordAnalysis {
  word: string;
  lemma: string;
  partOfSpeech: string;
  definition: string;
  examples: string[];
  existsInAnki: boolean;
  noteId?: number;
}

export interface SentenceAnalysis {
  originalSentence: string;
  translation: string;
  words: AnalyzedWord[];
}

export interface AnalyzedWord {
  word: string;
  lemma: string;
  partOfSpeech: string;
  meaning: string;
  existsInAnki: boolean;
  noteId?: number;
}

// Anki types
export interface AnkiNote {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
}

export interface CreateCardParams {
  deck: string;
  model: string;
  word: string;
  definition: string;
  exampleSentence: string;
  sentenceTranslation: string;
  tags?: string[];
}

// Settings types
export type AIProvider = 'claude' | 'gemini';

export interface Settings {
  aiProvider: AIProvider;
  claudeApiKey: string;
  geminiApiKey: string;
  defaultDeck: string;
  defaultModel: string;
  ankiConnectUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'claude',
  claudeApiKey: '',
  geminiApiKey: '',
  defaultDeck: 'Bangla Vocabulary',
  defaultModel: 'Basic',
  ankiConnectUrl: 'http://localhost:8765',
};

// API request/response types
export interface ChatStreamRequest {
  messages: Message[];
  newMessage: string;
  deck?: string;
}

export interface DefineRequest {
  word: string;
  deck?: string;
}

export interface AnalyzeRequest {
  sentence: string;
  deck?: string;
}

export interface SearchNotesRequest {
  query: string;
}

export interface CreateNoteRequest {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
}

// SSE event types
export interface SSEEvent {
  type: 'text' | 'card_preview' | 'word_analysis' | 'sentence_analysis' | 'done' | 'error';
  data: string | CardPreview | WordAnalysis | SentenceAnalysis | null;
}
