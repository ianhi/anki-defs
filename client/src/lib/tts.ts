/**
 * Browser SpeechSynthesis wrapper.
 *
 * Voice resolution is per-language: the user can pin a preferred voice for
 * each language code, otherwise we look up the best available system voice.
 * Pinned voices persist in localStorage.
 */
/* global speechSynthesis, SpeechSynthesisVoice, SpeechSynthesisUtterance */

import { createLogger } from './logger';

const log = createLogger('TTS');

const VOICE_OVERRIDE_PREFIX = 'tts-voice-';

const resolvedVoiceCache = new Map<string, SpeechSynthesisVoice | null>();

function normLang(lang: string): string {
  return lang.replace('_', '-').toLowerCase();
}

function loadOverride(lang: string): string | null {
  try {
    return localStorage.getItem(VOICE_OVERRIDE_PREFIX + normLang(lang));
  } catch {
    return null;
  }
}

function saveOverride(lang: string, voiceName: string): void {
  try {
    localStorage.setItem(VOICE_OVERRIDE_PREFIX + normLang(lang), voiceName);
  } catch {
    /* ignore quota / privacy-mode failures */
  }
}

function findVoiceForLang(lang: string): SpeechSynthesisVoice | null {
  const target = normLang(lang);
  const voices = speechSynthesis.getVoices();

  const overrideName = loadOverride(target);
  if (overrideName) {
    const pinned = voices.find((v) => v.name === overrideName);
    if (pinned) return pinned;
  }

  const exact = voices.find((v) => normLang(v.lang) === target);
  if (exact) return exact;

  const prefix = target.split('-')[0]!;
  return voices.find((v) => normLang(v.lang).startsWith(prefix + '-') || normLang(v.lang) === prefix) ?? null;
}

function resolveVoice(lang: string): SpeechSynthesisVoice | null {
  const key = normLang(lang);
  if (resolvedVoiceCache.has(key)) return resolvedVoiceCache.get(key) ?? null;
  const voice = findVoiceForLang(lang);
  resolvedVoiceCache.set(key, voice);
  if (voice) {
    log.info('TTS [%s]: %s (%s)', lang, voice.name, voice.lang);
  } else {
    log.warn('No TTS voice found for %s', lang);
  }
  return voice;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', () => {
    resolvedVoiceCache.clear();
  });
}

function stripMarkup(text: string): string {
  return text.replace(/\*\*/g, '').replace(/<[^>]*>/g, '');
}

/** Speak text in the given language. Returns true if speech started. */
export function speak(text: string, lang: string): boolean {
  if (typeof speechSynthesis === 'undefined') return false;

  speechSynthesis.cancel();

  const voice = resolveVoice(lang);
  const utterance = new SpeechSynthesisUtterance(stripMarkup(text));
  utterance.lang = voice?.lang ?? lang;
  if (voice) utterance.voice = voice;
  utterance.rate = 1.0;

  speechSynthesis.speak(utterance);
  return true;
}

/** Whether the SpeechSynthesis API itself is available. */
export function hasTTS(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

/** All voices that match the given language (exact or prefix). */
export function getVoicesForLanguage(lang: string): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  const target = normLang(lang);
  const prefix = target.split('-')[0]!;
  return speechSynthesis
    .getVoices()
    .filter((v) => {
      const vl = normLang(v.lang);
      return vl === target || vl.startsWith(prefix + '-') || vl === prefix;
    });
}

/** Pin a voice for a language. */
export function setVoiceByName(lang: string, name: string): void {
  if (typeof speechSynthesis === 'undefined') return;
  saveOverride(lang, name);
  resolvedVoiceCache.delete(normLang(lang));
  const voice = resolveVoice(lang);
  if (voice) log.info('TTS voice for %s set to: %s (%s)', lang, voice.name, voice.lang);
}

/** Currently resolved voice name for a language. */
export function getCurrentVoiceName(lang: string): string | null {
  return resolveVoice(lang)?.name ?? null;
}
