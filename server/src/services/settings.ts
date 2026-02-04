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

export async function getSettings(): Promise<Settings> {
  try {
    await ensureConfigDir();
    if (!existsSync(SETTINGS_FILE)) {
      await saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const data = await readFile(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    console.error('Error reading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  await ensureConfigDir();
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2));
  return updated;
}
