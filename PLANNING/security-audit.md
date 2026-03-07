# Security & Safety Audit

**Date**: 2026-03-07
**Scope**: All three backends (server/, android/, anki-addon/) and client/ configuration
**Focus**: Anki database safety, network exposure, data integrity

---

## Findings

### CRITICAL

#### C1. Unrestricted Search Query Passthrough (All Backends)

All three backends pass user-provided query strings directly to Anki's search engine
with no validation or allowlisting:

- **server** (`server/src/routes/anki.ts:48`): `POST /api/anki/search` passes `req.body.query`
  directly to `ankiClient.note.findNotes({ query })`
- **android** (`AnkiHandler.kt:81`): passes query directly to `ankiRepository.searchNotes(query)`
- **anki-addon** (`anki_routes.py:40`): passes query directly to `anki_service.search_notes(query)`

While Anki's `find_notes()` is read-only (no SQL injection -- it's a search DSL, not SQL),
this endpoint exposes the entire collection to search. A network attacker with access to the
API could enumerate all notes across all decks, extracting the user's complete flashcard database.

**Risk**: Information disclosure of the entire Anki collection.

**Current mitigation**: None. The endpoint accepts arbitrary Anki search queries.

**Recommendation**: This is acceptable for a local-only tool, but becomes a real risk when
combined with the network exposure issues below (C2, H1). The search endpoint should not be
the primary concern -- fixing network exposure is the correct mitigation.

---

#### C2. Express Server Binds to All Interfaces (No Auth)

`server/src/index.ts:64`: `app.listen(PORT)` -- when no host is specified, Node.js/Express
binds to `0.0.0.0` (all interfaces). Combined with `cors()` at line 34 which allows ALL
origins, any device on the local network (or Tailscale network) can:

1. Read all Anki notes via `POST /api/anki/search` with query `*`
2. Create notes in any deck
3. Delete any note by ID
4. Read AI API keys (masked, but last 4 chars exposed via `GET /api/settings`)
5. Update settings including API keys via `PUT /api/settings`
6. Trigger Anki sync

**Risk**: Full unauthenticated API access from any network-adjacent device.

**Current mitigation**: None. No authentication, no IP allowlist, fully open CORS.

**Recommendation**:
- Bind Express to `127.0.0.1` explicitly: `app.listen(PORT, '127.0.0.1')`
- Replace `cors()` (allow-all) with a restrictive CORS policy that only allows
  `localhost` and `pop-os` origins
- If Tailscale access is intentional, add a simple shared-secret auth token

---

### HIGH

#### H1. Vite Dev Server Binds to All Interfaces

`client/vite.config.ts:15`: `host: true` makes the Vite dev server listen on `0.0.0.0:5173`.
The `allowedHosts: ['pop-os']` only controls the `Host` header check (preventing DNS rebinding),
but does NOT prevent direct IP access.

Combined with the proxy config (`/api` -> `localhost:3001`), anyone who can reach port 5173
gets full API access through the proxy.

**Risk**: Network-accessible dev server proxying all API requests.

**Current mitigation**: `allowedHosts` partially mitigates DNS rebinding but not direct IP access.

**Recommendation**:
- If Tailscale access is intentional, document this explicitly and add auth
- Otherwise, remove `host: true` and use the default (localhost only)
- Add the Tailscale hostname to `allowedHosts` if keeping `host: true`

---

#### H2. No Confirmation for Note Deletion

`DELETE /api/anki/notes/:id` across all backends deletes a note immediately with no
confirmation step, no soft-delete, and no undo mechanism.

- **server** (`anki.ts:150-153`): Calls `ankiClient.note.deleteNotes({ notes: [noteId] })`
- **android** (`AnkiRepository.kt:380-393`): Calls `contentResolver.delete(noteUri, null, null)`
- **anki-addon** (`anki_service.py:118-121`): Calls `col.remove_notes([note_id])`

While each call only deletes a single note, there is no safeguard against:
- Rapid sequential deletion calls (e.g., a frontend bug iterating over a list)
- Deleting a note that was NOT created by this app (any note ID is accepted)

