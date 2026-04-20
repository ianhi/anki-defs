# UI Polish — Usage Notes

Issues captured from mobile testing (phone via Tailscale).
Source: `usagenotes.md` in repo root.

## Deck Language Management

- Deck language selection is clunky — should be easier to set and modify
- A parent deck's language should propagate to children (e.g. setting
  "Spanish" on `Spanish::` applies to `Spanish::immersion` unless overridden)
- Should be able to modify an existing deck's language, not just set initially

## Deck Selectors

- Multiple deck selectors exist in the app — consolidate or make consistent
- Custom deck selector should have fuzzier search
- Clicking the deck selector should auto-focus the text input

## Settings

- Settings should open to the Anki/decks section by default, not the
  AI provider section

## Loading

- White loading page still flashes sometimes on startup — eliminate the flash

## Agent Prompt

```
You're fixing UI issues in the anki-defs React client. The user tests on
mobile (phone via Tailscale to pop-os:5173). Read `usagenotes.md` in the
repo root for the full list, and PLANNING/ui-polish.md for structured
breakdown.

Key issues in priority order:

1. Deck language: parent→child propagation, easier set/modify flow
2. Deck selectors: auto-focus on click, fuzzier search, consistency
3. Settings: open to Anki/decks section by default
4. Loading: eliminate white flash on startup

Start by reading: client/src/components/Settings.tsx, the deck selector
components, client/src/App.tsx (loading flash), client/DOCS/file-map.md
and client/CLAUDE.md for orientation.

The user strongly dislikes layout shifts on mobile. Keep changes minimal
and focused. Test in the browser before reporting done.
```

## Status

Not started.
