import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Settings } from 'shared';
import { DEFAULT_SETTINGS } from 'shared';

const CONFIG_DIR = join(homedir(), '.config', 'bangla-anki');
const SETTINGS_FILE = join(CONFIG_DIR, 'settings.json');

async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

// Environment variable keys override file-based settings
function getEnvOverrides(): Partial<Settings> {
  const overrides: Partial<Settings> = {};

  if (process.env.ANTHROPIC_API_KEY) {
    overrides.claudeApiKey = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.CLAUDE_API_KEY) {
    overrides.claudeApiKey = process.env.CLAUDE_API_KEY;
  }
  if (process.env.GEMINI_API_KEY) {
    overrides.geminiApiKey = process.env.GEMINI_API_KEY;
  }
  if (process.env.GOOGLE_API_KEY) {
    overrides.geminiApiKey = process.env.GOOGLE_API_KEY;
  }
  if (process.env.AI_PROVIDER) {
    const provider = process.env.AI_PROVIDER.toLowerCase();
    if (provider === 'claude' || provider === 'gemini') {
      overrides.aiProvider = provider;
    }
  }
  if (process.env.DEFAULT_DECK) {
    overrides.defaultDeck = process.env.DEFAULT_DECK;
  }

  return overrides;
}

export async function getSettings(): Promise<Settings> {
  try {
    await ensureConfigDir();

    let fileSettings: Partial<Settings> = {};
    if (existsSync(SETTINGS_FILE)) {
      const data = await readFile(SETTINGS_FILE, 'utf-8');
      fileSettings = JSON.parse(data);
    }

    // Merge: defaults < file settings < env overrides
    const envOverrides = getEnvOverrides();
    return { ...DEFAULT_SETTINGS, ...fileSettings, ...envOverrides };
  } catch (error) {
    console.error('Error reading settings:', error);
    return { ...DEFAULT_SETTINGS, ...getEnvOverrides() };
  }
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  await ensureConfigDir();

  // Get current file settings (not including env overrides)
  let fileSettings: Partial<Settings> = {};
  if (existsSync(SETTINGS_FILE)) {
    try {
      const data = await readFile(SETTINGS_FILE, 'utf-8');
      fileSettings = JSON.parse(data);
    } catch {
      // Ignore parse errors
    }
  }

  // Update file settings
  const updated = { ...fileSettings, ...settings };
  await writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2));

  // Return with env overrides applied
  return { ...DEFAULT_SETTINGS, ...updated, ...getEnvOverrides() };
}
