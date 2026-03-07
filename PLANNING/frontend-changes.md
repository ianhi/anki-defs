# Changes Needed in anki-defs Frontend

## Goal
Make the React frontend platform-aware so it works on both web and Android without forking.

## Changes Required

### 1. Platform Detection (small)

Add a platform context that the app checks to conditionally render features.

**New endpoint consumed:** `GET /api/platform`
```json
// Web response:
{ "platform": "web" }

// Android response:
{ "platform": "android", "ankiAvailable": true, "hasPermission": true }
```

**Frontend implementation:**
```typescript
// client/src/hooks/usePlatform.ts
const usePlatform = () => useQuery({ queryKey: ['platform'], queryFn: () => api.get('/platform') })
```

### 2. Settings Screen Adaptations (small)

Features to hide/change on Android:

| Setting | Web | Android |
|---------|-----|---------|
| AnkiConnect URL | Show | Hide (uses ContentProvider) |
| AI Provider selector | Show (Claude/Gemini/OpenRouter) | Show (Gemini only initially, extensible) |
| AnkiConnect status indicator | Show | Replace with "AnkiDroid installed" / "Permission granted" |

**Implementation:** Wrap conditional sections in `{platform === 'web' && ...}`.

### 3. Permission Flow (small)

Android needs to request AnkiDroid permission. The frontend should show a prompt when `hasPermission: false`.

**New component:** `AnkiPermissionBanner.tsx`
- Shows "Grant AnkiDroid permission" button
- Calls `window.Android.requestAnkiPermission()` (JS bridge)
- Banner dismisses when permission granted

### 4. Share Intent Handling (small)

When Android receives a share intent, it needs to pre-fill the chat input.

**Implementation:**
- WebView loads `index.html#shared=<encoded-text>`
- Frontend reads hash param on mount, populates input, optionally auto-sends
- OR: `window.Android.getSharedText()` JS bridge call

### 5. No Breaking Changes for Web

All changes must be additive. The web version continues working exactly as before. Android-specific behavior only activates when `/api/platform` returns `"android"`.

## Files to Modify in anki-defs

| File | Change |
|------|--------|
| `shared/types.ts` | Add `PlatformInfo` type |
| `client/src/hooks/usePlatform.ts` | New hook (platform detection) |
| `client/src/components/Settings.tsx` | Conditional rendering for Android |
| `client/src/components/Chat.tsx` | Handle shared text from intent |
| `client/src/App.tsx` | Add permission banner |

Estimated: ~100-150 lines of frontend changes.
