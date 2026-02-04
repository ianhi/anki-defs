import type {
  Settings,
  AnkiNote,
  CreateNoteRequest,
  DefineRequest,
  AnalyzeRequest,
  WordAnalysis,
  SentenceAnalysis,
  SSEEvent,
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
  getStatus: () => fetchJson<{ connected: boolean }>('/anki/status').then((r) => r.connected),
};

// Chat API
export const chatApi = {
  define: (request: DefineRequest) =>
    fetchJson<WordAnalysis>('/chat/define', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  analyze: (request: AnalyzeRequest) =>
    fetchJson<SentenceAnalysis>('/chat/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  stream: async function* (
    message: string,
    deck?: string
  ): AsyncGenerator<SSEEvent, void, unknown> {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newMessage: message, deck }),
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
            // Ignore parse errors
          }
        }
      }
    }
  },
};
