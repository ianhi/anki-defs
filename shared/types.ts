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
  error?: string; // Error message to display in the assistant bubble
}

// Core card content (what makes up a flashcard)
export interface CardContent {
  word: string;
  definition: string;
  nativeDefinition: string;
  exampleSentence: string;
  sentenceTranslation: string;
}

// Card preview from AI response (includes Anki check results)
export interface CardPreview extends CardContent {
  alreadyExists: boolean; // Whether word already exists in Anki deck
  existingCard?: CardContent; // The existing card's content (for comparison)
  spellingCorrection?: string; // If input was a typo: "বাজারে → বাজার"
  tags?: string[]; // Tags applied when the user adds this card (PDF scout flow)
}

export interface RelemmatizeRequest {
  word: string;
  sentence?: string;
}

export interface RelemmatizeResponse {
  lemma: string;
  definition: string;
}

// Distractor for MC cloze cards
export interface Distractor {
  word: string;
  definition: string;
}

export interface DistractorResponse {
  distractors: Distractor[];
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

// Template health types
export interface TemplateContent {
  front: string;
  back: string;
}

export interface StaleTemplate {
  name: string;
  currentVersion: number | null;
  current: TemplateContent;
  proposed: TemplateContent;
}

export interface NoteTypeIssue {
  modelName: string;
  cardType: string;
  latestVersion: number;
  missingFields: string[];
  staleTemplates: StaleTemplate[];
  cssOutdated: boolean;
  currentCss?: string;
  proposedCss?: string;
}

// Anki types
export interface AnkiNote {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
}

// Settings types
export type AIProvider = 'claude' | 'gemini' | 'openrouter';

export type CardType = 'vocab' | 'cloze' | 'mcCloze';

export interface CustomLanguage {
  code: string;
  name: string;
}

// Per-card-template gates for the vocab note type. Populating only the
// matching EnableXxx field on a note tells Anki which of the 3 vocab card
// templates (Recognition / Production / Listening) to generate from it.
export interface VocabCardTemplates {
  recognition: boolean;
  production: boolean;
  listening: boolean;
}

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
  ankiConnectUrl: string;
  apiToken: string;
  translationPrefix: string;
  autoDetectEnglish: boolean;
  // Per-deck language settings
  deckLanguages: Record<string, string>; // Maps deck names to language codes
  customLanguages: CustomLanguage[]; // User-defined languages without .json files
  // Card type defaults
  defaultCardTypes: CardType[];
  vocabCardTemplates: VocabCardTemplates;
  targetLanguage: string;
  // Note type prefix used when auto-creating language-specific note types
  // (e.g. `${noteTypePrefix}-es-MX`, `${noteTypePrefix}-es-MX-cloze`)
  noteTypePrefix: string;
  // Override the locale used in Anki's `{{tts X:Field}}` template tag, per
  // language code. Useful when the user has voices installed for a different
  // region (e.g. Spanish deck tagged `es-MX` but only `es_US` voices installed).
  // Keyed by the language code (e.g. `es-MX`); value is the locale Anki should
  // ask for (e.g. `es_US`). When unset, the language file's `ttsLocale` is used.
  ankiTtsLocaleByLanguage: Record<string, string>;
  // Embedded TTS audio: generate MP3 via Google Cloud TTS and store in Anki media
  ttsEnabled: boolean;
  onboardingComplete: boolean;
}

export const CARD_DATA_FIELDS = [
  'Word',
  'Definition',
  'NativeDefinition',
  'Example',
  'Translation',
] as const;
export type CardDataField = (typeof CARD_DATA_FIELDS)[number];

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: 'gemini',
  claudeApiKey: '',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  showTransliteration: false,
  leftHanded: false,
  openRouterApiKey: '',
  openRouterModel: 'google/gemini-2.5-flash',
  defaultDeck: 'Bangla',
  ankiConnectUrl: 'http://localhost:8765',
  apiToken: '',
  translationPrefix: 'bn:',
  targetLanguage: 'bn-IN',
  autoDetectEnglish: true,
  deckLanguages: {},
  customLanguages: [],
  defaultCardTypes: ['vocab'],
  vocabCardTemplates: {
    recognition: true,
    production: false,
    listening: true,
  },
  noteTypePrefix: 'anki-defs',
  ankiTtsLocaleByLanguage: {},
  ttsEnabled: false,
  onboardingComplete: false,
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
// Source of truth: shared/data/model-pricing.json
import modelPricing from './data/model-pricing.json' with { type: 'json' };
export const MODEL_PRICING: Record<string, { input: number; output: number }> = modelPricing;

