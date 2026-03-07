# Anki Desktop Add-on: Backend #3 Implementation Plan

## Status: IMPLEMENTED (Phase 1-5 complete, Phase 6 pending)

### What's Done
- Entry point with menu item and profile hooks
- Non-blocking socket HTTP server (QTimer-polled, AnkiConnect pattern)
- URL router with path parameter matching
- Static file serving with SPA fallback
- All `/api/anki/*` endpoints (direct collection access)
- All `/api/chat/*` endpoints (streaming SSE + non-streaming)
- Claude, Gemini, OpenRouter providers (stdlib urllib.request only)
- Card extraction pipeline (Gemini structured output)
- Settings via Anki addon config system
- Session persistence (SQLite in user_files/)
- `/api/platform`, `/api/health`, `/api/settings`, `/api/session/*`
- Zero vendored dependencies (all stdlib)

### What's Remaining
- Phase 6: Build script to copy client/dist/ to web/, package as .ankiaddon
- Phase 0: Prompt template extraction to shared/prompts/ (currently inlined)

## Concept

Package the React frontend + a Python backend as an Anki Desktop add-on. The add-on
runs a local HTTP server inside Anki's Python process, with direct access to Anki's
collection database -- no AnkiConnect needed. Users install one add-on and get the
full anki-defs experience natively inside Anki Desktop.

## Anki Add-on Mechanics

### How Add-ons Load

