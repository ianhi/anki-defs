import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ankiApi } from '@/lib/api';
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

export function useModels() {
  return useQuery({
    queryKey: ['anki', 'models'],
    queryFn: ankiApi.getModels,
  });
}

export function useModelFields(modelName: string | undefined) {
  return useQuery({
    queryKey: ['anki', 'models', modelName, 'fields'],
    queryFn: () => (modelName ? ankiApi.getModelFields(modelName) : Promise.resolve([])),
    enabled: !!modelName,
  });
}

export function useSearchNotes(query: string) {
  return useQuery({
    queryKey: ['anki', 'notes', 'search', query],
    queryFn: () => ankiApi.search(query),
    enabled: query.length > 0,
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

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: number) => ankiApi.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anki', 'notes', 'search'] });
    },
  });
}

export function useNote(noteId: number | undefined) {
  return useQuery({
    queryKey: ['anki', 'notes', noteId],
    queryFn: () => (noteId ? ankiApi.getNote(noteId) : Promise.resolve(null)),
    enabled: !!noteId,
  });
}