The `deleteNotes` AnkiConnect method accepts an array -- the current code always passes a
single-element array, but a code change could easily pass multiple IDs.

**Risk**: Accidental deletion of user's notes, including hand-crafted notes not created by this app.

**Current mitigation**: Frontend only shows delete buttons for notes it created. But the API
has no such restriction.

**Recommendation**:
- Verify the note has the `auto-generated` tag before deleting (only delete our own notes)
- Log deletions with note content for potential recovery
- Consider adding an `X-Confirm-Delete` header requirement

---

#### H3. Anki Add-on Has Direct DB Access with No Safeguards

The add-on (`anki-addon/services/anki_service.py`) runs inside Anki's process with full
`mw.col` access. Bugs could corrupt the SQLite database:

- `delete_note()` (line 118-121): Calls `col.remove_notes([note_id])`. If `note_id` is 0 or
  an unexpected value, behavior depends on Anki's internal validation. The function does NOT
  verify the note exists before attempting deletion.
- `create_note()` (line 87-115): Directly mutates `note.fields` by index. An out-of-range
  index would raise an exception but could leave the note in a partially-modified state.
- No `try/except` around `col.remove_notes()` -- if it raises partway through, the collection
  state is uncertain.
- `sync()` (line 124-126): Calls `mw.on_sync_button_clicked()` which triggers the full sync
  flow. If called during another operation, it could conflict.

**Risk**: Database corruption or unexpected state from unvalidated operations.

**Current mitigation**: Anki's own internal validation (fields_check, duplicate detection).
The QTimer model ensures single-threaded access.

**Recommendation**:
- Wrap `delete_note()` in try/except and verify note exists first
- Add note existence check before deletion: `col.get_note(note_id)` first
- Never call `remove_notes()` with an empty list or invalid IDs
- Document the sync behavior -- warn if sync is already in progress

---

#### H4. CORS Allow-All on Android and Add-on Servers

- **Android** (`LocalServer.kt:93`): `Access-Control-Allow-Origin: *`
- **Add-on** (`web.py:124`): `Access-Control-Allow-Origin: *`

These servers run on `localhost` but accept requests from any origin. A malicious website
visited in any browser could make fetch requests to `localhost:18765` (Android) or the
add-on port and perform Anki operations.

**Risk**: Cross-origin request forgery from malicious websites.

**Current mitigation**: NanoHTTPd defaults to binding on all interfaces but the WebView
loads from `localhost`. The add-on binds to `127.0.0.1` which limits to local processes only.

**Recommendation**:
- On Android: NanoHTTPd binds to all interfaces by default (the `NanoHTTPD(PORT)` constructor
  does NOT specify a hostname). This means port 18765 is accessible from any device on the
  same network. Fix by using `NanoHTTPD("127.0.0.1", PORT)`.
- Restrict CORS to the specific localhost origin: `http://localhost:<port>`

---

### MEDIUM

#### M1. API Key Exposure via Settings Endpoint

`GET /api/settings` (`server/src/routes/settings.ts:13-21`) masks API keys but exposes the
last 4 characters. While the masked format prevents full key recovery, the last 4 chars
can confirm whether a specific key is in use.

More importantly, `PUT /api/settings` accepts full API keys in plaintext over HTTP (not HTTPS).
On a local network or Tailscale, these keys could be intercepted.

**Risk**: API key interception during settings updates over non-TLS connections.

**Current mitigation**: Keys are masked in GET responses. PUT only updates non-masked values.

**Recommendation**:
- Settings file is stored at `~/.config/bangla-anki/settings.json` with no file permission
  restrictions. Set file permissions to `0600` after writing.
- Consider using environment variables exclusively for API keys rather than the settings API.

---

#### M2. Android NanoHTTPd Binds to All Interfaces

`LocalServer.kt:18`: `NanoHTTPD(PORT)` -- the single-argument constructor binds to `0.0.0.0`.
Port 18765 is accessible from any device on the same Wi-Fi network.

