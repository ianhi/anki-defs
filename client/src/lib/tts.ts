/**
 * Text-to-speech using the browser's SpeechSynthesis API.
 * Uses device-installed voices (e.g. Google Bangla on Android).
 */
/* global speechSynthesis, SpeechSynthesisVoice, SpeechSynthesisUtterance */

import { createLogger } from './logger';

const log = createLogger('TTS');

let banglaVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

/** Normalize lang code — browsers use both bn-IN and bn_IN. */
function normLang(lang: string): string {
  return lang.replace('_', '-').toLowerCase();
}

/** Find the best available voice for a language. Prefers regional variants. */
function findVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const target = normLang(lang);
  // Prefer exact regional match (e.g. bn-in)
  const exact = voices.find((v) => normLang(v.lang) === target);
  if (exact) return exact;
  // Then any voice starting with the language prefix (bn)
  const prefix = target.split('-')[0]!;
  const prefixMatch = voices.find((v) => normLang(v.lang).startsWith(prefix));
  if (prefixMatch) return prefixMatch;
  // Fallback: check voice name
  const nameMatch = voices.find(
    (v) => v.name.toLowerCase().includes('bangla') || v.name.toLowerCase().includes('bengali')
  );
  return nameMatch ?? null;
}

function ensureVoice(): SpeechSynthesisVoice | null {
  if (!voicesLoaded) {
    banglaVoice = findVoice('bn-IN');
    voicesLoaded = true;
    if (banglaVoice) {
      log.info('TTS voice: %s (%s)', banglaVoice.name, banglaVoice.lang);
    } else {
      log.warn('No Bangla TTS voice found');
    }
  }
  return banglaVoice;
}

// Voices may load asynchronously
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', () => {
    voicesLoaded = false;
    ensureVoice();
    // Debug: log all Bangla-related voices
    const allVoices = speechSynthesis.getVoices();
    const bnVoices = allVoices.filter(
      (v) =>
        v.lang.toLowerCase().includes('bn') ||
        v.name.toLowerCase().includes('bangla') ||
        v.name.toLowerCase().includes('bengali')
    );
    log.info(
      'Available Bangla voices: %s',
      bnVoices.map((v) => `${v.name} [${v.lang}]`).join(', ')
    );
  });
}

/** Strip markup (**, <b>, etc.) from text before speaking. */
function stripMarkup(text: string): string {
  return text.replace(/\*\*/g, '').replace(/<[^>]*>/g, '');
}

/** Speak text using the device's TTS engine. Returns true if speech started. */
export function speak(text: string, lang = 'bn'): boolean {
  if (typeof speechSynthesis === 'undefined') return false;

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  const voice = lang === 'bn' ? ensureVoice() : findVoice(lang);
  const utterance = new SpeechSynthesisUtterance(stripMarkup(text));
  utterance.lang = voice?.lang ?? lang;
  if (voice) utterance.voice = voice;
  utterance.rate = 1.0;

  speechSynthesis.speak(utterance);
  return true;
}

/** Check if TTS is available for a language. */
export function hasTTS(lang = 'bn'): boolean {
  if (typeof speechSynthesis === 'undefined') return false;
  return lang === 'bn' ? ensureVoice() !== null : findVoice(lang) !== null;
}

/** Get all available voices for a language prefix (e.g. 'bn'). */
export function getVoicesForLanguage(langPrefix = 'bn'): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis
    .getVoices()
    .filter(
      (v) =>
        normLang(v.lang).startsWith(langPrefix) ||
        v.name.toLowerCase().includes('bangla') ||
        v.name.toLowerCase().includes('bengali')
    );
}

/** Set a specific voice by name. */
export function setVoiceByName(name: string): void {
  if (typeof speechSynthesis === 'undefined') return;
  const voice = speechSynthesis.getVoices().find((v) => v.name === name);
  if (voice) {
    banglaVoice = voice;
    voicesLoaded = true;
    log.info('TTS voice set to: %s (%s)', voice.name, voice.lang);
  }
}

/** Get the current voice name. */
export function getCurrentVoiceName(): string | null {
  const voice = ensureVoice();
  return voice?.name ?? null;
}