- Add-ons are Python packages placed in `~/.local/share/Anki2/addons21/<numeric_id>/`
  (Linux), `~/Library/Application Support/Anki2/addons21/<id>/` (macOS),
  `%APPDATA%\Anki2\addons21\<id>\` (Windows)
- Anki executes each add-on's `__init__.py` at startup, inside the main Python process
- Add-ons have full access to the `anki` (pylib) and `aqt` (Qt UI) modules
- The numeric `<id>` is assigned when uploading to AnkiWeb; during development, any
  name works as the folder name

### Python Environment

- Anki ships with **Python 3.13** (as of 25.07+), minimum supported: **Python 3.9**
- Qt6 only (Qt5 builds dropped in 25.02); add-ons should import from `aqt.qt`
- Standard library modules mostly available from Anki 2.1.50+
- Third-party packages must be vendored (bundled) with the add-on

### Target Versions

| Anki Version | Python | Qt  | Notes                           |
| ------------ | ------ | --- | ------------------------------- |
| 25.02+       | 3.9+   | Qt6 | Qt5 dropped, our minimum        |
| 25.07+       | 3.13   | Qt6 | New launcher, ships Python 3.13 |
| 25.09+       | 3.13   | Qt6 | Latest stable                   |

**Minimum target: Anki 25.02** (Qt6-only era). Code should work with Python 3.9+.

### Add-on Configuration

- `config.json` in add-on root: default settings (loaded by Anki's addon manager)
- `meta.json`: user-modified settings (managed by Anki, overrides config.json)
- `config.md`: description shown in Anki's config dialog
- `user_files/`: persistent directory that survives add-on updates
- Access in code: `mw.addonManager.getConfig(__name__)`
- Save in code: `mw.addonManager.writeConfig(__name__, config)`

## Architecture

```
Anki Desktop process (Python 3.9+ / PyQt6)
|
+-- Add-on loaded at startup (__init__.py)
|   |
|   +-- Registers "anki-defs" menu item in Tools menu
|   +-- Starts HTTP server (non-blocking, QTimer-polled)
|   |   |
|   |   +-- Serves React frontend from bundled dist/ assets
|   |   +-- API handlers bridge to Anki collection:
|   |   |   +-- /api/anki/decks    -> col.decks.all_names_and_ids()
|   |   |   +-- /api/anki/models   -> col.models.all_names_and_ids()
|   |   |   +-- /api/anki/notes    -> col.add_note()
|   |   |   +-- /api/anki/search   -> col.find_notes()
|   |   |   +-- /api/chat/*        -> AI API calls (urllib/requests)
|   |   |   +-- /api/settings      -> addon config read/write
|   |   |   +-- /api/session       -> SQLite session store
|   |   |
|   |   +-- SSE streaming for /api/chat/stream
|   |
|   +-- on_profile_loaded hook: initialize collection access
|   +-- on_profile_will_close hook: stop server, cleanup
|
+-- User clicks menu item -> opens browser to http://localhost:PORT
```

## Server Architecture: Threading Model

### The Problem

Anki's collection database (SQLite) is **not thread-safe**. The `mw.col` object can
only be accessed from Qt's main thread. But an HTTP server needs to handle requests
from its own thread.

### Solution: AnkiConnect's QTimer Polling Pattern (Recommended)

AnkiConnect solves this by **never using threads for request processing**:

1. Create a **non-blocking TCP socket** server (`socket.socket` with `setblocking(False)`)
2. Use `select.select()` with timeout=0 to poll for ready connections
3. Drive the polling loop with a **QTimer** on the main thread
4. All request handling runs on the main thread -- collection access is safe

```python
class WebServer:
    def __init__(self, handler):
        self.handler = handler
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.setblocking(False)
        self.clients = []

    def listen(self, port):
        self.sock.bind(('127.0.0.1', port))
        self.sock.listen(5)

    def advance(self):
        """Called by QTimer on main thread -- process ready connections."""
        # Accept new connections
        # Read complete requests from client buffers
        # Dispatch to handler (runs on main thread = collection safe)
        # Write responses back
```

**Timer setup in `__init__.py`:**

```python
from aqt.qt import QTimer

self.timer = QTimer()
self.timer.timeout.connect(self.server.advance)
self.timer.start(POLL_INTERVAL_MS)  # AnkiConnect uses 25ms
```

### Why Not Threaded Flask/Bottle?

- Flask/Bottle run in their own thread, requiring `mw.taskman.run_on_main()` bridges
  for every collection access
- `run_on_main()` with `Future` objects adds complexity and latency
- The QTimer pattern is proven (AnkiConnect has used it for years)
- Pure socket approach = zero vendored dependencies for the server itself

### SSE Streaming Consideration

The QTimer polling model complicates SSE (Server-Sent Events) for `/api/chat/stream`:

- AI API calls are **network I/O** (not collection access) -- safe to run off main thread
- Strategy: handle SSE connections specially:
  1. Parse the SSE request on the main thread
  2. Spawn a **daemon thread** for the AI API call + streaming
  3. The thread writes SSE chunks directly to the client socket
  4. Any collection access needed mid-stream (duplicate checks) uses
     `mw.taskman.run_on_main()` with a `Future` to bounce back to main thread

```python
import concurrent.futures

def handle_stream_request(client_socket, request_data):
    """Called on main thread from QTimer poll."""
    # Parse request, prepare context
    settings = get_addon_config()
    deck = request_data.get('deck', settings['defaultDeck'])

    # Spawn thread for AI streaming (network I/O only)
    thread = threading.Thread(
        target=stream_ai_response,
        args=(client_socket, request_data, deck),
        daemon=True
    )
    thread.start()

def stream_ai_response(sock, data, deck):
    """Runs in daemon thread -- network I/O only."""
    # Stream AI response, write SSE chunks to socket
    # For collection access (duplicate check):
    future = concurrent.futures.Future()
    mw.taskman.run_on_main(lambda: future.set_result(
        check_duplicates(data['words'], deck)
    ))
    anki_results = future.result(timeout=5)
```

## Anki Python API: Exact Calls Per Endpoint

### GET /api/anki/decks -- List Deck Names

```python
def get_decks():
    deck_list = mw.col.decks.all_names_and_ids()
    return [d.name for d in deck_list]
```

### GET /api/anki/models -- List Note Type Names

```python
def get_models():
    model_list = mw.col.models.all_names_and_ids()
    return [m.name for m in model_list]
```

### GET /api/anki/models/:name/fields -- Get Fields for a Note Type

```python
def get_model_fields(model_name):
    model = mw.col.models.by_name(model_name)
    if not model:
        raise ValueError(f"Model not found: {model_name}")
    field_map = mw.col.models.field_map(model)
    # field_map: {'FieldName': (ordinal, FieldDict), ...}
    return sorted(field_map.keys(), key=lambda f: field_map[f][0])
```

### POST /api/anki/search -- Search Notes

```python
def search_notes(query):
    note_ids = mw.col.find_notes(query)
    results = []
    for nid in note_ids:
        note = mw.col.get_note(nid)
        nt = note.note_type()
        field_map = mw.col.models.field_map(nt)
        fields = {}
        for name, (ord, _) in field_map.items():
            fields[name] = {"value": note.fields[ord], "order": ord}
        results.append({
            "noteId": note.id,
            "modelName": nt["name"],
            "tags": list(note.tags),
            "fields": fields,
        })
    return results
```

### POST /api/anki/notes -- Create a Note

```python
def create_note(deck_name, model_name, fields, tags=None):
    model = mw.col.models.by_name(model_name)
    if not model:
        raise ValueError(f"Model not found: {model_name}")

    deck = mw.col.decks.by_name(deck_name)
    if not deck:
        raise ValueError(f"Deck not found: {deck_name}")

    note = mw.col.new_note(model)

    # Set fields by name
    field_map = mw.col.models.field_map(model)
    for field_name, value in fields.items():
        if field_name in field_map:
            ord_idx = field_map[field_name][0]
            note.fields[ord_idx] = value

    # Set tags
    if tags:
        note.tags = tags
    else:
        note.tags = ["auto-generated"]

    # Validate
    if note.fields_check() == 2:  # 2 = empty first field
        raise ValueError("First field is empty")

    # Add to collection in specified deck
    mw.col.add_note(note, deck["id"])
    return note.id
```

### GET /api/anki/notes/:id -- Get Note Details

```python
def get_note(note_id):
    try:
        note = mw.col.get_note(note_id)
    except Exception:
        return None

    nt = note.note_type()
    field_map = mw.col.models.field_map(nt)
    fields = {}
    for name, (ord, _) in field_map.items():
        fields[name] = {"value": note.fields[ord], "order": ord}

    return {
        "noteId": note.id,
        "modelName": nt["name"],
        "tags": list(note.tags),
        "fields": fields,
    }
```

### DELETE /api/anki/notes/:id -- Delete a Note

```python
def delete_note(note_id):
    mw.col.remove_notes([note_id])
```

### Duplicate Detection (searchWord equivalent)

```python
def search_word(word, deck_name):
    """Search for a word in specific fields within a deck."""
    escaped_deck = deck_name.replace('"', '\\"')
    escaped_word = word.replace('"', '\\"')

    word_fields = ['Bangla', 'Front', 'Word']
    field_queries = ' OR '.join(f'{f}:"{escaped_word}"' for f in word_fields)
    query = f'deck:"{escaped_deck}" ({field_queries})'

    note_ids = mw.col.find_notes(query)
    if not note_ids:
        return None
    return get_note(note_ids[0])
```

### GET /api/anki/status -- Connection Status

```python
def get_status():
    # Always connected -- we ARE inside Anki
    return {"connected": mw.col is not None}
```

## Add-on Package Structure

```
anki-defs/                          # Add-on root (folder name = add-on ID)
|-- __init__.py                     # Entry point: server startup, menu item
|-- manifest.json                   # Anki add-on metadata (min Anki version)
|-- config.json                     # Default settings
|-- config.md                       # Settings documentation
|
|-- server/
|   |-- __init__.py
|   |-- web.py                      # Non-blocking HTTP server (socket + select)
|   |-- router.py                   # URL routing and request dispatch
|   |-- sse.py                      # SSE response helper
|
|-- handlers/
|   |-- __init__.py
|   |-- anki_routes.py              # /api/anki/* handlers
|   |-- chat_routes.py              # /api/chat/* handlers (streaming + non-streaming)
|   |-- settings_routes.py          # /api/settings handlers
|   |-- session_routes.py           # /api/session handlers
|   |-- platform_routes.py          # /api/platform, /api/health
|
|-- services/
|   |-- __init__.py
|   |-- anki_service.py             # Anki collection operations (wrapper around mw.col)
|   |-- ai_service.py               # AI provider abstraction
|   |-- claude_provider.py          # Claude API (urllib.request)
|   |-- gemini_provider.py          # Gemini API (urllib.request)
|   |-- openrouter_provider.py      # OpenRouter API (urllib.request)
|   |-- card_extraction.py          # Card data extraction from AI responses
|   |-- session_service.py          # SQLite session store
|   |-- prompt_templates.py         # Load prompts from shared JSON
|
|-- web/                            # React frontend (copied from client/dist/ at build)
|   |-- index.html
|   |-- assets/
|       |-- *.js
|       |-- *.css
|
|-- prompts/                        # Shared prompt templates (JSON)
|   |-- word.json
|   |-- sentence.json
|   |-- focused_words.json
|   |-- extract_card.json
|   |-- define.json
|   |-- analyze.json
|
|-- user_files/                     # Survives add-on updates
    |-- session.db                  # Session state (SQLite)
```

**Estimated scope: ~15 Python files, ~1500-2000 lines of code** (excluding vendored
deps and frontend assets).

## Dependencies and Compatibility

### Zero External Dependencies (Recommended Approach)

By using the QTimer-polled socket server (like AnkiConnect), we avoid needing Flask,
Bottle, or any web framework. The only dependencies are:

| Need             | Solution                              | Vendored? |
| ---------------- | ------------------------------------- | --------- |
| HTTP server      | Custom socket server (stdlib only)    | No        |
| AI API calls     | `urllib.request` (stdlib)             | No        |
| JSON parsing     | `json` (stdlib)                       | No        |
| SSE formatting   | Custom helper (~50 lines)             | No        |
| Session storage  | `sqlite3` (stdlib)                    | No        |
| Settings storage | Anki's addon config system            | No        |
| Prompt templates | JSON files, loaded with `json.load()` | No        |

**All stdlib = zero vendoring hassles, zero version conflicts with other add-ons.**

### If We Need `requests` Later

If `urllib.request` proves insufficient for streaming AI APIs:

- Vendor `requests` + `urllib3` + `charset_normalizer` + `certifi` + `idna` into a
  `vendor/` directory
- Add `sys.path.insert(0, os.path.join(os.path.dirname(__file__), "vendor"))` to
  `__init__.py`
- Use `pip install requests -t vendor/` to populate

### Platform Compatibility

| Platform | Anki Location                             | Notes          |
| -------- | ----------------------------------------- | -------------- |
| Linux    | `~/.local/share/Anki2/addons21/<id>/`     | Primary dev    |
| macOS    | `~/Library/Application Support/Anki2/...` | Same structure |
| Windows  | `%APPDATA%\Anki2\addons21\<id>\`          | Same structure |

## Prompt Sharing Strategy

### Recommendation: Prompts as JSON Data Files

Extract prompt templates from `server/src/services/ai.ts` into JSON files in
`shared/prompts/`. Each backend reads the same JSON at startup.

**JSON format per prompt:**

```json
{
  "id": "word",
  "template": "You are a Bangla language tutor. Define the word...",
  "variables": {
    "transliteration_instruction": {
      "true": "Include romanized transliteration...",
      "false": "Do NOT include romanized transliteration..."
    },
    "translit_marker": {
      "true": " ([transliteration])",
      "false": ""
    }
  }
}
```

**Build step:** Copy `shared/prompts/*.json` into the add-on's `prompts/` directory.

**Runtime:** Each backend loads the JSON files and substitutes variables using its own
simple template engine (string replacement -- no Jinja2 needed).

**Migration order:**

1. Extract prompts from `server/src/services/ai.ts` -> `shared/prompts/*.json`
2. Update Node.js server to read from JSON files
3. Android backend reads same JSON files
4. Add-on backend reads same JSON files

This is a prerequisite that benefits all backends, not just the add-on.

## Frontend Changes

Same pattern as Android: platform detection via `/api/platform`.

```python
# GET /api/platform
def handle_platform():
    return {"platform": "anki-addon"}
```

| Setting          | Web (server/)    | Android          | Anki Add-on       |
| ---------------- | ---------------- | ---------------- | ----------------- |
| AnkiConnect URL  | Show             | Hide             | Hide              |
| Deck selector    | Via AnkiConnect  | Via ContentProv. | Via col.decks     |
| Permission flow  | N/A              | AnkiDroid perm.  | N/A (inside Anki) |
| Connection check | /api/anki/status | Always connected | Always connected  |

## Entry Point: `__init__.py`

```python
from aqt import mw, gui_hooks
from aqt.qt import QAction, QTimer, qconnect
import webbrowser

PORT = 28735  # Arbitrary high port, unlikely to conflict

class AnkiDefsAddon:
    def __init__(self):
        self.server = None
        self.timer = None

    def on_profile_loaded(self):
        """Called when user profile is loaded (collection available)."""
        from .server.web import WebServer
        from .handlers import create_router

        router = create_router()
        self.server = WebServer(router.handle)
        self.server.listen(PORT)

        self.timer = QTimer()
        self.timer.timeout.connect(self.server.advance)
        self.timer.start(25)  # 25ms poll interval (same as AnkiConnect)

    def on_profile_will_close(self):
        """Cleanup before profile close."""
        if self.timer:
            self.timer.stop()
            self.timer = None
        if self.server:
            self.server.close()
            self.server = None

    def open_browser(self):
        webbrowser.open(f"http://localhost:{PORT}")

addon = AnkiDefsAddon()

# Register hooks
gui_hooks.profile_did_open.append(addon.on_profile_loaded)
gui_hooks.profile_will_close.append(addon.on_profile_will_close)

# Add menu item
action = QAction("anki-defs", mw)
qconnect(action.triggered, addon.open_browser)
mw.form.menuTools.addAction(action)
```

## Risks and Open Questions

### Risks

| Risk                          | Severity | Mitigation                                                 |
| ----------------------------- | -------- | ---------------------------------------------------------- |
| QTimer poll latency (25ms)    | Low      | Good enough for UI; AnkiConnect proves this                |
| SSE + main thread contention  | Medium   | Daemon threads for AI streaming, Future bridge             |
| AI streaming via urllib       | Medium   | urllib supports streaming reads; fallback: vendor requests |
| Port conflicts                | Low      | Make port configurable; try multiple ports                 |
| Add-on update wipes files     | Low      | Use `user_files/` for persistent data                      |
| Large frontend bundle size    | Low      | Vite tree-shaking keeps it small (~500KB)                  |
| Python 3.9 vs 3.13 compat     | Low      | Avoid 3.10+ features (match/case, etc.)                    |
| Collection access during sync | Medium   | Check `mw.col` is not None before operations               |

### Open Questions

1. **Port selection**: Fixed port (28735) or dynamic? Fixed is simpler and allows
   bookmarking. Dynamic avoids conflicts but complicates reconnection.

2. **urllib.request streaming**: Can we stream responses from Gemini/Claude APIs using
   only `urllib.request.urlopen()` with chunked reads? Need to prototype. If not,
   vendor `requests` or `httpx`.

3. **CORS**: Since the frontend is served from the same origin (`localhost:PORT`),
   CORS is not needed. But if we ever want to open the UI from a bookmark, we need
   CORS headers.

4. **AnkiWeb distribution**: What's the max upload size for add-ons? The React
   frontend assets (~500KB-1MB gzipped) need to fit.

5. **Hot reload during development**: How to reload Python add-on code without
   restarting Anki? Anki has a "Debug Console" (Ctrl+Shift+;) but no hot reload.
   May need to restart Anki during development.

## Implementation Phases

### Phase 0: Prerequisites (shared work)

- Extract prompt templates from Node.js server to `shared/prompts/*.json`
- Update Node.js server to consume JSON prompt files
- This benefits all backends and should be done before add-on work

### Phase 1: Skeleton Add-on + HTTP Server (~3 days)

- `__init__.py` with menu item and profile hooks
- Non-blocking socket HTTP server (port from AnkiConnect's `web.py` pattern)
- URL router with path matching
- Static file serving for frontend assets
- `/api/health` and `/api/platform` endpoints
- **Test**: Install add-on, click menu item, see React UI in browser

### Phase 2: Anki Collection Endpoints (~2 days)

- `/api/anki/decks` -- list decks
- `/api/anki/models` -- list models
- `/api/anki/models/:name/fields` -- field introspection
- `/api/anki/search` -- note search
- `/api/anki/notes` (POST) -- create note
- `/api/anki/notes/:id` (GET) -- get note
- `/api/anki/notes/:id` (DELETE) -- delete note
- `/api/anki/status` -- always connected
- **Test**: Frontend can list decks, create cards, search

### Phase 3: AI Chat (Non-Streaming) (~2 days)

- AI provider abstraction (Claude, Gemini, OpenRouter)
- `/api/chat/define` -- word definition
- `/api/chat/relemmatize` -- re-lemmatization
- `/api/chat/analyze` -- sentence analysis
- Settings management via Anki addon config
- **Test**: Can define words and analyze sentences

### Phase 4: SSE Streaming (~2 days)

- `/api/chat/stream` -- streaming AI response with card extraction
- Daemon thread for AI API streaming
- `mw.taskman.run_on_main()` bridge for mid-stream collection access
- SSE event formatting (text, card_preview, usage, done, error)
- **Test**: Full chat experience with streaming text and card previews

### Phase 5: Session Management (~1 day)

- SQLite session store in `user_files/session.db`
- All `/api/session/*` endpoints
- **Test**: Cards persist across browser refreshes

### Phase 6: Build System + Distribution (~1 day)

- Build script: `npm run build` (client) + copy dist/ to add-on web/
- Copy `shared/prompts/*.json` to add-on prompts/
- Package as `.ankiaddon` (zip with correct structure)
- README + config.md for add-on settings
- **Test**: Install .ankiaddon file, full workflow works

## Advantages Over Current AnkiConnect Approach

- **Zero external dependencies** -- no AnkiConnect add-on to install/configure
- **Faster** -- direct collection access, no HTTP proxy overhead for Anki ops
- **Self-contained** -- single add-on install, battery-included
- **Richer API access** -- can use any Anki Python API, not limited to AnkiConnect
- **Always connected** -- no "Is Anki running?" checks needed
- **Native integration** -- menu item in Anki's Tools menu

## Reference: AnkiConnect's Patterns

AnkiConnect (the dominant Anki add-on for external API access) validates the
architecture described above. Key patterns borrowed:

1. **Non-blocking socket server** with `select.select()` polling
2. **QTimer on main thread** driving the poll loop (25ms default interval)
3. **All collection access on main thread** -- no threading complexity
4. **JSON request/response** format over HTTP
5. **127.0.0.1 binding** for security (localhost only)

Our add-on extends this pattern with SSE streaming (daemon threads for AI I/O)
and static file serving (for the React frontend).