Android's network security prevents most external access, but on rooted devices or
development builds, this port is reachable.

**Risk**: External access to the Android API server from the local network.

**Current mitigation**: Android's network isolation provides some protection. The WebView
connects via `localhost`.

**Recommendation**: Change to `NanoHTTPD("127.0.0.1", PORT)` or `NanoHTTPD("localhost", PORT)`.

---

#### M3. No Rate Limiting on Any Endpoint

None of the three backends implement rate limiting. Rapid requests could:
- Flood Anki with hundreds of notes via rapid `POST /api/anki/notes` calls
- Exhaust AI API quotas via rapid `POST /api/chat/stream` calls
- Create excessive load on Anki's search via rapid `POST /api/anki/search` calls

**Risk**: Accidental or malicious resource exhaustion.

**Current mitigation**: None.

**Recommendation**: Add basic rate limiting to the Express server (e.g., `express-rate-limit`
with 30 req/min for write endpoints). This is lower priority since the primary users are
the app's own frontend.

---

#### M4. Add-on MAX_BODY_SIZE Defined but Not Enforced

`anki-addon/server/web.py:22` defines `MAX_BODY_SIZE = 1024 * 1024` but this constant is
never checked. The `ClientBuffer` will accept arbitrarily large request bodies, potentially
exhausting memory.

**Risk**: Memory exhaustion from oversized requests (unlikely in practice but a code quality issue).

**Current mitigation**: None.

**Recommendation**: Check `self._content_length > MAX_BODY_SIZE` in `feed()` and reject the
request if exceeded.

---

#### M5. Session Data Loss

The pending card queue is stored in SQLite on the server (`server/src/services/session.ts`)
and in Zustand/localStorage on the client. If the session database is corrupted or the
browser's localStorage is cleared, all queued (not yet synced to Anki) cards are lost.

`POST /api/session/clear` clears all session data with no confirmation.

**Risk**: Loss of queued cards that haven't been synced to Anki.

**Current mitigation**: Cards that have been synced to Anki are safe -- only the pending
queue is at risk.

**Recommendation**: This is acceptable for the current use case. The pending queue is
a staging area, not a permanent store.

---

### LOW

#### L1. AI Prompt Injection via Card Content

AI responses are used to generate card content, which is stored in Anki and later displayed.
If a malicious AI response contains HTML/JavaScript, it could execute in Anki's card viewer
(which uses a WebView/QWebEngineView).

However, this is a very indirect attack path -- the AI provider would need to be compromised,
and Anki's card viewer already handles HTML content by design.

**Risk**: Theoretical XSS via AI-generated card content in Anki's reviewer.

**Current mitigation**: Anki's card viewer is designed to render HTML. Users already put
HTML in cards. This is not a meaningful attack vector.

---

#### L2. Search Query Escaping Is Incomplete

`server/src/services/anki.ts:57-58` (`searchWord`):
```typescript
const escapedDeck = deckName.replace(/"/g, '\\"');
const escapedWord = word.replace(/"/g, '\\"');
```

This only escapes double quotes. Anki's search syntax also uses special characters like `*`,
`_`, `(`, `)`, `-`, and backslashes. While this won't cause data modification (Anki search
is read-only), it could cause unexpected search results or match more notes than intended.

The Android backend (`AnkiRepository.kt:129-130`) also escapes backslashes, which is slightly
better. The add-on backend (`anki_service.py:48-49`) matches the server's escaping (quotes only).

**Risk**: Unexpected search results from special characters in user input. No data modification risk.

**Current mitigation**: Anki search is read-only. Worst case is matching wrong notes or no notes.

**Recommendation**: Also escape backslashes in the server and add-on search functions:
`word.replace(/\\/g, '\\\\').replace(/"/g, '\\"')`

---

#### L3. Error Messages May Leak Internal Details

