# Repo Structure: Monorepo Layout

## Key Insight

The React frontend is not "the web app" — it's THE frontend, shared by all platforms.
Each platform provides its own backend that serves the frontend and implements the API.

## Structure

```
anki/                               ← repo root
├── client/                         ← React frontend (shared by ALL platforms)
│   ├── src/
│   ├── dist/                       ← build output (gitignored)
│   ├── package.json
│   └── vite.config.ts
├── shared/                         ← TypeScript types + prompt data (shared by ALL backends)
│   ├── types.ts                    ← API contract: source of truth
│   ├── prompts/                    ← Language-specific prompt templates (JSON/YAML)
│   └── package.json
├── ankiconnect-server/              ← Backend #1: Node.js + AnkiConnect (standalone/desktop)
│   ├── src/
│   ├── dist/
│   └── package.json
├── android/                        ← Backend #2: Kotlin + NanoHTTPd + AnkiDroid ContentProvider
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── assets/client/      ← client/dist/ copied here by Gradle
│   │   │   └── kotlin/com/word2anki/
│   │   │       ├── MainActivity.kt
│   │   │       ├── server/         ← NanoHTTPd local server + API handlers
│   │   │       ├── data/           ← AnkiRepository, SettingsRepository
│   │   │       └── ai/            ← GeminiService, CardExtractor, PromptTemplates
│   │   └── build.gradle.kts
│   ├── gradle/
│   └── build.gradle.kts
├── anki-addon/                     ← Backend #3: Python inside Anki Desktop (future)
│   └── ...
├── package.json                    ← npm workspaces: client, shared, ankiconnect-server
├── CLAUDE.md                       ← Root: architecture, API contract, cross-cutting rules
├── PLANNING/
├── PROGRESS.md
└── FUTURE_FEATURES.md
```

## Why this works

1. **anki-defs already uses this layout** — `client/`, `ankiconnect-server/`, `shared/` are the existing npm workspaces. We just add `android/` alongside them.
2. **npm workspaces stay the same** — `package.json` workspaces are `["shared", "ankiconnect-server", "client"]`. Gradle ignores them. npm ignores `android/`.
3. **Each backend is independent** — `ankiconnect-server/` is Node.js, `android/` is Gradle, `anki-addon/` is Python. They don't know about each other.
4. **Frontend is clearly shared** — `client/` is not inside any backend. All backends consume its build output.

## How it differs from current anki-defs

Barely at all. We're essentially:

1. Adding `android/` next to the existing directories
2. Moving root docs (CLAUDE.md, PLANNING/, etc.) to accommodate the broader project
3. That's it — no restructuring of anki-defs itself

## Build Flow

### Desktop/web development (unchanged from anki-defs)

```bash
npm run dev          # Vite dev server + Express, proxy /api
```

### Android

```bash
npm run build:client                    # Build React frontend → client/dist/
cd android && ./gradlew assembleDebug   # Copies client/dist/ to assets, builds APK
```

### Gradle copy task

```kotlin
// android/app/build.gradle.kts
tasks.register<Copy>("copyClientAssets") {
    from("${rootProject.projectDir}/../client/dist")
    into("src/main/assets/client")
}
tasks.named("preBuild") {
    dependsOn("copyClientAssets")
}
```

## Migration: How we get here

Since anki-defs already has the right structure at its root, the simplest path is:

### Option A: anki-defs repo is the base (recommended)

1. In anki-defs repo: add `android/` directory with word2anki's Android project
2. Use `git subtree add --prefix=android` from word2anki to preserve history
3. Rename repo if desired

### Option B: word2anki repo is the base

1. Move Android files into `android/` subdirectory via `git mv`
2. Use `git subtree add` to bring in anki-defs at root level
3. More complex because anki-defs files go to root, not a subdirectory

### Option C: Fresh repo

1. New repo, `git subtree add` both projects
2. Cleanest, but more work

**Recommendation: Option A** — anki-defs already has the right directory layout. We just add `android/` to it.

## Future: Syncing if repos stay separate temporarily

If both repos continue to exist independently during transition:

```bash
# Pull anki-defs changes into monorepo
git subtree pull --prefix=. anki-defs/main  # (if anki-defs is base)

# Pull word2anki Android changes
git subtree pull --prefix=android word2anki/main
```
