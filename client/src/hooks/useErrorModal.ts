import { create } from 'zustand';

interface AppError {
  title: string;
  message: string;
  details?: string;
  timestamp: string;
}

interface ErrorModalState {
  error: AppError | null;
  showError: (title: string, message: string, details?: string) => void;
  clearError: () => void;
}

export const useErrorModal = create<ErrorModalState>((set) => ({
  error: null,
  showError: (title, message, details) =>
    set({ error: { title, message, details, timestamp: new Date().toISOString() } }),
  clearError: () => set({ error: null }),
}));