Error responses across all backends include raw exception messages:
- `AnkiHandler.kt:49`: `"error":"Failed to fetch decks"` (generic, OK)
- `anki_routes.py:14`: `Response.error(str(e))` (raw Python exception -- may include paths)
- `LocalServer.kt:49`: `"error":"${e.message?.replace("\"", "'")}"` (raw message)

**Risk**: Information disclosure of internal paths, stack details.

**Current mitigation**: Most error handlers use generic messages. Only some pass through
raw exception messages.

---

#### L4. Directory Traversal Protection in Add-on Static Server

`anki-addon/server/web.py:156-158` checks for `..` after `normpath`, which is correct.
However, on Windows, `normpath` converts forward slashes to backslashes, and the `..` check
might miss certain edge cases with Windows path separators.

**Risk**: Theoretical directory traversal on Windows. The `normpath` + `..` check is
generally sufficient.

**Current mitigation**: `os.path.normpath()` + starts-with `..` check. This is adequate
for the supported platforms.

---

## Current Mitigations Summary

| Area | Mitigation | Adequate? |
|------|-----------|-----------|
| Deletion scope | API only accepts single note IDs | Partially -- no ownership check |
| Search injection | Anki search is read-only (no SQL) | Yes for data safety, no for privacy |
| Add-on threading | QTimer ensures single-threaded col access | Yes |
| Add-on network | Binds to 127.0.0.1 | Yes |
| API key masking | GET masks keys, PUT ignores masked values | Yes |
| Note creation validation | Anki rejects empty first field, duplicates | Yes |
| Static file traversal | normpath + `..` check in add-on | Yes |
| Express body size | `express.json({ limit: '1mb' })` | Yes |
| Android permissions | Requires explicit AnkiDroid permission grant | Yes |

---

## Recommendations Summary

### Implemented Fixes

1. **DONE -- Bearer token auth on Express**: Auto-generated `apiToken` in settings, checked
   via middleware on all `/api/*` routes. Localhost requests (`127.0.0.1`, `::1`) are exempt.
   Server binds to all interfaces (needed for Tailscale access) but requires auth from
   non-localhost clients.

2. **DONE -- Restrict CORS on Express**: Origins restricted to `localhost:5173`, `localhost:3001`,
   and `127.0.0.1` equivalents.

3. **DONE -- Android NanoHTTPd bound to localhost**: `NanoHTTPD("127.0.0.1", PORT)` --
   only the local WebView needs access.

4. **DONE -- Bearer token auth on Anki add-on**: Same pattern as Express -- token auto-generated,
   checked per-request, localhost exempt. Add-on binds to `0.0.0.0` for Tailscale access.

5. **DONE -- Enforce MAX_BODY_SIZE in add-on**: Content-length check in `ClientBuffer.feed()`.

6. **DONE -- Escape backslashes in search**: `searchWord()` in `server/src/services/anki.ts`.

7. **DONE -- Ownership check on delete**: Express DELETE endpoint verifies `auto-generated`
   tag before allowing deletion.

### Remaining recommendations

8. **Set file permissions on settings.json**: `chmod 0600` after writing.

9. **Add note existence check in add-on delete**: Call `col.get_note(note_id)` before
   `col.remove_notes()`.

---

## AnkiConnect Destructive Operations (Reference)

The `yanki-connect` library exposes these destructive AnkiConnect operations that this app
does NOT currently call but should never call:

| Operation | Risk | Used? |
|-----------|------|-------|
| `deleteNotes` (plural, with array) | Bulk deletion | Yes, but always single-element array |
| `deleteDecks` | Destroys entire decks + all cards | No -- never use |
| `clearUnusedTags` | Removes tags from DB | No -- low risk |
| `removeEmptyNotes` | Bulk deletion of "empty" notes | No -- never use |
| `updateNoteFields` | Overwrites existing content | No -- could be risky |
| `changeDeck` | Moves cards between decks | No -- low risk |

The app only uses: `addNote`, `deleteNotes` (single), `findNotes`, `notesInfo`, `deckNames`,
`modelNames`, `modelFieldNames`, `sync`, `version`. This is a reasonable minimal surface area.