export function computeCost(usage: TokenUsage): number {
  const pricing = MODEL_PRICING[usage.model || ''];
  if (!pricing) return 0;
  return (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;
}

// Photo-to-flashcards types
export interface VocabPair {
  word: string;
  definition: string;
  alreadyExists?: boolean;
  existingDefinition?: string;
}

export interface PhotoExtractResponse {
  pairs: VocabPair[];
  usage?: TokenUsage;
}

// PDF-to-flashcards types
//
// Pipeline: client parses the PDF with pdfjs and produces a list of PdfSection
// (structural). The server scout pass classifies each section and links related
// ones, producing ScoutedSection (semantic). The user reviews scouted sections,
// then extract runs per section using the prompt matched by contentType.
export type PdfContentType = 'vocab' | 'passage' | 'glossary' | 'exercise' | 'prose';

export interface PdfFontProfile {
  sizePt: number; // median font size of body text
  bold: boolean;
  indentPt: number; // median left indent
  columns: 1 | 2 | 3;
}

export interface PdfSection {
  id: string;
  heading: string;
  pageStart: number; // 1-indexed
  pageEnd: number;
  bodySnippet: string; // first ~10 lines, enough for scout to classify
  fontProfile: PdfFontProfile;
}

export interface ScoutedSection extends PdfSection {
  contentType: PdfContentType;
  suggestedTags: string[]; // kebab-case, no `pdf:` source tag (added separately)
  worthExtracting: boolean;
  confidence: number; // 0..1
  relatedTo: string[]; // ids of paired sections (passage↔glossary, etc.)
}

// Chapter-level outline entry — groups sections for the chapter picker UI.
// For PDFs with embedded bookmarks, chapters are the numbered chapter nodes.
// For heading-heuristic PDFs, chapters are top-level headings.
export interface PdfChapter {
  id: string;
  title: string;
  pageStart: number; // 1-indexed
  pageEnd: number;
  sectionIds: string[]; // ids of PdfSections within this chapter
}

export interface PdfScoutRequest {
  sections: PdfSection[];
  deck?: string; // for language resolution
}

export interface PdfScoutResponse {
  sections: ScoutedSection[];
  usage?: TokenUsage;
}

// Extract request — primary section plus text for any sections it links to.
// The client resolves relatedTo → supportingSections before calling.
export interface PdfExtractRequest {
  primary: {
    id: string;
    contentType: PdfContentType;
    heading: string;
    text: string;
  };
  supporting: Array<{
    id: string;
    contentType: PdfContentType;
    heading: string;
    text: string;
  }>;
  tags: string[]; // merged tags applied to every card from this extract
  deck?: string;
}

// Photo-to-cloze types. Two-stage pipeline:
//   1. transcribe (vision): image -> structured plain-text transcription
//   2. extract (text): transcription -> ClozeItem[]
// The transcription is shown to the user for review/edit between stages.
export interface PhotoClozeTranscribeResponse {
  transcription: string;
  usage?: TokenUsage;
}

export type ClozeBlankCategory =
  | 'verb'
  | 'noun'
  | 'preposition'
  | 'article'
  | 'pronoun'
  | 'conjunction'
  | 'other';

export interface ClozeBlank {
  answer: string;
  // Rendered in Anki as {{cN::answer::hint}} when non-null.
  hint: string | null;
  category: ClozeBlankCategory;
}

export interface ClozeItem {
  itemNumber: number | null;
  // Blanks marked `__1__`, `__2__`, ... in the order they appear.
  sentence: string;
  blanks: ClozeBlank[];
  translation: string;
  confidence: 'high' | 'low';
  contextPreamble: string | null;
}

export interface PhotoClozeExtractResponse {
  items: ClozeItem[];
  unsupported?: string[];
  usage?: TokenUsage;
}

// API request/response types
export interface ChatStreamRequest {
  newMessage: string;
  deck?: string;
  highlightedWords?: string[];
  userContext?: string;
  mode?: 'english-to-target';
}

export interface SearchNotesRequest {
  query: string;
}

// Domain payload for creating a note. The server resolves the deck's
// language, ensures the right note type exists, and builds the field map.
// The client never deals with model names or field mapping directly.
export interface CreateNoteRequest {
  deck: string;
  cardType: CardType;
  word: string;
  definition: string;
  nativeDefinition: string;
  example: string;
  translation: string;
  // Vocab cards only — overrides the global vocabCardTemplates default for this note.
  vocabTemplates?: VocabCardTemplates;
  tags?: string[];
  // Set to true after the user approves a note-type migration (adding missing
  // fields). Without this flag the server returns 409 when migration is needed.
  approveMigration?: boolean;
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
  | { type: 'text'; data: string }
  | { type: 'usage'; data: TokenUsage }
  | { type: 'done'; data: null }
  | { type: 'error'; data: string };
