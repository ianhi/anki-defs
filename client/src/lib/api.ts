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
} from 'shared';

const API_BASE = '/api';

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

// Anki API
export const ankiApi = {
  getDecks: () => fetchJson<{ decks: string[] }>('/anki/decks').then((r) => r.decks),
  getModels: () => fetchJson<{ models: string[] }>('/anki/models').then((r) => r.models),
  getModelFields: (modelName: string) =>
    fetchJson<{ fields: string[] }>(`/anki/models/${encodeURIComponent(modelName)}/fields`).then(
      (r) => r.fields
    ),
  search: (query: string) =>
    fetchJson<{ notes: AnkiNote[] }>('/anki/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }).then((r) => r.notes),
  createNote: (note: CreateNoteRequest) =>
    fetchJson<{ noteId: number }>('/anki/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    }).then((r) => r.noteId),
  getNote: (id: number) => fetchJson<{ note: AnkiNote }>(`/anki/notes/${id}`).then((r) => r.note),
  deleteNote: (id: number) =>
    fetchJson<{ success: boolean }>(`/anki/notes/${id}`, { method: 'DELETE' }),
  getStatus: () => fetchJson<{ connected: boolean }>('/anki/status').then((r) => r.connected),
  sync: () => fetchJson<{ success: boolean }>('/anki/sync', { method: 'POST' }),
};

// Chat API
export const chatApi = {
  relemmatize: (request: RelemmatizeRequest) =>
    fetchJson<RelemmatizeResponse>('/chat/relemmatize', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  stream: async function* (
    message: string,
    deck?: string,
    highlightedWords?: string[],
    userContext?: string
  ): AsyncGenerator<SSEEvent, void, unknown> {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newMessage: message, deck, highlightedWords, userContext }),
    });

    if (!response.ok) {
      throw new Error('Failed to start chat stream');
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
          if (data === '[DONE]') {
            return;
          }
          try {
            yield JSON.parse(data) as SSEEvent;
          } catch {
            console.warn('[API] Failed to parse SSE event:', data);
          }
        }
      }
    }
  },
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
