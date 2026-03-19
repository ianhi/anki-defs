import { Button } from './ui/Button';
import { Loader2 } from 'lucide-react';

interface KeyringWarningProps {
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function KeyringWarning({ onConfirm, onCancel, saving }: KeyringWarningProps) {
  return (
    <div className="p-3 rounded border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950 space-y-2">
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        Store API key in local config?
      </p>
      <p className="text-xs text-yellow-700 dark:text-yellow-300">
        No system keyring (GNOME Keyring, macOS Keychain) was detected, so your API key will be
        saved in a local config file. The file is only readable by your OS user account, so this is
        safe for personal machines. Avoid this on shared computers.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'OK, save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
