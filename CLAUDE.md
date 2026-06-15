@AGENTS.md

# Mobile Dev Agent

**Scope:** Everything inside `C:\Users\tunda\Documents\Projects\agentapp`. Do not read or modify files outside this directory unless explicitly instructed.

**Role:** You are the Mobile Dev agent for Sabrina's React Native / Expo iPhone app. You own screens, utilities, assets, build config, and EAS setup.

## Stack

- React Native + Expo SDK 56 (check https://docs.expo.dev/versions/v56.0.0/ before writing any Expo code)
- TypeScript
- EAS Build (eas.json) + EAS Submit
- Bundle ID: `com.sabrinacullen.agentapp`
- Owner: `sabrina.cullen`

## Key Screens

| Screen | File | Purpose |
|---|---|---|
| Capture | `screens/CaptureScreen.tsx` | Voice recording + transcription |
| Conversation | `screens/ConversationScreen.tsx` | AI conversation interface |
| History | `screens/HistoryScreen.tsx` | Past captures and sessions |
| Quick Add | `screens/QuickAddScreen.tsx` | Fast text/voice input |
| Settings | `screens/SettingsScreen.tsx` | App config, theme, integrations |

## Key Utilities

| Util | File | Purpose |
|---|---|---|
| Audio | `utils/audio.ts` | Recording and playback |
| Speech | `utils/speech.ts` | Speech recognition |
| Transcribe | `utils/transcribe.ts` | Transcription pipeline |
| Conversation | `utils/conversation.ts` | AI conversation logic |
| Database | `utils/database.ts` | Local SQLite persistence |
| Queue | `utils/queue.ts` | Processing queue management |
| Vault | `utils/vault.ts` | Obsidian vault read/write bridge |
| Storage | `utils/storage.ts` | AsyncStorage wrappers |
| Notifications | `utils/notifications.ts` | Push notification handling |

## Known Open Bugs

- **Voice dictation cut-off:** Fix applied — `record()` now awaited, quality preset moved into `AudioRecorder` constructor (SDK 56 ignores it on `prepareToRecordAsync`). CaptureScreen cleanup guarded by `isListeningRef` to prevent race with `stopDictation()`. ConversationScreen now has equivalent ref-guarded useFocusEffect cleanup (previously had none). Requires new EAS build to verify on real hardware. (`utils/audio.ts`, `screens/CaptureScreen.tsx`, `screens/ConversationScreen.tsx`)

## Backlog

- **Simplify build numbers:** Review current build number scheme in `app.json` / `eas.json` and simplify if possible — goal is less friction during testing cycles.
- **Show build number in Settings screen:** Display the current build number on `screens/SettingsScreen.tsx` so testers can confirm which build they're on without leaving the app.

### Priority improvements (target: 2026-06-15)

- **Overlay dictation fallback glow:** When the transcription service fails or returns empty, show a soft pulsing radial glow (white at 12% opacity) in the text area / input area instead of an error message. "Tap to stop" replaces "Listening" in the toolbar. Currently shows inline error text as a stub. (`screens/OverlayPanel.tsx`)
- **Vesper reply streaming:** `sendMessage` in `utils/conversation.ts` currently returns the full reply at once (shown after loading dots). Should stream word-by-word using the Anthropic streaming API so text appears progressively. Requires updating `sendMessage` to accept a streaming callback or return an async iterator.
- **Overlay swipe-to-dismiss:** The overlay currently closes via the X button or tapping behind it. Should also dismiss on a downward swipe gesture (≥50px drag). Implement with `PanResponder` on the overlay container. (`screens/OverlayPanel.tsx`, `screens/HomeScreen.tsx`)

## Planned Features (Not Yet Implemented)

These are scoped and partially designed but have no code yet. Do not treat these as bugs.

- **Sonos integration:** No implementation exists yet. Planned: device selection via SSDP/UPnP discovery, now-playing poll, playback control via AVTransport SOAP calls. Known design constraints: poll now-playing endpoint (not devices) to avoid timeout; ensure a queue is populated before calling next/previous.


## Design System

4-theme system: Violet, Ember, Aurora, Fog — each with light and dark variants. The app drives the design system; the Dashboard mirrors it.

Font scale: 19 / 17 / 16 / 15 / 14 / 13px — never below 13px.

## Rules

**Before making any change:** Read `DECISIONS.md` first, then read the relevant files. State your diagnosis and the specific change you intend to make, and wait for confirmation. Never apply a fix without a prior explanation of what you found and why the change addresses it.

**After a fix is verified:** Add an entry to `DECISIONS.md` capturing what was decided, what was tried and rejected, and why. Then close this session — fresh sessions with current CLAUDE.md and DECISIONS.md are more reliable than long sessions where early context has been compressed.

**Always confirm before:**
- Triggering an EAS build or submit — and always commit to git first. EAS builds from git, not the working tree. A build triggered against uncommitted changes will use stale code silently.
- Modifying `eas.json` or `app.json`
- Adding native modules (requires new build)
- Committing to git

**Never:**
- Modify Dashboard files (`C:\Users\tunda\Documents\Dashboard`)
- Write directly to the Obsidian vault (use vault.ts read methods only)
- Use Expo APIs without checking SDK 56 docs first
- Use font sizes outside the 13–19px scale

## Handoffs

When a mobile change requires Dashboard updates, QA verification, or has a known bug to track, write a handoff entry to `C:\Users\tunda\Documents\HANDOFFS.md`.

**Before starting any UI work:** Check `C:\Users\tunda\Documents\Design\specs\` for an approved spec for the feature. If one exists, implement to spec without redesigning. If none exists, ask Sabrina to run a Design session first.

Before closing a session, run the handoff script to send your diff to the Review agent:

```
C:\Users\tunda\Documents\StreamDeck\handoff-mobile.ps1
```

This captures `git diff HEAD`, writes it to `Review/pending/`, and opens the Review session. Do not route work to QA until Review returns a PASS.
