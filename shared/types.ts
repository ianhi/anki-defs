// Message types for chat
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string; // User messages may contain **word** markers for focused words
  timestamp: number;
  cardPreviews?: CardPreview[];
  tokenUsage?: TokenUsage;
  refinements?: string[];
  originalQuery?: string;
}

// Core card content (what makes up a flashcard)
export interface CardContent {
  word: string;
  definition: string;
  banglaDefinition: string;
  exampleSentence: string;
  sentenceTranslation: string;
}

// Card preview from AI response (includes Anki check results)
export interface CardPreview extends CardContent {
  alreadyExists: boolean; // Whether word already exists in Anki deck
  existingCard?: CardContent; // The existing card's content (for comparison)
  spellingCorrection?: string; // If input was a typo: "বাজারে → বাজার"
}

export interface RelemmatizeRequest {
  word: string;
  sentence?: string;
}

export interface RelemmatizeResponse {
  lemma: string;
  definition: string;
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
  banglaDefinition: string;
  exampleSentence: string;
  sentenceTranslation: string;
  tags?: string[];
}

// Settings types
export type AIProvider = 'claude' | 'gemini' | 'openrouter';

// Maps card data fields (Word, Definition, Example, Translation) to note type field names
export type FieldMapping = Record<string, string>;

export interface Settings {
  aiProvider: AIProvider;
  claudeApiKey: string;
  geminiApiKey: string;
  geminiModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  showTransliteration: boolean;
  leftHanded: boolean;
  defaultDeck: string;
  defaultModel: string;
  ankiConnectUrl: string;
  fieldMapping: FieldMapping;
  apiToken: string;
  englishToBanglaPrefix: string;
  autoDetectEnglish: boolean;
}

export const CARD_DATA_FIELDS = [
  'Word',
  'Definition',
  'BanglaDefinition',
  'Example',
  'Translation',
] as const;
export type CardDataField = (typeof CARD_DATA_FIELDS)[number];

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'claude',
  claudeApiKey: '',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash-lite',
  showTransliteration: false,
  leftHanded: false,
  openRouterApiKey: '',
  openRouterModel: 'google/gemini-2.5-flash',
  defaultDeck: 'Bangla',
  defaultModel: 'Bangla (and reversed)',
  ankiConnectUrl: 'http://localhost:8765',
  fieldMapping: {
    Word: 'Bangla',
    Definition: 'Eng_trans',
    BanglaDefinition: 'bangla-def',
    Example: 'example sentence',
    Translation: 'sentence-trans',
  },
  apiToken: '',
  englishToBanglaPrefix: 'bn:',
  autoDetectEnglish: true,
};

// Model options per provider
export interface ModelOption {
  value: string;
  label: string;
}

export const GEMINI_MODELS: ModelOption[] = [
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
];

export const OPENROUTER_MODELS: ModelOption[] = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick (Free)' },
  { value: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 (Free)' },
  { value: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
];

// Pricing per million tokens (input/output) in USD
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  // Gemini
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-3-flash-preview': { input: 0.5, output: 3.0 },
  // OpenRouter
  'google/gemini-3-flash-preview': { input: 0.5, output: 3.0 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'openai/gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'openai/gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'meta-llama/llama-4-maverick:free': { input: 0.0, output: 0.0 },
  'mistralai/mistral-small-3.1-24b-instruct:free': { input: 0.0, output: 0.0 },
  'deepseek/deepseek-v3.2': { input: 0.24, output: 0.38 },
};

export function computeCost(usage: TokenUsage): number {
  const pricing = MODEL_PRICING[usage.model || ''];
  if (!pricing) return 0;
  return (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;
}

// API request/response types
export interface ChatStreamRequest {
  messages: Message[];
  newMessage: string;
  deck?: string;
  highlightedWords?: string[];
  userContext?: string;
  mode?: 'english-to-bangla';
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

// Platform detection
export interface PlatformInfo {
  platform: 'web' | 'android';
  ankiAvailable?: boolean;
  hasPermission?: boolean;
}

// SSE event types (discriminated union for type safety)
export type SSEEvent =
  | { type: 'card_preview'; data: CardPreview }
  | { type: 'usage'; data: TokenUsage }
  | { type: 'done'; data: null }
  | { type: 'error'; data: string };
