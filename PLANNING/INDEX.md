# anki-defs — What's Next

## Pick something to work on

### Ready now (no blockers)

1. **Test Anki add-on end-to-end** — Code is hardened but never verified inside
   Anki Desktop. Run `install-dev.sh`, restart Anki, test all flows. High value.
2. **Sentence translation without highlighting** — Currently shows a help message.
   Should just translate naturally. Small change, good UX win.
3. **Wire up error modal** — `useErrorModal.showError()` exists but nothing
   triggers it. Quick polish.
4. **Embedded audio in cards** — TTS at card creation time. Plan exists at
   [audio-in-cards.md](audio-in-cards.md). Separate comparison tool at
   `~/dev/tts-compare/` to pick the engine first.

### Needs design/discussion first

5. **Reader mode (tap-to-define)** — Paste text, tap words for definitions. Big
   feature, needs UI planning. PDF/image import builds on this.
6. **Language-agnostic prompts** — All prompts hardcoded to Bangla. Big refactor
   to parameterize target language across types, prompts, and field names.

### Medium effort

7. **Migrate Android to JSON-first pipeline** — Still uses old two-call streaming.
   Should match web's single JSON call.
8. **Unmarked sentence mode** — Auto-detect unknown words in a sentence, generate
   cards only for those. Different from sentence translation.
9. **Per-message streaming indicator** — Loading indicator only shows on last
   message during concurrent streaming.

### Low priority / future

10. Gemini grounding with web search ($35/1K — opt-in only)
11. Bangla disambiguation for homonyms

## Component status

| Component                              | Status  | Notes                                                    |
| -------------------------------------- | ------- | -------------------------------------------------------- |
| Web app (`client/` + `python-server/`) | Working | FastAPI + React, 3 AI providers, TTS, cloze, onboarding |
| Android (`android/`)                   | Working | Still on old two-call pipeline                           |
| Anki add-on (`anki-addon/`)            | Working | Hardened but untested inside Anki                        |
| Shared prompts (`shared/prompts/`)     | Working | JSON templates incl. english-to-bangla + distractors     |
| Tests                                  | 65+67+46 | vitest + python-server pytest + addon pytest            |
| CI                                     | Working | `.github/workflows/ci.yml`                               |
| Docs site (`docs/`)                    | Deployed | Astro Starlight on GitHub Pages                         |

## Detailed plans

| Doc                                                  | What it covers                        |
| ---------------------------------------------------- | ------------------------------------- |
| [next-steps.md](next-steps.md)                       | Full feature list with details        |
| [audio-in-cards.md](audio-in-cards.md)               | TTS integration plan                  |
| [cloze-research-prompt.md](cloze-research-prompt.md) | Cloze card research (mostly done)     |

## Completed plans

[addon-hardening.md](addon-hardening.md) ·
[settings-unification.md](settings-unification.md)

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
- Subproject plans: `android/PLANNING/`, `client/PLANNING/`, `python-server/PLANNING/`, `shared/PLANNING/`
