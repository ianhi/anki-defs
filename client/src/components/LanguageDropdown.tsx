import type { ChangeEvent } from 'react';
import type { CustomLanguage } from 'shared';
import { Select } from './ui/Select';

export const CUSTOM_LANGUAGE_SENTINEL = '__custom__';

export function buildLanguageOptions(
  languages: Array<{ code: string; name: string; nativeName: string }> | undefined,
  customLanguages: CustomLanguage[]
) {
  const options: Array<{ code: string; label: string }> = [];

  if (languages) {
    for (const lang of languages) {
      options.push({
        code: lang.code,
        label: lang.nativeName ? `${lang.name} (${lang.nativeName})` : lang.name,
      });
    }
  }

  const serverCodes = new Set(languages?.map((l) => l.code) ?? []);
  for (const cl of customLanguages) {
    if (!serverCodes.has(cl.code)) {
      options.push({ code: cl.code, label: cl.name });
    }
  }

  return options;
}

interface LanguageDropdownProps {
  id?: string;
  value: string;
  languages: Array<{ code: string; name: string; nativeName: string }> | undefined;
  customLanguages: CustomLanguage[];
  onChange: (code: string) => void;
  onCustom?: () => void;
  className?: string;
  placeholder?: string;
}

export function LanguageDropdown({
  id,
  value,
  languages,
  customLanguages,
  onChange,
  onCustom,
  className,
  placeholder = '-- select --',
}: LanguageDropdownProps) {
  const options = buildLanguageOptions(languages, customLanguages);
  return (
    <Select
      id={id}
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === CUSTOM_LANGUAGE_SENTINEL) {
          onCustom?.();
        } else {
          onChange(e.target.value);
        }
      }}
      className={className}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.code} value={opt.code}>
          {opt.label}
        </option>
      ))}
      {onCustom && <option value={CUSTOM_LANGUAGE_SENTINEL}>Custom...</option>}
    </Select>
  );
}
