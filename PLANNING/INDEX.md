# anki-defs — What's Next

## Pick something to work on

### Ready now (no blockers)

(No immediate blockers — pick from below.)

### Needs design/discussion first

4. **Reader mode (tap-to-define)** — Paste text, tap words for definitions. Big
   feature, needs UI planning. PDF/image import builds on this.

### Medium effort

5. **Migrate Android to JSON-first pipeline** — Still uses old two-call streaming.
   Should match web's single JSON call.
6. **Unmarked sentence mode** — Auto-detect unknown words in a sentence, generate
   cards only for those. Different from sentence translation.
7. **Per-message streaming indicator** — Loading indicator only shows on last
   message during concurrent streaming.

### Low priority / future

10. Gemini grounding with web search ($35/1K — opt-in only)
11. Bangla disambiguation for homonyms

## Component status

| Component                                           | Status  | Notes                                                                                                       |
| --------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Web app (`client/` + `python-server/`)              | Working | Bottle + React, 3 AI providers, TTS, auto note-type creation per language                                   |
| Android (`android/`)                                | Working | Still on old two-call pipeline                                                                              |
| Anki add-on (`anki-addon/`)                         | Working | Bottle WSGI in daemon thread, `@main_thread` bridge for collection access. Tested via Tailscale from phone. |
| Photo-to-flashcards                                 | Working | Camera/upload → crop → extract vocab → generate examples → add to Anki. Gemini vision, chunked batching.    |
| Photo cloze                                         | Working | Two-stage pipeline: vision transcribe → LLM cloze extract. Review/edit UI with per-item add-to-Anki.        |
| Shared prompts (`shared/prompts/`)                  | Working | Parameterized templates + language files in `shared/languages/`. Tight definition rules enforced.           |
| Note-type templates (`shared/data/note-types.json`) | Working | Audio fields with TTS fallback. `{{LOCALE}}` from `ttsLocale`. Bold markdown → HTML conversion.             |
| Tests                                               | 138+27  | python-server pytest (111) + vitest (27 client) + addon pytest (27)                                         |
| CI                                                  | Working | `.github/workflows/ci.yml`                                                                                  |
| Docs site (`docs/`)                                 | Updated | Tailscale docs rewritten with addon support + Chrome HTTP flag                                              |

## Detailed plans

| Doc                                                                      | What it covers                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [pdf-to-cards.md](pdf-to-cards.md)                                       | Cards from textbook PDFs via pdfjs + LLM scout. Chapter picker, phrase support, y-coord fix.  |
| [photo-cloze.md](photo-cloze.md)                                         | Cloze cards from textbook exercises — implemented (two-stage pipeline + review UI)             |
| [photo-cloze-integration-handoff.md](photo-cloze-integration-handoff.md) | Photo cloze: integration handoff doc (backend + UI both done)                                  |
| [mcp-agent-cards.md](mcp-agent-cards.md)                                 | MCP agent for flashcard generation — design proposal                                          |
| [addon-testing-session.md](addon-testing-session.md)                     | Full log of addon e2e test session                                                            |
| [next-steps.md](next-steps.md)                                           | Full feature list with details                                                                |
| [audio-in-cards.md](audio-in-cards.md)                                   | TTS integration plan                                                                          |
| [cloze-research-prompt.md](cloze-research-prompt.md)                     | Cloze card research (mostly done)                                                             |

## Completed plans

[addon-hardening.md](addon-hardening.md) ·
[settings-unification.md](settings-unification.md) ·
[audio-in-cards.md](audio-in-cards.md)

## Reference docs

[security-audit.md](security-audit.md) ·
[team-workflow.md](team-workflow.md) ·
[repo-structure.md](repo-structure.md) ·
[anki-addon.md](anki-addon.md) ·
[android-backend.md](android-backend.md) ·
[quick-translate.md](quick-translate.md)

## For agents

- Read this file first, then the relevant plan doc for your task.
- Update docs in the same commit as code changes.
- Both python-server and anki-addon use Bottle (WSGI). Route handlers should
  be nearly identical — only the Anki adapter import differs.
- Subproject plans: `android/PLANNING/`, `client/PLANNING/`, `python-server/PLANNING/`, `shared/PLANNING/`
