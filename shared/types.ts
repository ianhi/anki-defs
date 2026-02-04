// Message types for chat
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cardPreviews?: CardPreview[];
  wordAnalysis?: WordAnalysis;
  sentenceAnalysis?: SentenceAnalysis;
}

// Core card content (what makes up a flashcard)
export interface CardContent {
  word: string;
  definition: string;
  exampleSentence: string;
  sentenceTranslation: string;
}

// Card preview from AI response (includes Anki check results)
export interface CardPreview extends CardContent {
  alreadyExists: boolean; // Whether word already exists in Anki deck
  existingNoteId?: number; // If exists, the note ID in Anki
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
  defaultDeck: 'Bangla',
  defaultModel: 'Bangla (and reversed)',
  ankiConnectUrl: 'http://localhost:8765',
};

// API request/response types
export interface ChatStreamRequest {
  messages: Message[];
  newMessage: string;
  deck?: string;
  highlightedWords?: string[];
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
