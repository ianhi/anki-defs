# anki-defs Anki Add-on

An Anki Desktop add-on that runs anki-defs directly inside Anki. Instead of running a separate web server and connecting through AnkiConnect, the add-on provides its own HTTP server inside Anki's process. It serves the same React frontend and has direct access to your Anki collection -- no extra setup, no external dependencies.

## Install

### From .ankiaddon file

1. Download the latest `.ankiaddon` file from the releases page
2. In Anki, go to **Tools > Add-ons > Install from file...**
3. Select the downloaded `.ankiaddon` file
4. Restart Anki

### Manual install (development)

1. Build the React frontend from the repository root:

   ```bash
   npm install
   npm run build
   ```

2. Copy the add-on into Anki's add-ons folder:

   ```bash
   # Linux
   cp -r anki-addon ~/.local/share/Anki2/addons21/anki_defs

   # macOS
   cp -r anki-addon ~/Library/Application\ Support/Anki2/addons21/anki_defs

   # Windows
   xcopy anki-addon %APPDATA%\Anki2\addons21\anki_defs /E /I
   ```

3. Copy the built frontend into the add-on:

   ```bash
   cp -r client/dist/* ~/.local/share/Anki2/addons21/anki_defs/web/
   ```

4. Restart Anki

## First-time setup

1. **Open anki-defs.** After restarting Anki, go to **Tools > anki-defs**. Your browser opens to the anki-defs interface.

2. **Add an API key.** Click the gear icon to open Settings and paste an API key for your chosen provider (Gemini, Claude, or OpenRouter). See the [main usage guide](../docs/USAGE.md#1-get-an-api-key) for details on getting a key.

3. **Select your deck.** The deck dropdown pulls directly from your Anki collection. Pick the deck where you want new cards to go.

4. **Start using it.** Type a Bangla word or sentence and press Enter. Everything else works the same as the web version -- see [docs/USAGE.md](../docs/USAGE.md) for the full usage guide.

## How it differs from the web version

| | Web version | Anki add-on |
|---|---|---|
| **Anki connection** | Requires AnkiConnect add-on | Direct collection access (built in) |
| **Setup** | Clone repo, npm install, run server | Install one .ankiaddon file |
| **Runs where** | In your terminal + browser | Inside Anki Desktop |
| **Dependencies** | Node.js 18+ | None (Python stdlib only) |
| **AnkiConnect URL setting** | Shown in Settings | Hidden (not needed) |
| **Sync button** | Triggers AnkiConnect sync | Triggers native Anki sync |
| **Connection status** | Can disconnect if Anki closes | Always connected |

The add-on serves the same React frontend at `http://localhost:28735`. The "anki-defs" menu item just opens that URL in your default browser.

## Configuration

Settings are managed through the standard Anki add-on config system:

- **In the app**: Click the gear icon to change settings (AI provider, API keys, deck, note type, field mapping)
- **In Anki**: Tools > Add-ons > select "anki-defs" > Config -- shows the raw JSON config

Settings persist across add-on updates in Anki's `meta.json` file. Session data (cards added, chat history) is stored in `user_files/session.db`, which also survives updates.

## Requirements

- **Anki 25.02 or later** (Qt6 only)
- Python 3.9+ (ships with Anki)
- An API key for at least one AI provider

## Known limitations

- **Beta status.** The add-on backend is implemented but packaging (`.ankiaddon` build) is not yet automated. Manual installation is required for now.
- **Port conflict.** The add-on listens on port 28735. If another program uses that port, the server will fail to start.
- **No hot reload.** Changing add-on code requires restarting Anki.
- **Main thread polling.** The HTTP server uses a QTimer polling loop on the main thread (same pattern as AnkiConnect). AI streaming runs in background threads to avoid blocking the UI, but heavy Anki operations may briefly pause the server.
- **Prompt templates.** Prompts are currently inlined in the Python code rather than shared with the Node.js server. This means they may drift out of sync.
