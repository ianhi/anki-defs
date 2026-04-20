import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ankiApi, languageApi } from '@/lib/api';
import type { CreateNoteRequest } from 'shared';

export function useAnkiStatus() {
  return useQuery({
    queryKey: ['anki', 'status'],
    queryFn: ankiApi.getStatus,
    refetchInterval: 10000, // Check every 10 seconds
  });
}

export function useDecks() {
  return useQuery({
    queryKey: ['anki', 'decks'],
    queryFn: ankiApi.getDecks,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: CreateNoteRequest) => ankiApi.createNote(note),
    onSuccess: () => {
      // Invalidate search queries to reflect new card
      queryClient.invalidateQueries({ queryKey: ['anki', 'notes', 'search'] });
    },
  });
}

export function useAnkiSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ankiApi.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anki'] });
    },
  });
}

export function useLanguages() {
  return useQuery({
    queryKey: ['languages'],
    queryFn: languageApi.getLanguages,
    staleTime: Infinity, // Language list doesn't change at runtime
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: number) => ankiApi.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anki', 'notes', 'search'] });
    },
  });
}

export function useNoteTypeHealth() {
  const { data: connected } = useAnkiStatus();

  return useQuery({
    queryKey: ['anki', 'health'],
    queryFn: ankiApi.checkHealth,
    enabled: !!connected,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelName: string) => ankiApi.updateTemplates(modelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anki', 'health'] });
    },
  });
}
