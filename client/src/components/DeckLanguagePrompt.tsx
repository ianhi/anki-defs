import { useState } from 'react';
import { useLanguages } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { LanguageDropdown } from './LanguageDropdown';

interface DeckLanguagePromptProps {
  deck: string;
  initialLanguage: string;
  onConfirm: (languageCode: string) => void;
  onCancel: () => void;
}

export function DeckLanguagePrompt({
  deck,
  initialLanguage,
  onConfirm,
  onCancel,
}: DeckLanguagePromptProps) {
  const { data: languages } = useLanguages();
  const { settings } = useSettingsStore();
  const [language, setLanguage] = useState(initialLanguage);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-sm border border-border flex flex-col">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-semibold">What language is this deck?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cards added to <span className="font-medium text-foreground">{deck}</span> will be
            generated in the language you pick.
          </p>
        </div>
        <div className="px-6 py-4 space-y-2">
          <Label htmlFor="deck-lang-prompt">Language</Label>
          <LanguageDropdown
            id="deck-lang-prompt"
            value={language}
            languages={languages}
            customLanguages={settings.customLanguages}
            onChange={setLanguage}
          />
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(language)} disabled={!language}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
