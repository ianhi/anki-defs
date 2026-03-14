import { create } from 'zustand';

interface ErrorModalState {
  error: { title: string; message: string; details?: string } | null;
  showError: (title: string, message: string, details?: string) => void;
  clearError: () => void;
}

export const useErrorModal = create<ErrorModalState>((set) => ({
  error: null,
  showError: (title, message, details) => set({ error: { title, message, details } }),
  clearError: () => set({ error: null }),
}));
