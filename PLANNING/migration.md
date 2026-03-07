# Migration Plan: Step by Step

## Strategy: anki-defs repo is the base

anki-defs already has the right top-level structure (`client/`, `ankiconnect-server/`, `shared/`).
We add `android/` to it via `git subtree` to preserve word2anki's history.

## Pre-flight

### 0. Commit dirty changes in BOTH repos

```bash
# anki-defs — commit WIP
cd /home/claude/dev/anki-defs
git add -A
git commit -m "wip: session persistence (in progress)"

# word2anki — commit planning docs
cd /home/claude/dev/word2anki
git add FUTURE_FEATURES.md PLANNING/
git commit -m "docs: Add PLANNING docs for hybrid WebView architecture"
```

## Phase 1: Repo Restructure

### 1. Prepare word2anki for subtree import

word2anki's Android files are at root (`app/`, `gradle/`, `build.gradle.kts`, etc.).
We need them under `android/` in the target repo.

Two approaches:

**Approach A: Move files in word2anki first, then subtree add**

```bash
cd /home/claude/dev/word2anki
git checkout -b prep/android-subdir

mkdir android
git mv app android/app
git mv build.gradle.kts android/build.gradle.kts
git mv settings.gradle.kts android/settings.gradle.kts
git mv gradle android/gradle
git mv gradle.properties android/gradle.properties
git mv gradlew android/gradlew
git mv gradlew.bat android/gradlew.bat
# Move docs too
git mv PROGRESS.md android/   # or keep at root
git commit -m "refactor: Move Android project into android/ subdirectory"
```

Then in anki-defs:

```bash
cd /home/claude/dev/anki-defs
git remote add word2anki /home/claude/dev/word2anki
git fetch word2anki
git subtree add --prefix=android word2anki/prep/android-subdir
# This brings android/ with full history
```

Wait — this puts it at `android/android/`. Wrong.

**Approach B (correct): Subtree add word2anki at root, with prefix=android**

`git subtree add --prefix=android` takes the root of the source branch and puts it under `android/`. So word2anki files go to `android/app/`, `android/build.gradle.kts`, etc. Exactly what we want.

```bash
cd /home/claude/dev/anki-defs
git checkout -b restructure/monorepo   # safety branch

git remote add word2anki /home/claude/dev/word2anki
git fetch word2anki

# Bring in word2anki under android/ prefix
git subtree add --prefix=android word2anki/claude/word2anki-android-app-ODHeY
```

This preserves word2anki's full commit history. Files land at:

- `android/app/src/main/kotlin/...`
- `android/build.gradle.kts`
- `android/gradlew`
- `android/CLAUDE.md` (we'll update this)
- `android/PROGRESS.md`
- `android/FUTURE_FEATURES.md` (move to root later)
- `android/PLANNING/` (move to root later)

### 2. Rearrange root-level docs

```bash
cd /home/claude/dev/anki-defs

# Move planning/docs to root (they're project-wide, not Android-specific)
git mv android/PLANNING .
git mv android/FUTURE_FEATURES.md .
git mv android/PROGRESS.md .

# android/CLAUDE.md becomes Android-specific (rewrite contents)
# Root CLAUDE.md becomes project-wide (create new)

git commit -m "docs: Move project-wide docs to repo root"
```

### 3. Clean up Android-only artifacts from root

```bash
# These are Android-specific, should only be in android/
# Check nothing leaked to root
ls android/.gitignore  # keep if Android-specific, merge with root if needed
```

### 4. Update .gitignore

Merge both projects' .gitignore rules. Root .gitignore should cover:

- Node.js: `node_modules/`, `dist/`
- Android: `.gradle/`, `*.apk`, `local.properties`
- IDE: `.idea/` (both IntelliJ/AS)
- OS: `.DS_Store`

### 5. Write CLAUDE.md hierarchy

Create/update:

- Root `CLAUDE.md` — architecture, API contract, cross-cutting rules
- `android/CLAUDE.md` — rewrite for Android-specific context
- Keep existing web docs (client/server don't need CLAUDE.md yet, root covers enough)

See [claude-md-strategy.md](claude-md-strategy.md) for contents.

### 6. Verify both projects build

```bash
# Web
npm install && npm run dev

# Android
cd android
export ANDROID_HOME=~/Android/Sdk && export JAVA_HOME=/usr
./gradlew assembleDebug
```

### 7. Commit and push

```bash
git add -A
git commit -m "feat: Merge word2anki Android project into monorepo"
```

## Phase 2: Android Backend (~680 lines new code)

1. Add NanoHTTPd + Gson dependencies to `android/app/build.gradle.kts`
2. Create `LocalServer.kt` — routing + static asset serving
3. Create `SettingsHandler.kt` — simplest endpoint
4. Create `AnkiHandler.kt` + add missing AnkiRepository methods
5. Create `ChatHandler.kt` — SSE streaming
6. Add `/api/platform` endpoint
7. Test each endpoint with curl

## Phase 3: Frontend Platform Awareness (~100-150 lines)

1. Add `usePlatform` hook to `client/`
2. Conditional settings rendering
3. Share intent event listener
4. Build: `npm run build:client`

## Phase 4: WebView Activity (~200 lines)

1. Replace Compose UI with WebView in MainActivity
2. Add AndroidBridge JS interface
3. Add Gradle copy task for `client/dist/` → `assets/client/`
4. Test on emulator

## Phase 5: Cleanup

1. Remove old Compose UI files (~2000 lines)
2. Remove old ViewModels (~500 lines)
3. Update all CLAUDE.md files
4. Update PROGRESS.md

## Phase 6: Prompt Improvements

Port Bangla-specific prompt rules into shared prompt data files in `shared/prompts/`.

## Rollback

```bash
# Original anki-defs main branch is untouched
git checkout main

# Delete restructure branch if needed
git branch -D restructure/monorepo
```

## Verification Checklist

- [ ] `npm run dev` works (web frontend + server)
- [ ] `cd android && ./gradlew assembleDebug` works
- [ ] `git log -- android/app/src/main/kotlin/com/word2anki/MainActivity.kt` shows word2anki history
- [ ] `git log -- client/src/App.tsx` shows anki-defs history
- [ ] Root CLAUDE.md has architecture overview
- [ ] android/CLAUDE.md has Android-specific context
- [ ] .gitignore covers both ecosystems
