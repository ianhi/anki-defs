import type {
  Settings,
  AnkiNote,
  CreateNoteRequest,
  RelemmatizeRequest,
  RelemmatizeResponse,
  SSEEvent,
  SessionState,
  SessionCard,
  PendingCard,
  PlatformInfo,
  PhotoExtractResponse,
  PhotoClozeTranscribeResponse,
  PhotoClozeExtractResponse,
  VocabPair,
  NoteTypeIssue,
  PdfScoutRequest,
  PdfScoutResponse,
  PdfExtractRequest,
} from 'shared';

const API_BASE = '/api';

async function* streamSSE(
  url: string,
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent, void, unknown> {
  const response = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to start stream to ${url}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data) as SSEEvent;
        } catch {
          if (import.meta.env.DEV) console.debug('[API] Failed to parse SSE event:', data);
        }
      }
    }
  }
}

export interface MigrationInfo {
  modelName: string;
  newFields: string[];
}

export class MigrationRequiredError extends Error {
  migrations: MigrationInfo[];
  constructor(migrations: MigrationInfo[]) {
    super('Note type migration required');
    this.name = 'MigrationRequiredError';
    this.migrations = migrations;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Platform API
export const platformApi = {
  get: () => fetchJson<PlatformInfo>('/platform'),
};

// Settings API
export const settingsApi = {
  get: () => fetchJson<Settings>('/settings'),
  update: (settings: Partial<Settings>) =>
    fetchJson<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

export const ttsApi = {
  check: () => fetchJson<{ available: boolean; error?: string; voiceCount?: number }>('/tts/check'),
};

// Anki API
export const ankiApi = {
  getDecks: () => fetchJson<{ decks: string[] }>('/anki/decks').then((r) => r.decks),
  search: (query: string) =>
    fetchJson<{ notes: AnkiNote[] }>('/anki/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }).then((r) => r.notes),
  createNote: async (note: CreateNoteRequest) => {
    const resp = await fetch(`${API_BASE}/anki/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    if (resp.status === 409) {
      const data = await resp.json();
      if (data.migrationRequired) {
        throw new MigrationRequiredError(data.migrations);
      }
    }
    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    return resp.json() as Promise<{ noteId: number; modelName: string }>;
  },
  getNote: (id: number) => fetchJson<{ note: AnkiNote }>(`/anki/notes/${id}`).then((r) => r.note),
  deleteNote: (id: number) =>
    fetchJson<{ success: boolean }>(`/anki/notes/${id}`, { method: 'DELETE' }),
  getStatus: () => fetchJson<{ connected: boolean }>('/anki/status').then((r) => r.connected),
  sync: () => fetchJson<{ success: boolean }>('/anki/sync', { method: 'POST' }),
  checkHealth: () => fetchJson<{ issues: NoteTypeIssue[] }>('/anki/health-check'),
  updateTemplates: (
    modelName: string,
    templates?: Record<string, { front: string; back: string }>,
    css?: string
  ) =>
    fetchJson<{ modelName: string; version: number; updated: boolean }>('/anki/update-templates', {
      method: 'POST',
      body: JSON.stringify({ modelName, ...(templates && { templates }), ...(css && { css }) }),
    }),
  mergeTemplates: (current: string, proposed: string) =>
    fetchJson<{ merged: string }>('/anki/merge-templates', {
      method: 'POST',
      body: JSON.stringify({ current, proposed }),
    }),
};

// Chat API
export const chatApi = {
  generateDistractors: (request: { word: string; sentence: string; definition: string }) =>
    fetchJson<{ distractors: { word: string; definition: string }[] }>('/chat/distractors', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  relemmatize: (request: RelemmatizeRequest) =>
    fetchJson<RelemmatizeResponse>('/chat/relemmatize', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  stream: (
    message: string,
    deck?: string,
    highlightedWords?: string[],
    userContext?: string,
    mode?: 'english-to-target',
    signal?: AbortSignal
  ) =>
    streamSSE(
      '/chat/stream',
      { newMessage: message, deck, highlightedWords, userContext, mode },
      signal
    ),
};

// Language API
export const languageApi = {
  getLanguages: () =>
    fetchJson<{
      languages: Array<{ code: string; name: string; nativeName: string; script?: string }>;
    }>('/anki/languages').then((r) => r.languages),
};

// Session API
export const sessionApi = {
  getState: () => fetchJson<SessionState>('/session'),

  addCard: (card: SessionCard) =>
    fetchJson<{ success: boolean }>('/session/cards', {
      method: 'POST',
      body: JSON.stringify(card),
    }),

  removeCard: (id: string) =>
    fetchJson<{ success: boolean }>(`/session/cards/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  addPending: (card: PendingCard) =>
    fetchJson<{ success: boolean }>('/session/pending', {
      method: 'POST',
      body: JSON.stringify(card),
    }),

  removePending: (id: string) =>
    fetchJson<{ success: boolean }>(`/session/pending/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  promotePending: (id: string, noteId: number) =>
    fetchJson<{ success: boolean; card: SessionCard }>(
      `/session/pending/${encodeURIComponent(id)}/promote`,
      {
        method: 'POST',
        body: JSON.stringify({ noteId }),
      }
    ),

  clear: () =>
    fetchJson<{ success: boolean }>('/session/clear', {
      method: 'POST',
    }),

  getUsage: () =>
    fetchJson<{
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCost: number;
      requestCount: number;
    }>('/session/usage'),

  resetUsage: () =>
    fetchJson<{ success: boolean }>('/session/usage/reset', {
      method: 'POST',
    }),

  getHistory: (params: { q?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return fetchJson<{ items: SessionCard[]; total: number }>(
      `/session/history${qs ? `?${qs}` : ''}`
    );
  },
};

// Photo API
export const photoApi = {
  extract: async (
    blob: Blob,
    deck: string,
    instructions?: string
  ): Promise<PhotoExtractResponse> => {
    const formData = new FormData();
    formData.append('image', blob, 'photo.jpg');
    formData.append('deck', deck);
    if (instructions) formData.append('instructions', instructions);
    const response = await fetch(`${API_BASE}/photo/extract`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  },

  generate: (pairs: VocabPair[], deck: string, signal?: AbortSignal) =>
    streamSSE('/photo/generate', { pairs, deck }, signal),

  clozeTranscribe: async (blob: Blob): Promise<PhotoClozeTranscribeResponse> => {
    const formData = new FormData();
    formData.append('image', blob, 'photo.jpg');
    const response = await fetch(`${API_BASE}/photo/cloze-transcribe`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  },

  clozeExtract: (transcription: string, deck?: string) =>
    fetchJson<PhotoClozeExtractResponse>('/photo/cloze-extract', {
      method: 'POST',
      body: JSON.stringify({ transcription, deck }),
    }),

  listExamples: () =>
    fetchJson<{ examples: string[] }>('/photo/examples').catch(() => ({
      examples: [] as string[],
    })),

  getExample: (filename: string) =>
    fetchJson<{ imageBase64: string; mimeType: string; filename: string }>(
      `/photo/examples/${encodeURIComponent(filename)}`
    ),
};

// PDF API
export const pdfApi = {
  scout: (req: PdfScoutRequest) =>
    fetchJson<PdfScoutResponse>('/pdf/scout', { method: 'POST', body: JSON.stringify(req) }),

  extract: (req: PdfExtractRequest, signal?: AbortSignal) => streamSSE('/pdf/extract', req, signal),
};
