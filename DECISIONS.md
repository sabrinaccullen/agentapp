# Architecture Decisions — Mobile App

Entries are append-only. Never delete or overwrite a past decision — add a new entry if something changes and note what superseded it.

Format:
**DECISION-### — Short title**
Date | Files affected
What was decided and why. What was tried and rejected, and why.

---

## DECISION-001 — Audio recorder quality preset placement
2026-06-14 | `utils/audio.ts`

Quality preset must be passed into the `AudioRecorder` constructor, not into `prepareToRecordAsync()`. In Expo SDK 56, `prepareToRecordAsync()` takes no arguments — passing a preset there is silently ignored and the recorder initialises with default (low-quality) settings.

**Do not revert this.** The original unconfigured constructor (`{}`) caused the 1-2 character voice dictation cut-off (BUG-001).

## DECISION-002 — record() must be awaited
2026-06-14 | `utils/audio.ts`

`_recorder.record()` must be awaited. Without await, the UI reports "Listening…" before the audio session is actually ready, resulting in the first portion of speech being dropped.

## DECISION-003 — useFocusEffect cleanup must be ref-guarded
2026-06-14 | `screens/CaptureScreen.tsx`, `screens/ConversationScreen.tsx`

Cleanup callbacks in useFocusEffect must check a `isListeningRef` before calling `stopRecording()`. An unconditional cleanup races with `stopDictation()` — if cleanup fires first it nulls `_recorder`, then `stopDictation()` receives null and silently discards the audio.

All screens with recording capability must have this guarded cleanup. ConversationScreen previously had no cleanup at all — unguarded removal of the cleanup would orphan the native recorder on tab switch.

## DECISION-005 — useFocusEffect cleanup must reset tab to 'write'
2026-06-14 | `screens/CaptureScreen.tsx`

The `useFocusEffect` blur cleanup must call `setTab('write')` in addition to `setIsListening(false)`. Without this, returning to the screen leaves the tab state as `'dictate'`, causing `handleTabChange` to short-circuit (it bails early if `newTab === tab`) and preventing dictation from restarting without a manual Write→Dictate tap (BUG-004).

## DECISION-004 — Transcription MIME type must match recorder output
2026-06-14 | `utils/transcribe.ts`, `utils/audio.ts`

The MIME type passed to the Whisper endpoint in `transcribe.ts` must exactly match the codec/container the recorder in `audio.ts` is configured to output. A mismatch causes complete transcription failure (BUG-002 — regression from DECISION-001 fix until format alignment was confirmed).

Before changing the quality preset or recording format in `audio.ts`, verify the output container and codec and update `transcribe.ts` to match.
