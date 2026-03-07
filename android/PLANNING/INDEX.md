# Planning Index (Android)

Plans and requirements specific to the Android app.

## WebView Migration (from root plan)

The Android app is being migrated from native Compose UI to a WebView that loads
the shared React frontend. See root [PLANNING/overview.md](../../PLANNING/overview.md)
for the phase plan. Relevant root planning docs:

- [android-backend.md](../../PLANNING/android-backend.md) -- NanoHTTPd server + API handlers **(Phase 2 -- next)**
- [webview-bridge.md](../../PLANNING/webview-bridge.md) -- WebView setup, native bridges **(Phase 4-5)**
- [settings-design.md](../../PLANNING/settings-design.md) -- Android settings design
- [quick-translate.md](../../PLANNING/quick-translate.md) -- Native popup for text selection **(Phase 7)**

## Completed

- **Shared prompt integration** -- Android now loads prompts from `shared/prompts/*.json`
  (copied into `assets/prompts/` at build time) instead of hardcoded Kotlin strings.
  All three backends share identical prompt templates.

## Android-Specific Plans

| Doc                                          | Summary                                              |
| -------------------------------------------- | ---------------------------------------------------- |
| [future-features.md](future-features.md)     | Post-migration features (highlighting, on-device AI) |

## How to Use

- Create a new `.md` file here for android-specific plans or requirements.
- Update this INDEX.md when adding or completing plans.
- Cross-cutting plans that affect multiple subprojects belong in root `PLANNING/`.
