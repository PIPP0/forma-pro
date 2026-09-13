import { useSyncExternalStore } from 'react';

export type Tone = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

let toasts: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function notify(message: string, tone: Tone = 'info') {
  const id = next++;
  toasts = [...toasts, { id, message, tone }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3800);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
