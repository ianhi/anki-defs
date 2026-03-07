// Message types for chat
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  highlightedWords?: string[];
  cardPreviews?: CardPreview[];
  wordAnalysis?: WordAnalysis;
  sentenceAnalysis?: SentenceAnalysis;
  tokenUsage?: TokenUsage;
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
  inflectedForm?: string; // Original inflected form from the sentence (if different from lemma)
  alreadyExists: boolean; // Whether word already exists in Anki deck
  lemmaMismatch?: boolean; // True when extraction AI returned a different lemma than the main AI
  originalLemma?: string; // The lemma suggested by the main AI (when mismatched)
}

export interface RelemmatizeRequest {
  word: string;
  sentence?: string;
}

export interface RelemmatizeResponse {
  lemma: string;
  definition: string;
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

// Session card types (synced between devices via server)
export interface SessionCard extends CardContent {
  id: string;
  createdAt: number;
  noteId: number;
  deckName: string;
  modelName: string;
}

export interface PendingCard extends CardContent {
  id: string;
  createdAt: number;
  deckName: string;
  modelName: string;
}

export interface SessionState {
  cards: SessionCard[];
  pendingQueue: PendingCard[];
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
export type AIProvider = 'claude' | 'gemini' | 'openrouter';

export interface Settings {
  aiProvider: AIProvider;
  claudeApiKey: string;
  geminiApiKey: string;
  geminiModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  showTransliteration: boolean;
  defaultDeck: string;
  defaultModel: string;
  ankiConnectUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'claude',
  claudeApiKey: '',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash-lite',
  showTransliteration: false,
  openRouterApiKey: '',
  openRouterModel: 'google/gemini-2.5-flash',
  defaultDeck: 'Bangla',
  defaultModel: 'Bangla (and reversed)',
  ankiConnectUrl: 'http://localhost:8765',
};

// Pricing per million tokens (input/output) in USD
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  // Gemini
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  // OpenRouter (per-model, approximate)
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'openai/gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'openai/gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'meta-llama/llama-4-maverick:free': { input: 0.0, output: 0.0 },
  'mistralai/mistral-small-3.1-24b-instruct:free': { input: 0.0, output: 0.0 },
  'deepseek/deepseek-v3.2': { input: 0.24, output: 0.38 },
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

// Token usage tracking
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  provider: AIProvider;
  model?: string;
}

// SSE event types (discriminated union for type safety)
export type SSEEvent =
  | { type: 'text'; data: string }
  | { type: 'card_preview'; data: CardPreview }
  | { type: 'word_analysis'; data: WordAnalysis }
  | { type: 'sentence_analysis'; data: SentenceAnalysis }
  | { type: 'usage'; data: TokenUsage }
  | { type: 'done'; data: null }
  | { type: 'error'; data: string };
