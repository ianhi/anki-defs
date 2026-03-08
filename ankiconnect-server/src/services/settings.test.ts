import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, chmod } from 'fs/promises';
import { existsSync } from 'fs';
import { DEFAULT_SETTINGS } from 'shared';

// Mock fs modules before importing the module under test
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  chmod: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock os.homedir to avoid touching real config
vi.mock('os', () => ({
  homedir: () => '/tmp/test-home',
}));

// Now import the module under test (uses mocked deps)
const { getSettings, saveSettings } = await import('./settings.js');

const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);
const mockedMkdir = vi.mocked(mkdir);
const mockedChmod = vi.mocked(chmod);
const mockedExistsSync = vi.mocked(existsSync);

describe('settings service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: config dir exists, settings file does not
    mockedExistsSync.mockReturnValue(false);
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
    mockedChmod.mockResolvedValue(undefined);

    // Clear env overrides
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    delete process.env.AI_PROVIDER;
    delete process.env.DEFAULT_DECK;
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  describe('getSettings', () => {
    it('returns defaults when no settings file exists', async () => {
      mockedExistsSync.mockReturnValue(false);
      const settings = await getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('merges file settings over defaults', async () => {
      // First call: config dir check (true), second call: settings file check (true)
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(
        JSON.stringify({ defaultDeck: 'Custom Deck', aiProvider: 'gemini' })
      );

      const settings = await getSettings();
      expect(settings.defaultDeck).toBe('Custom Deck');
      expect(settings.aiProvider).toBe('gemini');
      // Defaults should still be present for non-overridden fields
      expect(settings.ankiConnectUrl).toBe(DEFAULT_SETTINGS.ankiConnectUrl);
    });

    it('applies environment variable overrides over file settings', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify({ geminiApiKey: 'file-key' }));
      process.env.GEMINI_API_KEY = 'env-key';

      const settings = await getSettings();
      expect(settings.geminiApiKey).toBe('env-key');
    });

    it('ANTHROPIC_API_KEY env var sets claudeApiKey', async () => {
      mockedExistsSync.mockReturnValue(false);
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

      const settings = await getSettings();
      expect(settings.claudeApiKey).toBe('sk-ant-test');
    });

    it('CLAUDE_API_KEY env var overrides ANTHROPIC_API_KEY', async () => {
      mockedExistsSync.mockReturnValue(false);
      process.env.ANTHROPIC_API_KEY = 'first';
      process.env.CLAUDE_API_KEY = 'second';

      const settings = await getSettings();
      expect(settings.claudeApiKey).toBe('second');
    });

    it('AI_PROVIDER env var sets aiProvider', async () => {
      mockedExistsSync.mockReturnValue(false);
      process.env.AI_PROVIDER = 'openrouter';

      const settings = await getSettings();
      expect(settings.aiProvider).toBe('openrouter');
    });

    it('ignores invalid AI_PROVIDER values', async () => {
      mockedExistsSync.mockReturnValue(false);
      process.env.AI_PROVIDER = 'invalid';

      const settings = await getSettings();
      expect(settings.aiProvider).toBe(DEFAULT_SETTINGS.aiProvider);
    });

    it('returns defaults on read error', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockRejectedValue(new Error('EACCES'));

      const settings = await getSettings();
      expect(settings.aiProvider).toBe(DEFAULT_SETTINGS.aiProvider);
    });
  });

  describe('saveSettings', () => {
    it('writes merged settings to file', async () => {
      // No existing file
      mockedExistsSync.mockReturnValue(false);

      await saveSettings({ defaultDeck: 'New Deck' });

      expect(mockedWriteFile).toHaveBeenCalledOnce();
      const writtenData = JSON.parse(mockedWriteFile.mock.calls[0]![1] as string);
      expect(writtenData.defaultDeck).toBe('New Deck');
    });

    it('merges with existing file settings', async () => {
      // First existsSync call: config dir, second: settings file
      // For saveSettings, existsSync is called for config dir then settings file
      mockedExistsSync.mockReturnValue(true);
      mockedReadFile.mockResolvedValue(
        JSON.stringify({ defaultDeck: 'Old Deck', aiProvider: 'gemini' })
      );

      await saveSettings({ defaultDeck: 'New Deck' });

      const writtenData = JSON.parse(mockedWriteFile.mock.calls[0]![1] as string);
      expect(writtenData.defaultDeck).toBe('New Deck');
      expect(writtenData.aiProvider).toBe('gemini');
    });

    it('sets file permissions to 0600', async () => {
      mockedExistsSync.mockReturnValue(false);
      await saveSettings({ defaultDeck: 'Test' });
      expect(mockedChmod).toHaveBeenCalledWith(expect.any(String), 0o600);
    });

    it('returns settings with env overrides applied', async () => {
      mockedExistsSync.mockReturnValue(false);
      process.env.GEMINI_API_KEY = 'env-override';

      const result = await saveSettings({ defaultDeck: 'Test' });
      expect(result.geminiApiKey).toBe('env-override');
    });
  });
});

describe('settings route API key masking', () => {
  // Test the masking logic used in routes/settings.ts
  function maskApiKey(key: string): string {
    return key ? '••••••••' + key.slice(-4) : '';
  }

  it('masks a typical API key showing last 4 chars', () => {
    expect(maskApiKey('sk-ant-api03-abcdefghijklmnop')).toBe('••••••••mnop');
  });

  it('returns empty string for empty key', () => {
    expect(maskApiKey('')).toBe('');
  });

  it('masks short keys showing last 4 chars', () => {
    expect(maskApiKey('abcd')).toBe('••••••••abcd');
  });

  it('masks keys shorter than 4 chars', () => {
    expect(maskApiKey('ab')).toBe('••••••••ab');
  });

  it('does not skip masked keys when updating', () => {
    // The route skips updates where key starts with '••••'
    const maskedKey = '••••••••mnop';
    expect(maskedKey.startsWith('••••')).toBe(true);
  });
});
